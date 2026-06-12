"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type SupportedLanguage = "en" | "uk" | "ru" | "pl";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: "uk",
  setLanguage: () => {},
});

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

const translations = {
  en: {
    loading: "Loading shop...",
    region: "Region:",
    logout: "Logout",
    dailyShop: "Daily Shop",
    nightMarket: "Night Market",
    nightMarketUnavailable: "Night Market is not active",
    nightMarketUnavailableDesc: "Come back when the Night Market arrives. Riot usually announces it on social media.",
    daily: "Daily",
    updatingIn: "Updates in",
    endingIn: "Ends in",
    vp: "VP",
    redirecting: "Processing Riot redirect...",
    theme: "Theme",
    themeDark: "Dark",
    themeWhite: "White",
    themeCatppuccin: "Catppuccin",
    loginTitle: "Valorant Store",
    loginDesc: "Login via Riot Client on your PC",
    loginRegion: "Region",
    loginBtn: "Login via Riot Client",
    loginBtnLoading: "Reading Riot Client...",
    loginBrowserBtn: "Browser fallback: open Riot login",
    loginPasteLabel: "Paste redirect URL or access_token",
    loginPasteBtn: "Login via browser",
    loginPasteBtnLoading: "Verifying token...",
    loginNote: "For the main login path, open Riot Client / Valorant and be logged in.",
  },
  uk: {
    loading: "Завантажуємо магазин...",
    region: "Регіон:",
    logout: "Вийти",
    dailyShop: "Щоденний магазин",
    nightMarket: "Нічний ринок",
    nightMarketUnavailable: "Нічний ринок не активний",
    nightMarketUnavailableDesc: "Повертайся, коли Нічний ринок буде доступний. Riot зазвичай анонсує його в соцмережах.",
    daily: "Щоденний",
    updatingIn: "Оновлення через",
    endingIn: "Закінчується через",
    vp: "VP",
    redirecting: "Обробляємо Riot redirect...",
    theme: "Тема",
    themeDark: "Темна",
    themeWhite: "Біла",
    themeCatppuccin: "Catppuccin",
    loginTitle: "Valorant Store",
    loginDesc: "Вхід через Riot Client на твоєму ПК",
    loginRegion: "Регіон",
    loginBtn: "Увійти через Riot Client",
    loginBtnLoading: "Читаю Riot Client...",
    loginBrowserBtn: "Резервний вхід: відкрити Riot login",
    loginPasteLabel: "Встав redirect URL або access_token",
    loginPasteBtn: "Увійти через браузер",
    loginPasteBtnLoading: "Перевіряю токен...",
    loginNote: "Для основного шляху відкрий Riot Client / Valorant та будь у акаунті.",
  },
  ru: {
    loading: "Загружаем магазин...",
    region: "Регион:",
    logout: "Выйти",
    dailyShop: "Ежедневный магазин",
    nightMarket: "Ночной рынок",
    nightMarketUnavailable: "Ночной рынок не активен",
    nightMarketUnavailableDesc: "Возвращайся, когда откроется Ночной рынок. Riot обычно анонсирует его в соцсетях.",
    daily: "Ежедневный",
    updatingIn: "Обновление через",
    endingIn: "Заканчивается через",
    vp: "VP",
    redirecting: "Обрабатываем Riot redirect...",
    theme: "Тема",
    themeDark: "Тёмная",
    themeWhite: "Белая",
    themeCatppuccin: "Catppuccin",
    loginTitle: "Valorant Store",
    loginDesc: "Вход через Riot Client на твоём ПК",
    loginRegion: "Регион",
    loginBtn: "Войти через Riot Client",
    loginBtnLoading: "Читаю Riot Client...",
    loginBrowserBtn: "Резервный вход: открыть Riot login",
    loginPasteLabel: "Вставь redirect URL или access_token",
    loginPasteBtn: "Войти через браузер",
    loginPasteBtnLoading: "Проверяю токен...",
    loginNote: "Для основного пути открой Riot Client / Valorant и будь в аккаунте.",
  },
  pl: {
    loading: "Ładowanie sklepu...",
    region: "Region:",
    logout: "Wyloguj",
    dailyShop: "Dzienny sklep",
    nightMarket: "Nocny rynek",
    nightMarketUnavailable: "Nocny rynek jest nieaktywny",
    nightMarketUnavailableDesc: "Wróć, gdy Nocny Rynek będzie dostępny. Riot zazwyczaj ogłasza go w mediach społecznościowych.",
    daily: "Dzienny",
    updatingIn: "Aktualizacja za",
    endingIn: "Kończy się za",
    vp: "VP",
    redirecting: "Przetwarzanie przekierowania Riot...",
    theme: "Motyw",
    themeDark: "Ciemny",
    themeWhite: "Biały",
    themeCatppuccin: "Catppuccin",
    loginTitle: "Valorant Store",
    loginDesc: "Logowanie przez Riot Client na Twoim PC",
    loginRegion: "Region",
    loginBtn: "Zaloguj przez Riot Client",
    loginBtnLoading: "Czytam Riot Client...",
    loginBrowserBtn: "Awaryjne logowanie: otwórz Riot login",
    loginPasteLabel: "Wklej redirect URL lub access_token",
    loginPasteBtn: "Zaloguj przez przeglądarkę",
    loginPasteBtnLoading: "Weryfikuję token...",
    loginNote: "W głównej ścieżce otwórz Riot Client / Valorant i zaloguj się do konta.",
  },
};

export const useTranslation = () => {
  const { language } = useLanguage();
  return (key: keyof typeof translations.en): string => {
    const lang = translations[language] as typeof translations.en;
    return lang[key] ?? translations.en[key] ?? key;
  };
};

const LANGS: SupportedLanguage[] = ["en", "uk", "ru", "pl"];

const detectLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") return "uk";

  // Cookie first
  const cookieMatch = document.cookie.match(/lang=([^;]+)/);
  const langFromCookie = cookieMatch ? cookieMatch[1] : null;
  if (langFromCookie && LANGS.includes(langFromCookie as SupportedLanguage)) {
    return langFromCookie as SupportedLanguage;
  }

  // localStorage
  if (window.localStorage) {
    const saved = window.localStorage.getItem("language");
    if (saved && LANGS.includes(saved as SupportedLanguage)) {
      return saved as SupportedLanguage;
    }
  }

  // Browser language
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  if (browserLang === "en") return "en";
  if (browserLang === "ru") return "ru";
  if (browserLang === "pl") return "pl";
  return "uk";
};

const persistLanguage = (lang: SupportedLanguage) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("language", lang);
  document.cookie = `lang=${lang}; path=/; max-age=31536000`;
  document.documentElement.lang = lang;
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>("uk");

  useEffect(() => {
    const detected = detectLanguage();
    setLanguageState(detected);
    persistLanguage(detected);
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    persistLanguage(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};