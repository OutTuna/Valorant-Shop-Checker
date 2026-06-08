"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
    clearStoredSession,
    readStoredSession,
    type ShopItem,
    type ShopSession,
} from "@/lib/valorant";

function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${minutes}:${secs}`;
}

function PriceCard({ item }: { item: ShopItem }) {
    return (
        <article className="bg-gray-900 rounded-xl border border-gray-800 p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="font-semibold leading-snug">{item.name}</h3>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-800 border border-gray-700 px-2 py-1 rounded">
                    {item.discountPercent ? `-${item.discountPercent}%` : "Daily"}
                </span>
            </div>

            <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden aspect-[16/9] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
                <div className="text-gray-400">
                    {item.originalPrice ? (
                        <span className="line-through">{item.originalPrice} VP</span>
                    ) : (
                        <span>Оновлення через {formatDuration(item.remaining)}</span>
                    )}
                </div>
                <div className="font-bold text-yellow-400">
                    {item.discountedPrice ?? item.price ?? 0} VP
                </div>
            </div>
        </article>
    );
}

export default function HomePage() {
    const router = useRouter();
    const [session] = useState<ShopSession | null>(() => readStoredSession());

    useEffect(() => {
        if (!session) {
            router.replace("/login");
        }
    }, [router, session]);

    const handleLogout = () => {
        clearStoredSession();
        router.replace("/login");
    };

    if (!session) {
        return (
            <main className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center space-y-4">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
                    <p className="text-gray-400 text-sm">Завантажуємо магазин...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-950 p-6 md:p-10 text-white">
            <header className="max-w-7xl mx-auto mb-10 flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">
                        {session.player.name}
                        <span className="ml-2 text-gray-500">{session.player.tag}</span>
                    </h1>
                    <p className="mt-1 text-xs uppercase tracking-wider text-red-400">
                        Region: {session.region.toUpperCase()}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-gray-800 bg-gray-950 px-4 py-2 font-mono text-yellow-400">
                        {session.player.vp} VP
                    </div>
                    <button
                        onClick={handleLogout}
                        className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-red-500/40 hover:text-red-300"
                    >
                        Вийти
                    </button>
                </div>
            </header>

            <section className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center gap-2 text-gray-400">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <h2 className="text-xl font-bold uppercase tracking-wider">Щоденний магазин</h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {session.shop.daily.map((item) => (
                        <PriceCard key={item.uuid} item={item} />
                    ))}
                </div>
            </section>

            {session.shop.night.length > 0 ? (
                <section className="max-w-7xl mx-auto mt-12">
                    <div className="mb-6 flex items-center gap-2 text-gray-400">
                        <span className="h-2 w-2 rounded-full bg-purple-500" />
                        <h2 className="text-xl font-bold uppercase tracking-wider">Нічний ринок</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {session.shop.night.map((item) => (
                            <article
                                key={item.uuid}
                                className="bg-gray-900 rounded-xl border border-gray-800 p-5 shadow-lg"
                            >
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <h3 className="font-semibold leading-snug">{item.name}</h3>
                                    <span className="text-[10px] uppercase tracking-wider text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded">
                                        -{item.discountPercent}%
                                    </span>
                                </div>

                                <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden aspect-[16/9] flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                                </div>

                                <div className="mt-4 text-sm text-gray-400">
                                    <div className="line-through">{item.originalPrice} VP</div>
                                    <div className="font-bold text-yellow-400">
                                        {item.discountedPrice} VP
                                    </div>
                                    <div className="mt-1">Закінчується через {formatDuration(item.remaining)}</div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}
        </main>
    );
}
