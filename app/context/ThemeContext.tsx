"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "white" | "catppuccin";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const getStoredTheme = (): Theme => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("theme");
  if (stored === "white" || stored === "catppuccin") {
    return stored as Theme;
  }
  return "dark";
};

const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  
  html.classList.remove("theme-white", "theme-catppuccin");
  if (theme !== "dark") {
    html.classList.add(`theme-${theme}`);
  }
  
  window.localStorage.setItem("theme", theme);
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const order: Theme[] = ["dark", "white", "catppuccin"];
      const nextIndex = (order.indexOf(prev) + 1) % order.length;
      const next: Theme = order[nextIndex];
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
