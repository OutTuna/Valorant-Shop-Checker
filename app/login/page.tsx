"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BACKEND_URL, saveStoredSession, type ShopSession } from "@/lib/valorant";

type RegionValue = "auto" | "eu" | "na" | "ap" | "kr" | "latam" | "br";

function readErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== "object") {
        return "Не вдалося увійти.";
    }

    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
        return detail;
    }

    return "Не вдалося увійти.";
}

export default function LoginPage() {
    const router = useRouter();
    const [region, setRegion] = useState<RegionValue>("auto");
    const [loading, setLoading] = useState(false);
    const [browserInput, setBrowserInput] = useState("");
    const [browserLoading, setBrowserLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const riotAuthUrl = useMemo(
        () =>
            "https://auth.riotgames.com/authorize?client_id=play-valorant-web-prod&nonce=1&prompt=login&ui_locales=en&redirect_uri=https://playvalorant.com/opt_in&response_type=token+id_token&scope=account+openid&response_mode=fragment",
        [],
    );

    useEffect(() => {
        window.sessionStorage.setItem("valorant-region", region);
    }, [region]);

    const submitLocalLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${BACKEND_URL}/api/local-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ region }),
            });

            const payload: unknown = await response.json();
            if (!response.ok) {
                throw new Error(readErrorMessage(payload));
            }

            saveStoredSession(payload as ShopSession);
            router.push("/");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Не вдалося увійти.");
        } finally {
            setLoading(false);
        }
    };

    const submitBrowserLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const token = browserInput.trim().match(/access_token=([^&]+)/)?.[1] ?? browserInput.trim();
        if (!token) {
            setError("Вставь access_token или полный redirect URL.");
            return;
        }

        setBrowserLoading(true);
        setError(null);

        try {
            const response = await fetch(`${BACKEND_URL}/api/token-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: token, region }),
            });

            const payload: unknown = await response.json();
            if (!response.ok) {
                throw new Error(readErrorMessage(payload));
            }

            saveStoredSession(payload as ShopSession);
            router.push("/");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Не вдалося увійти.");
        } finally {
            setBrowserLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
            <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
                <div className="mb-6 h-1 w-full rounded-full bg-red-500" />
                <h1 className="text-3xl font-bold text-center">Valorant Store</h1>
                <p className="mt-2 text-center text-sm text-gray-400">
                    Рабочий вход через Riot Client на твоем ПК.
                </p>

                {error ? (
                    <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                    </div>
                ) : null}

                <form onSubmit={submitLocalLogin} className="mt-6 space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Регион</label>
                        <select
                            value={region}
                            onChange={(event) => setRegion(event.target.value as RegionValue)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white focus:outline-none focus:border-red-500"
                        >
                            <option value="auto">Auto</option>
                            <option value="eu">EU</option>
                            <option value="na">NA</option>
                            <option value="ap">AP</option>
                            <option value="kr">KR</option>
                            <option value="latam">LATAM</option>
                            <option value="br">BR</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full rounded-lg py-3 font-bold transition-colors ${
                            loading ? "bg-red-500/60 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                        }`}
                    >
                        {loading ? "Читаю Riot Client..." : "Войти через Riot Client"}
                    </button>
                </form>

                <div className="my-6 border-t border-gray-800 pt-6">
                    <a
                        href={riotAuthUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full rounded-lg bg-gray-800 px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-700"
                    >
                        Browser fallback: открыть Riot login
                    </a>

                    <form onSubmit={submitBrowserLogin} className="mt-4 space-y-3">
                        <label className="block text-sm font-medium text-gray-300">
                            Вставь redirect URL или access_token
                        </label>
                        <textarea
                            value={browserInput}
                            onChange={(event) => setBrowserInput(event.target.value)}
                            className="min-h-28 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                            placeholder="https://playvalorant.com/ru-ru/opt_in/#access_token=..."
                        />
                        <button
                            type="submit"
                            disabled={browserLoading}
                            className={`w-full rounded-lg py-3 font-bold transition-colors ${
                                browserLoading
                                    ? "bg-purple-500/60 cursor-not-allowed"
                                    : "bg-purple-500 hover:bg-purple-600"
                            }`}
                        >
                            {browserLoading ? "Проверяю токен..." : "Войти через браузер"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-gray-500">
                    Для основного пути открой Riot Client / Valorant и будь в аккаунте.
                </p>
            </div>
        </main>
    );
}
