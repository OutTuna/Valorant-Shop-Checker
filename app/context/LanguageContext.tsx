"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const LanguageContext = createContext({
  language: "uk", // default to Ukrainian
  setLanguage: (lang: string) => {},
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
    daily: "Daily",
    updatingIn: "Updating in",
    endingIn: "Ends in",
    vp: "VP",
    redirecting: "Processing Riot redirect...",
  },
  uk: {
    loading: "Завантажуємо магазин...",
    region: "Регіон:",
    logout: "Вийти",
    dailyShop: "Щоденний магазин",
    nightMarket: "Нічний ринок",
    daily: "Щоденний",
    updatingIn: "Оновлення через",
    endingIn: "Закінчується через",
    vp: "VP",
    redirecting: "Обрабатываем Riot redirect...",
  },
};

export const useTranslation = () => {
  const { language } = useLanguage();
  return (key: keyof typeof translations.en): string => {
    return translations[language][key];
  };
};

// Helper function to detect language from available client-side sources
const detectLanguage = () => {
  if (typeof window === 'undefined') {
    return 'uk'; // default
  }

  // Try cookie first
  const cookieMatch = document.cookie.match(/lang=([^;]+)/);
  const langFromCookie = cookieMatch ? cookieMatch[1] : null;
  if (langFromCookie === 'en' || langFromCookie === 'uk') {
    return langFromCookie;
  }

  // Try localStorage
  if (window.localStorage) {
    const saved = window.localStorage.getItem("language");
    if (saved === "en" || saved === "uk") {
      return saved;
    }
  }

  // Finally, use browser language
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  return browserLang === "en" ? "en" : "uk";
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  // Always initialize with default language to match server rendering
  const [language, setLanguageState] = useState<"en" | "uk">("uk");

  useEffect(() => {
    // This runs only on the client after initial render
    if (typeof window !== 'undefined') {
      // Detect the user's preferred language
      const detectedLanguage = detectLanguage();

      // Update language state if different from default
      if (detectedLanguage !== language) {
        setLanguageState(detectedLanguage);
      }

      // Save to localStorage
      window.localStorage.setItem("language", language);
      // Save to cookie (expires in 1 year)
      document.cookie = `lang=${language}; path=/; max-age=31536000`;
      // Update html lang attribute
      if (document.documentElement.lang !== language) {
        document.documentElement.lang = language;
      }
    }
  }, []); // Empty deps - run only once after initial render

  const setLanguage = (lang: "en" | "uk") => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};