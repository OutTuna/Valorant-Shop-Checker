"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BACKEND_URL, saveStoredSession, type ShopSession } from "@/lib/valorant";
import { useTranslation, useLanguage, type SupportedLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

type RegionValue = "auto" | "eu" | "na" | "ap" | "kr" | "latam" | "br";

const LANG_FLAGS: { code: SupportedLanguage; flag: string; label: string }[] = [
    { code: "en", flag: "🇺🇸", label: "English" },
    { code: "uk", flag: "🇺🇦", label: "Українська" },
    { code: "ru", flag: "🇷🇺", label: "Русский" },
    { code: "pl", flag: "🇵🇱", label: "Polski" },
];

function readErrorMessage(payload: unknown): string {
    if (typeof payload === "object" && payload !== null) {
        const p = payload as Record<string, unknown>;
        if (typeof p.detail === "string") return p.detail;
        if (typeof p.message === "string") return p.message;
    }
    return String(payload);
}

export default function LoginPage() {
    const router   = useRouter();
    const t        = useTranslation();
    const { language, setLanguage } = useLanguage();
    const { theme, toggleTheme }    = useTheme();

    const [region, setRegion]             = useState<RegionValue>("auto");
    const [loading, setLoading]           = useState(false);
    const [browserInput, setBrowserInput] = useState("");
    const [browserLoading, setBrowserLoading] = useState(false);
    const [error, setError]               = useState<string | null>(null);

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
            if (!response.ok) throw new Error(readErrorMessage(payload));

            saveStoredSession(payload as ShopSession);
            router.push("/");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Login failed.");
        } finally {
            setLoading(false);
        }
    };

    const submitBrowserLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const token = browserInput.trim().match(/access_token=([^&]+)/)?.[1] ?? browserInput.trim();
        if (!token) {
            setError("Paste an access_token or full redirect URL.");
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
            if (!response.ok) throw new Error(readErrorMessage(payload));

            saveStoredSession(payload as ShopSession);
            router.push("/");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Login failed.");
        } finally {
            setBrowserLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-theme-base flex items-center justify-center p-4 text-theme-primary">
            <div className="w-full max-w-md rounded-2xl border border-theme bg-theme-surface p-8 shadow-2xl">

                {/* Top accent bar */}
                <div className="mb-6 h-1 w-full rounded-full" style={{ background: "var(--accent-red)" }} />

                {/* Header row */}
                <div className="flex items-center justify-between mb-1">
                    <h1 className="text-3xl font-bold text-theme-primary">{t("loginTitle")}</h1>
                    <div className="flex items-center gap-1">
                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="theme-toggle"
                            title={t("theme") + ": " + t(("theme" + theme.charAt(0).toUpperCase() + theme.slice(1)) as any)}
                            aria-label="Toggle theme"
                        >
                            {theme === "dark" ? "🌙" : theme === "white" ? "⚪" : "☕"}
                        </button>
                        {/* Language flags */}
                        {LANG_FLAGS.map(({ code, flag, label }) => (
                            <button
                                key={code}
                                onClick={() => setLanguage(code)}
                                className={`lang-btn${language === code ? " active" : ""}`}
                                title={label}
                                aria-label={label}
                            >
                                {flag}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="text-center text-sm text-theme-secondary mb-6">
                    {t("loginDesc")}
                </p>

                {/* Error */}
                {error ? (
                    <div className="mb-4 rounded-lg border p-3 text-sm"
                        style={{
                            borderColor: "rgba(239,68,68,0.3)",
                            background: "rgba(239,68,68,0.08)",
                            color: "var(--accent-red)",
                        }}
                    >
                        {error}
                    </div>
                ) : null}

                {/* Local login */}
                <form onSubmit={submitLocalLogin} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-theme-secondary">
                            {t("loginRegion")}
                        </label>
                        <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value as RegionValue)}
                            className="w-full rounded-lg border border-theme bg-theme-input px-4 py-3 text-theme-primary focus:outline-none"
                            style={{ borderColor: "var(--border-default)" }}
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
                        className="w-full rounded-lg py-3 font-bold transition-colors"
                        style={{
                            background: loading ? "rgba(239,68,68,0.5)" : "var(--accent-red)",
                            color: "#fff",
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? t("loginBtnLoading") : t("loginBtn")}
                    </button>
                </form>

                {/* Browser fallback */}
                <div className="my-6 border-t pt-6" style={{ borderColor: "var(--border-subtle)" }}>
                    <a
                        href={riotAuthUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full rounded-lg bg-theme-elevated px-4 py-3 text-center text-sm font-bold text-theme-primary transition-colors hover:opacity-80"
                    >
                        {t("loginBrowserBtn")}
                    </a>

                    <form onSubmit={submitBrowserLogin} className="mt-4 space-y-3">
                        <label className="block text-sm font-medium text-theme-secondary">
                            {t("loginPasteLabel")}
                        </label>
                        <textarea
                            value={browserInput}
                            onChange={(e) => setBrowserInput(e.target.value)}
                            className="min-h-28 w-full rounded-lg border border-theme bg-theme-input px-4 py-3 text-sm text-theme-primary placeholder-theme-muted focus:outline-none"
                            placeholder="https://playvalorant.com/opt_in/#access_token=..."
                        />
                        <button
                            type="submit"
                            disabled={browserLoading}
                            className="w-full rounded-lg py-3 font-bold transition-colors"
                            style={{
                                background: browserLoading ? "rgba(168,85,247,0.5)" : "var(--accent-purple)",
                                color: "#fff",
                                cursor: browserLoading ? "not-allowed" : "pointer",
                            }}
                        >
                            {browserLoading ? t("loginPasteBtnLoading") : t("loginPasteBtn")}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-theme-muted">{t("loginNote")}</p>
            </div>
        </main>
    );
}
