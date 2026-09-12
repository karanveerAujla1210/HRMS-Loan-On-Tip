"use client";


import { useTheme } from "@/hooks/useTheme";

/**
 * Runs on the client inside the root layout `<body>`.
 * Initialises the theme (light/dark) by toggling the `dark` class on `<html>`
 * and syncing with localStorage / OS preference.
 */
export default function ThemeInitializer() {
  useTheme();
  // This component renders nothing – it only manages side-effects.
  return null;
}
