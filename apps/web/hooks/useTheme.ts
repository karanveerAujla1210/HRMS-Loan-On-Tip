"use client";

import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "lot-hrms-theme";
const HTML_CLASS = "dark";

/**
 * Detect the user's preferred color-scheme via the OS-level
 * `prefers-color-scheme` media query.
 */
function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Apply the chosen theme by toggling the `dark` class on `<html>`.
 * Also mirrors the `data-theme` attribute that the legacy CSS relies on
 * (`[data-theme="light"]` / `:root:not([data-theme="light"])`).
 */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add(HTML_CLASS);
    html.setAttribute("data-theme", "dark");
  } else {
    html.classList.remove(HTML_CLASS);
    html.setAttribute("data-theme", "light");
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);

  // On mount, sync with the system preference and persist.
  useEffect(() => {
    const initial = getPreferredTheme();
    applyTheme(initial);
    setThemeState(initial);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch when the user hasn't explicitly chosen a theme.
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      } catch {}
      if (stored === null) {
        const next: Theme = e.matches ? "dark" : "light";
        applyTheme(next);
        setThemeState(next);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const isDark = theme === "dark";

  return { theme, isDark, setTheme, toggleTheme };
}

export default useTheme;
