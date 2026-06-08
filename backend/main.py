from __future__ import annotations

import asyncio
import base64
import logging
import json
import os
import re
import platform
from time import perf_counter
from typing import Any
from urllib.parse import parse_qs, urlsplit
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator


app = FastAPI(title="Valorant Store Backend")

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "valorant_backend.log"

logger = logging.getLogger("valorant_backend")
if not logger.handlers:
    logger.setLevel(logging.DEBUG if os.getenv("VALORANT_DEBUG", "0") == "1" else logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_log() -> None:
    logger.info("backend.startup log_file=%s", LOG_FILE)


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    started = perf_counter()
    response = await call_next(request)
    elapsed_ms = (perf_counter() - started) * 1000
    logger.info(
        "http %s %s -> %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


VALORANT_API = "https://valorant-api.com/v1"
AUTH_URL = "https://auth.riotgames.com/api/v1/authorization"
USERINFO_URL = "https://auth.riotgames.com/userinfo"
ENTITLEMENTS_URL = "https://entitlements.auth.riotgames.com/api/token/v1"
CLIENT_ID = "play-valorant-web-prod"
REDIRECT_URI = "https://playvalorant.com/opt_in"
RIOT_USER_AGENT = (
    "RiotClient/99.0.4.202.816 rso-auth/2 riotgames/pcac "
    "(Windows;10;;Professional, x64)"
)
CLIENT_PLATFORM = base64.b64encode(
    json.dumps(
        {
            "platformType": "PC",
            "platformOS": "Windows",
            "platformOSVersion": "10.0.19042.1.256.64bit",
            "platformChipset": "Unknown",
        }
    ).encode("utf-8")
).decode("utf-8")
REGIONS = ("eu", "na", "ap", "kr", "latam", "br")
VP_CURRENCY_ID = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    region: str | None = None

    @field_validator("region")
    @classmethod
    def normalize_region(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized in {"", "auto"}:
            return None
        if normalized not in REGIONS:
            raise ValueError("region must be auto, eu, na, ap, or kr")
        return normalized


class AccessTokenRequest(BaseModel):
    access_token: str = Field(min_length=1)
    region: str | None = None

    @field_validator("region")
    @classmethod
    def normalize_region(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized in {"", "auto"}:
            return None
        if normalized not in REGIONS:
            raise ValueError("region must be auto, eu, na, ap, or kr")
        return normalized


def _normalize_access_token(value: str) -> str:
    candidate = value.strip()
    if "access_token=" not in candidate:
        return candidate
    match = re.search(r"access_token=([^&]+)", candidate)
    return match.group(1) if match else candidate


class LocalLoginRequest(BaseModel):
    region: str | None = None

    @field_validator("region")
    @classmethod
    def normalize_region(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized in {"", "auto"}:
            return None
        if normalized not in REGIONS:
            raise ValueError("region must be auto, eu, na, ap, or kr")
        return normalized


def _first_value(values: dict[str, Any], default: int = 0) -> int:
    if not values:
        return default
    return int(next(iter(values.values()), default))


def _extract_cookie(header_value: str | None, cookie_name: str) -> str | None:
    if not header_value:
        return None
    for part in header_value.split(","):
        for chunk in part.split(";"):
            chunk = chunk.strip()
            if chunk.startswith(f"{cookie_name}="):
                return chunk.split("=", 1)[1]
    return None


def _cookie_names(set_cookie_headers: list[str]) -> list[str]:
    names: list[str] = []
    for cookie in set_cookie_headers:
        name = cookie.split("=", 1)[0].strip()
        if name:
            names.append(name)
    return names


def _preview(value: str | None, limit: int = 220) -> str:
    if not value:
        return ""
    return value[:limit].replace("\n", " ").replace("\r", " ")


def _extract_affinity(userinfo: dict[str, Any]) -> str | None:
    affinity = userinfo.get("affinity")
    if isinstance(affinity, dict):
        for key in ("pp", "region", "shard"):
            value = affinity.get(key)
            if isinstance(value, str) and value:
                return value.strip().lower()
    if isinstance(affinity, str) and affinity:
        return affinity.strip().lower()
    return None


def _log_response(prefix: str, response: httpx.Response, *, raw_body: bool = False) -> None:
    body = _preview(response.text) if raw_body else f"<redacted:{len(response.text)} chars>"
    logger.debug(
        "%s status=%s cookies=%s body=%s",
        prefix,
        response.status_code,
        _cookie_names(response.headers.get_list("set-cookie")),
        body,
    )


def _extract_access_token(uri: str) -> str:
    fragment = urlsplit(uri).fragment
    params = parse_qs(fragment)
    token = params.get("access_token", [None])[0]
    if not token:
        raise HTTPException(401, "Riot returned no access token.")
    return token


def _find_lockfile() -> Path:
    if platform.system() == "Darwin":
        return Path.home() / "Library/Application Support/Riot Games/Riot Client/Config/lockfile"
    if platform.system() == "Windows":
        local_appdata = os.environ.get("LOCALAPPDATA")
        if not local_appdata:
            raise HTTPException(500, "LOCALAPPDATA is not set.")
        return Path(local_appdata) / "Riot Games" / "Riot Client" / "Config" / "lockfile"
    raise HTTPException(500, "Unsupported platform for lockfile auth.")


def _read_lockfile() -> dict[str, str]:
    lockfile = _find_lockfile()
    if not lockfile.exists():
        raise HTTPException(404, "Riot lockfile not found. Open Riot Client / Valorant first.")

    parts = lockfile.read_text(encoding="utf-8").strip().split(":")
    if len(parts) != 5:
        raise HTTPException(500, "Riot lockfile has an unexpected format.")

    _, _, port, password, protocol = parts
    return {"port": port, "password": password, "protocol": protocol}


def _local_base_url(port: str) -> str:
    return f"https://127.0.0.1:{port}"


async def _local_client_tokens() -> dict[str, Any]:
    lock = _read_lockfile()
    base_url = _local_base_url(lock["port"])
    auth = httpx.BasicAuth("riot", lock["password"])
    timeout = httpx.Timeout(10.0, connect=5.0)

    async with httpx.AsyncClient(verify=False, timeout=timeout, auth=auth) as client:
        response = await client.get(f"{base_url}/entitlements/v1/token")
        _log_response("local.entitlements", response, raw_body=False)
        if response.status_code != 200:
            raise HTTPException(401, f"Local Riot Client refused token request ({response.status_code}).")
        data = response.json()
        access_token = data.get("accessToken")
        entitlements_token = data.get("token")
        puuid = data.get("subject")
        if not access_token or not entitlements_token or not puuid:
            raise HTTPException(401, "Local Riot Client did not return valid tokens.")

        region = None
        try:
            session_response = await client.get(f"{base_url}/product-session/v1/external-sessions")
            _log_response("local.sessions", session_response, raw_body=False)
            if session_response.status_code == 200:
                sessions = session_response.json()
                for value in sessions.values():
                    arguments = value.get("launchConfiguration", {}).get("arguments", [])
                    for argument in arguments:
                        if "-ares-deployment=" in argument:
                            region = argument.split("=", 1)[1].strip().lower()
                            break
                    if region:
                        break
        except Exception:
            region = None

        return {
            "access_token": access_token,
            "entitlements_token": entitlements_token,
            "puuid": puuid,
            "region": region,
        }


def _riot_headers(access_token: str, entitlements_token: str, client_version: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "X-Riot-Entitlements-JWT": entitlements_token,
        "X-Riot-ClientPlatform": CLIENT_PLATFORM,
        "X-Riot-ClientVersion": client_version,
        "Content-Type": "application/json",
    }


async def _get_client_version(client: httpx.AsyncClient) -> str:
    response = await client.get(f"{VALORANT_API}/version")
    if response.status_code == 200:
        return response.json()["data"]["riotClientVersion"]
    return "release-10.00-shipping-15-2704372"


async def _authorize(client: httpx.AsyncClient, username: str, password: str) -> str:
    logger.info("auth.init start")
    init_response = await client.post(
        AUTH_URL,
        json={
            "acr_values": "urn:riot:bronze",
            "claims": "",
            "client_id": CLIENT_ID,
            "code_challenge": "",
            "code_challenge_method": "",
            "nonce": "1",
            "redirect_uri": REDIRECT_URI,
            "response_mode": "query",
            "response_type": "token id_token",
            "scope": "account openid",
        },
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": RIOT_USER_AGENT,
        },
    )
    _log_response("auth.init", init_response, raw_body=False)
    if init_response.status_code != 200:
        raise HTTPException(502, f"Riot auth init failed: {init_response.status_code}")

    cookies = [
        cookie.split(";", 1)[0].strip()
        for cookie in init_response.headers.get_list("set-cookie")
        if cookie
    ]
    if not cookies:
        raise HTTPException(502, "Riot did not return a session cookie.")

    auth_response = await client.put(
        AUTH_URL,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Cookie": "; ".join(cookies),
            "User-Agent": RIOT_USER_AGENT,
        },
        json={
            "type": "auth",
            "username": username,
            "password": password,
            "remember": True,
            "language": "en_US",
        },
    )
    _log_response("auth.login", auth_response, raw_body=auth_response.status_code != 200)
    payload = auth_response.json()
    logger.debug(
        "auth.login parsed type=%s error=%s keys=%s",
        payload.get("type"),
        payload.get("error"),
        list(payload.keys()),
    )
    if auth_response.status_code != 200:
        detail = payload.get("error") or payload.get("type") or auth_response.text[:120]
        raise HTTPException(401, f"Riot rejected the login: {detail}")
    if payload.get("error"):
        error_code = str(payload.get("error"))
        if error_code == "auth_failure":
            raise HTTPException(401, "Riot rejected the username or password.")
        raise HTTPException(401, f"Riot auth error: {error_code}")
    if payload.get("type") == "multifactor":
        raise HTTPException(401, "Riot requires extra verification for this account.")

    uri = payload.get("response", {}).get("parameters", {}).get("uri")
    if not uri:
        raise HTTPException(401, "Riot login did not return an access token.")
    return _extract_access_token(uri)


async def _fetch_userinfo(client: httpx.AsyncClient, access_token: str) -> dict[str, Any]:
    response = await client.get(
        USERINFO_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "User-Agent": RIOT_USER_AGENT,
        },
    )
    _log_response("userinfo", response, raw_body=False)
    if response.status_code != 200:
        raise HTTPException(401, f"Could not read Riot profile data ({response.status_code}).")
    payload = response.json()
    logger.debug(
        "userinfo parsed key_count=%s affinity=%s",
        len(payload.keys()),
        _extract_affinity(payload),
    )
    return payload


async def _build_shop_payload(
    client: httpx.AsyncClient,
    access_token: str,
    entitlements_token: str,
    puuid: str,
    region: str | None,
    player_name: str = "Riot Player",
    player_tag: str = "",
) -> dict[str, Any]:
    client_version = await _get_client_version(client)

    resolved_region = await _resolve_region(
        client,
        region,
        puuid,
        _riot_headers(access_token, entitlements_token, client_version),
    )
    riot_headers = _riot_headers(access_token, entitlements_token, client_version)
    storefront = await _fetch_storefront(client, resolved_region, puuid, riot_headers)
    wallet = await _fetch_wallet(client, resolved_region, puuid, riot_headers)
    prices = await _fetch_offer_prices(client, resolved_region, riot_headers)

    skin_cache: dict[str, dict[str, Any]] = {}
    skin_ids = set(storefront.get("SkinsPanelLayout", {}).get("SingleItemOffers", []))
    bonus_store = storefront.get("BonusStore", {})
    for item in bonus_store.get("BonusStoreOffers", []):
        offer_id = item.get("Offer", {}).get("OfferID")
        if offer_id:
            skin_ids.add(offer_id)

    skin_details = await asyncio.gather(
        *(_skin_catalog(client, skin_uuid, skin_cache) for skin_uuid in skin_ids)
    )
    skin_lookup = {skin["uuid"]: skin for skin in skin_details}
    vp = wallet.get("Balances", {}).get(VP_CURRENCY_ID, 0)

    logger.info("shop.payload done region=%s vp=%s prices_count=%s", resolved_region, vp, len(prices))
    return {
        "player": {
            "puuid": puuid,
            "name": player_name,
            "tag": f"#{player_tag}" if player_tag else "",
            "vp": vp,
        },
        "region": resolved_region,
        "shop": {
            "daily": _format_daily_offers(storefront, prices, skin_lookup),
            "night": _format_night_market(storefront, skin_lookup),
        },
    }


async def _load_session_from_access_token(
    client: httpx.AsyncClient,
    access_token: str,
    region: str | None,
) -> dict[str, Any]:
    logger.info("api.token-login start region=%s", region or "auto")
    userinfo = await _fetch_userinfo(client, access_token)
    entitlements_token = await _fetch_entitlements(client, access_token)
    puuid = userinfo.get("sub")
    if not puuid:
        raise HTTPException(401, "Riot profile did not include a PUUID.")
    affinity_region = _extract_affinity(userinfo)
    preferred_region = region or affinity_region
    acct = userinfo.get("acct", {}) if isinstance(userinfo, dict) else {}
    player_name = acct.get("game_name") or acct.get("gameName") or "Riot Player"
    player_tag = acct.get("tag_line") or acct.get("tagLine") or ""
    result = await _build_shop_payload(
        client,
        access_token,
        entitlements_token,
        puuid,
        preferred_region,
        player_name,
        player_tag,
    )
    logger.info("api.token-login done region=%s", result["region"])
    return result


async def _fetch_entitlements(client: httpx.AsyncClient, access_token: str) -> str:
    response = await client.post(
        ENTITLEMENTS_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json={},
    )
    _log_response("entitlements", response, raw_body=False)
    if response.status_code != 200:
        raise HTTPException(401, "Could not create Riot entitlements token.")
    entitlements_token = response.json().get("entitlements_token")
    if not entitlements_token:
        raise HTTPException(401, "Riot did not return an entitlements token.")
    return entitlements_token


async def _fetch_storefront(
    client: httpx.AsyncClient,
    region: str,
    puuid: str,
    headers: dict[str, str],
) -> dict[str, Any]:
    try:
        v3_response = await client.post(
            f"https://pd.{region}.a.pvp.net/store/v3/storefront/{puuid}",
            headers=headers,
            content=b"{}",
        )
    except httpx.RequestError as exc:
        logger.debug("storefront.v3.%s request_error=%s", region, exc.__class__.__name__)
        return {}
    _log_response(f"storefront.v3.{region}", v3_response, raw_body=False)
    if v3_response.status_code == 200:
        return v3_response.json()

    try:
        v2_response = await client.get(
            f"https://pd.{region}.a.pvp.net/store/v2/storefront/{puuid}",
            headers=headers,
        )
    except httpx.RequestError as exc:
        logger.debug("storefront.v2.%s request_error=%s", region, exc.__class__.__name__)
        return {}
    _log_response(f"storefront.v2.{region}", v2_response, raw_body=False)
    if v2_response.status_code == 200:
        return v2_response.json()
    return {}


async def _fetch_wallet(
    client: httpx.AsyncClient,
    region: str,
    puuid: str,
    headers: dict[str, str],
) -> dict[str, Any]:
    response = await client.get(
        f"https://pd.{region}.a.pvp.net/store/v1/wallet/{puuid}",
        headers=headers,
    )
    _log_response(f"wallet.{region}", response, raw_body=False)
    if response.status_code != 200:
        logger.warning(f"wallet.{region} failed with status {response.status_code}")
        return {}
    wallet_data = response.json()
    logger.debug(f"wallet.{region} response: {wallet_data}")
    return wallet_data


async def _fetch_offer_prices(
    client: httpx.AsyncClient,
    region: str,
    headers: dict[str, str],
) -> dict[str, int]:
    response = await client.get(
        f"https://pd.{region}.a.pvp.net/store/v1/offers/",
        headers=headers,
    )
    _log_response(f"offers.{region}", response, raw_body=False)
    if response.status_code != 200:
        logger.warning(f"offers.{region} failed with status {response.status_code}")
        return {}
    offers_data = response.json()
    logger.debug(f"offers.{region} response: {offers_data}")
    return {
        offer.get("OfferID"): _first_value(offer.get("Cost", {}))
        for offer in offers_data.get("Offers", [])
        if offer.get("OfferID")
    }


async def _skin_catalog(
    client: httpx.AsyncClient,
    skin_uuid: str,
    cache: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    if skin_uuid in cache:
        return cache[skin_uuid]

    result: dict[str, Any] = {
        "uuid": skin_uuid,
        "name": skin_uuid,
        "image": f"https://media.valorant-api.com/weaponskinlevels/{skin_uuid}/displayicon.png",
    }
    response = await client.get(f"{VALORANT_API}/weapons/skinlevels/{skin_uuid}")
    if response.status_code == 200:
        data = response.json().get("data", {})
        result["name"] = data.get("displayName") or skin_uuid
        result["image"] = data.get("displayIcon") or result["image"]

    cache[skin_uuid] = result
    return result


async def _resolve_region(
    client: httpx.AsyncClient,
    preferred_region: str | None,
    puuid: str,
    headers: dict[str, str],
) -> str:
    if preferred_region:
        probe = await _fetch_storefront(client, preferred_region, puuid, headers)
        if probe:
            return preferred_region
        raise HTTPException(401, f"Store is not available for region '{preferred_region}'.")

    for region in REGIONS:
        probe = await _fetch_storefront(client, region, puuid, headers)
        if probe:
            return region

    raise HTTPException(502, "Could not detect the account region.")


def _format_daily_offers(
    storefront: dict[str, Any],
    prices: dict[str, int],
    skins: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    panel = storefront.get("SkinsPanelLayout", {})
    remaining = panel.get("SingleItemOffersRemainingDurationInSeconds", 0)
    offers = []
    for offer_id in panel.get("SingleItemOffers", []):
        skin = skins.get(offer_id, {"uuid": offer_id, "name": offer_id, "image": ""})
        offers.append(
            {
                "uuid": offer_id,
                "name": skin["name"],
                "image": skin["image"],
                "price": prices.get(offer_id, 0),
                "remaining": remaining,
            }
        )
    return offers


def _format_night_market(
    storefront: dict[str, Any],
    skins: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    bonus = storefront.get("BonusStore")
    if not bonus:
        return []

    items = []
    for item in bonus.get("BonusStoreOffers", []):
        offer = item.get("Offer", {})
        offer_id = offer.get("OfferID")
        if not offer_id:
            continue
        skin = skins.get(offer_id, {"uuid": offer_id, "name": offer_id, "image": ""})
        original_price = _first_value(offer.get("Cost", {}))
        discounted_price = _first_value(item.get("DiscountCosts", {}), original_price)
        items.append(
            {
                "uuid": offer_id,
                "name": skin["name"],
                "image": skin["image"],
                "originalPrice": original_price,
                "discountedPrice": discounted_price,
                "discountPercent": int(item.get("DiscountPercent", 0)),
                "remaining": bonus.get("BonusStoreRemainingDurationInSeconds", 0),
            }
        )
    return items


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/login")
async def login(payload: LoginRequest) -> dict[str, Any]:
    logger.info("api.login start region=%s", payload.region or "auto")
    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        data = await _load_session_from_access_token(
            client,
            await _authorize(client, payload.username, payload.password),
            payload.region,
        )

    return data


@app.post("/api/token-login")
async def token_login(payload: AccessTokenRequest) -> dict[str, Any]:
    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        return await _load_session_from_access_token(
            client,
            _normalize_access_token(payload.access_token),
            payload.region,
        )


@app.post("/api/local-login")
async def local_login(payload: LocalLoginRequest) -> dict[str, Any]:
    tokens = await _local_client_tokens()
    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        region = payload.region or tokens["region"]
        return await _build_shop_payload(
            client,
            tokens["access_token"],
            tokens["entitlements_token"],
            tokens["puuid"],
            region,
        )
