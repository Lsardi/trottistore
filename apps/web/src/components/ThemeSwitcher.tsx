"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "trottistore-theme";

const THEMES = [
  { id: "atelier", label: "Atelier Neon" },
  { id: "editorial", label: "Editorial Light" },
  { id: "brutalist", label: "Brutalist Chrome" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("atelier");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as ThemeId | null) ||
      "atelier";
    setTheme(current);
  }, []);

  function applyTheme(nextTheme: ThemeId) {
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  return (
    <label className="relative" aria-label="Theme switcher">
      <select
        value={theme}
        onChange={(e) => applyTheme(e.target.value as ThemeId)}
        className="appearance-none h-9 min-w-[9.5rem] px-3 pr-8 text-[11px] font-mono tracking-wide uppercase border transition-colors"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          borderColor: "var(--color-border)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        {THEMES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
        style={{ color: "var(--color-text-dim)" }}
      >
        ▼
      </span>
    </label>
  );
}
