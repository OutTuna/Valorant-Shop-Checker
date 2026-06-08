export const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export const STORAGE_KEY = "valorant-shop-session";

export interface ShopItem {
    uuid: string;
    name: string;
    image: string;
    price?: number;
    remaining: number;
    originalPrice?: number;
    discountedPrice?: number;
    discountPercent?: number;
}

export interface ShopSession {
    player: {
        puuid: string;
        name: string;
        tag: string;
        vp: number;
    };
    region: string;
    shop: {
        daily: ShopItem[];
        night: ShopItem[];
    };
}

export function readStoredSession(): ShopSession | null {
    if (typeof window === "undefined") {
        return null;
    }

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as ShopSession;
    } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

export function saveStoredSession(session: ShopSession) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
    window.sessionStorage.removeItem(STORAGE_KEY);
}
