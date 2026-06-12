"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { BACKEND_URL, saveStoredSession, type ShopSession } from "@/lib/valorant";
import { useTranslation } from "../context/LanguageContext";

export default function RiotRedirectPage() {
    const router = useRouter();
    const t      = useTranslation();

    useEffect(() => {
        const hash  = window.location.hash || window.location.search;
        const match = hash.match(/access_token=([^&]+)/);

        if (!match?.[1]) {
            router.replace("/login");
            return;
        }

        const accessToken = decodeURIComponent(match[1]);
        const region      = window.sessionStorage.getItem("valorant-region") || "auto";

        (async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/token-login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ access_token: accessToken, region }),
                });
                const payload: unknown = await response.json();
                if (!response.ok) {
                    throw new Error(
                        typeof payload === "object" && payload && "detail" in payload
                            ? String((payload as { detail?: unknown }).detail ?? "Login failed.")
                            : "Login failed.",
                    );
                }

                saveStoredSession(payload as ShopSession);
                router.replace("/");
            } catch {
                router.replace("/login");
            }
        })();
    }, [router]);

    return (
        <div className="min-h-screen bg-theme-base flex items-center justify-center text-theme-primary">
            <div className="text-center space-y-4">
                <div
                    className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
                    style={{ borderRightColor: "var(--accent-red)", borderBottomColor: "var(--accent-red)", borderLeftColor: "var(--accent-red)" }}
                />
                <p className="text-theme-secondary text-sm">{t("redirecting")}</p>
            </div>
        </div>
    );
}
