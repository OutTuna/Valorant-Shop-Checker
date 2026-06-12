"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation, useLanguage, type SupportedLanguage } from "./context/LanguageContext";
import { useTheme } from "./context/ThemeContext";

import {
    clearStoredSession,
    readStoredSession,
    type ShopItem,
    type ShopSession,
} from "@/lib/valorant";

/* ─── Helpers ────────────────────────────────── */

function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours   = String(Math.floor(total / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs    = String(total % 60).padStart(2, "0");
    return `${hours}:${minutes}:${secs}`;
}

function calcRemaining(original: number, loadTime: number): number {
    const elapsed = Math.floor((Date.now() - loadTime) / 1000);
    return Math.max(0, original - elapsed);
}

function formatPrice(value: number | undefined | null): string {
    if (value === undefined || value === null) return "--";
    return value.toLocaleString();
}

/* ─── Language flags config ──────────────────── */
const LANG_FLAGS: { code: SupportedLanguage; flag: string; label: string }[] = [
    { code: "en", flag: "🇺🇸", label: "English" },
    { code: "uk", flag: "🇺🇦", label: "Українська" },
    { code: "ru", flag: "🇷🇺", label: "Русский" },
    { code: "pl", flag: "🇵🇱", label: "Polski" },
];

/* ─── PriceCard component ────────────────────── */
function PriceCard({
    item,
    loadTime,
    t,
}: {
    item: ShopItem;
    loadTime: number;
    t: (key: any) => string;
}) {
    const remaining = calcRemaining(item.remaining, loadTime);
    // For daily shop: price field. For night market items passed here: discountedPrice.
    const displayPrice = item.discountedPrice ?? item.price;

    return (
        <article className="shop-card">
            {/* Title + badge — fixed heights to prevent layout shift */}
            <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="card-title text-theme-primary">{item.name}</h3>
                <span className="card-badge">
                    {item.discountPercent ? `-${item.discountPercent}%` : t("daily")}
                </span>
            </div>

            {/* Skin image */}
            <a
                href={`https://www.google.com/search?q=Valorant+${encodeURIComponent(item.name)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-theme-subtle overflow-hidden flex items-center justify-center bg-theme-base relative group block transition-transform hover:scale-[1.02]"
                style={{ aspectRatio: "16/9" }}
                title={`Search ${item.name} on Google`}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={item.image}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                />
            </a>

            {/* Price row — fixed height to prevent layout shift on lang change */}
            <div className="card-price-row">
                <div className="text-theme-secondary text-sm">
                    {item.originalPrice !== undefined && item.originalPrice !== null ? (
                        <span className="line-through">{formatPrice(item.originalPrice)} VP</span>
                    ) : (
                        <span>{t("updatingIn")} {formatDuration(remaining)}</span>
                    )}
                </div>
                <div className="font-bold text-accent-gold">
                    {formatPrice(displayPrice)} VP
                </div>
            </div>
        </article>
    );
}

/* ─── Night market card ──────────────────────── */
function NightCard({
    item,
    loadTime,
    t,
}: {
    item: ShopItem;
    loadTime: number;
    t: (key: any) => string;
}) {
    const remaining = calcRemaining(item.remaining, loadTime);

    return (
        <article className="shop-card">
            <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="card-title text-theme-primary">{item.name}</h3>
                <span
                    className="card-badge"
                    style={{ color: "var(--accent-purple)", background: "rgba(168,85,247,0.08)", borderColor: "rgba(168,85,247,0.25)" }}
                >
                    -{item.discountPercent}%
                </span>
            </div>

            <a
                href={`https://www.google.com/search?q=Valorant+${encodeURIComponent(item.name)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-theme-subtle overflow-hidden flex items-center justify-center bg-theme-base relative group block transition-transform hover:scale-[1.02]"
                style={{ aspectRatio: "16/9" }}
                title={`Search ${item.name} on Google`}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
            </a>

            <div className="mt-4 text-sm">
                <div className="text-theme-secondary line-through">{formatPrice(item.originalPrice)} VP</div>
                <div className="font-bold text-accent-gold">{formatPrice(item.discountedPrice)} VP</div>
                <div className="mt-1 text-theme-muted">{t("endingIn")} {formatDuration(remaining)}</div>
            </div>
        </article>
    );
}

/* ─── Night market placeholder ───────────────── */
function NightMarketPlaceholder({ t }: { t: (key: any) => string }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const now = new Date();
        let targetDate = new Date(now.getFullYear(), now.getMonth(), 28);
        if (targetDate <= now) {
            targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 28);
        }

        const updateTimer = () => {
            const diff = targetDate.getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft("00:00:00:00");
                return;
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);
            setTimeLeft(`${String(d).padStart(2, "0")}:${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
        };
        
        updateTimer();
        const id = setInterval(updateTimer, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="night-placeholder flex flex-col items-center justify-center text-center p-8 rounded-xl">
            {/* Moon icon */}
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem", filter: "drop-shadow(0 0 24px rgba(168,85,247,0.5))" }}>
                🌙
            </div>
            <h3
                className="text-xl font-bold mb-2"
                style={{ color: "var(--accent-purple)" }}
            >
                {t("nightMarketUnavailable")}
            </h3>
            <p className="text-theme-secondary text-sm max-w-xs mb-6">
                {t("nightMarketUnavailableDesc")}
            </p>
            {timeLeft && (
                <div className="flex flex-col items-center mt-2">
                    <span className="text-xs text-theme-muted uppercase tracking-wider mb-2">{t("updatingIn")}</span>
                    <div className="text-2xl font-mono font-bold text-accent-purple bg-theme-surface border border-theme px-6 py-3 rounded-lg shadow-inner">
                        {timeLeft}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main page ──────────────────────────────── */
export default function HomePage() {
    const router   = useRouter();
    const [session, setSession] = useState<ShopSession | null>(null);
    const [, setTick] = useState(0);
    const loadTimeRef = useRef<number>(0);
    const t   = useTranslation();
    const { language, setLanguage } = useLanguage();
    const { theme, toggleTheme }    = useTheme();

    // Load session on mount
    useEffect(() => {
        const stored = readStoredSession();
        if (!stored) {
            router.replace("/login");
        } else {
            setSession(stored);
            if (loadTimeRef.current === 0) {
                loadTimeRef.current = Date.now();
            }
        }
    }, [router]);

    // Countdown tick
    useEffect(() => {
        if (!session) return;
        const id = setInterval(() => setTick((p) => p + 1), 1000);
        return () => clearInterval(id);
    }, [session]);

    const handleLogout = () => {
        clearStoredSession();
        router.replace("/login");
    };

    /* Loading state */
    if (!session) {
        return (
            <main className="min-h-screen bg-theme-base flex items-center justify-center text-theme-primary">
                <div className="text-center space-y-4">
                    <div
                        className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
                        style={{ borderRightColor: "var(--accent-red)", borderBottomColor: "var(--accent-red)", borderLeftColor: "var(--accent-red)" }}
                        suppressHydrationWarning
                    />
                    <p className="text-theme-secondary text-sm">{t("loading")}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-theme-base p-6 md:p-10 text-theme-primary">

            {/* ── Header ─────────────────────────────── */}
            <header className="max-w-7xl mx-auto mb-10 flex flex-col gap-4 rounded-2xl border border-theme bg-theme-surface p-6 shadow-xl md:flex-row md:items-center md:justify-between">

                {/* Player info */}
                <div>
                    <h1 className="text-2xl font-bold text-theme-primary">
                        {session.player.name}
                        <span className="ml-2 text-theme-muted">{session.player.tag}</span>
                    </h1>
                    <p className="mt-1 text-xs uppercase tracking-wider text-accent-red">
                        {t("region")} {session.region.toUpperCase()}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* VP balance */}
                    <div
                        className="rounded-lg border border-theme bg-theme-base px-4 py-2 font-mono font-bold text-accent-gold"
                    >
                        {formatPrice(session.player.vp)} {t("vp")}
                    </div>

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
                    <div className="flex items-center gap-1">
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

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="rounded-lg border border-theme px-4 py-2 text-sm text-theme-secondary transition-colors hover:border-red-500/40 hover:text-accent-red"
                    >
                        {t("logout")}
                    </button>
                </div>
            </header>

            {/* ── Daily shop ─────────────────────────── */}
            <section className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center gap-2 text-theme-secondary">
                    <span className="h-2 w-2 rounded-full bg-accent-red" style={{ background: "var(--accent-red)" }} />
                    <h2 className="text-xl font-bold uppercase tracking-wider text-theme-primary">{t("dailyShop")}</h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {session.shop.daily.map((item) => (
                        <PriceCard
                            key={item.uuid}
                            item={item}
                            loadTime={loadTimeRef.current}
                            t={t}
                        />
                    ))}
                </div>
            </section>

            {/* ── Night market ───────────────────────── */}
            <section className="max-w-7xl mx-auto mt-12">
                <div className="mb-6 flex items-center gap-2 text-theme-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent-purple)" }} />
                    <h2 className="text-xl font-bold uppercase tracking-wider text-theme-primary">{t("nightMarket")}</h2>
                </div>

                {session.shop.night.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {session.shop.night.map((item) => (
                            <NightCard
                                key={item.uuid}
                                item={item}
                                loadTime={loadTimeRef.current}
                                t={t}
                            />
                        ))}
                    </div>
                ) : (
                    <NightMarketPlaceholder t={t} />
                )}
            </section>

        </main>
    );
}
