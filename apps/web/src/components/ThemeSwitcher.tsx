"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THEME, isThemeId, THEME_PROFILES, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(isThemeId(current) ? current : DEFAULT_THEME);
  }, []);

  function applyTheme(nextTheme: ThemeId) {
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  return (
    <div
      aria-label="Theme switcher"
      className="theme-switcher"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: 4,
        border: "1px solid var(--color-border)",
        borderRadius: "calc(var(--radius-sm) + 2px)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      {THEME_PROFILES.map((item) => {
        const active = theme === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => applyTheme(item.id)}
            title={item.description}
            aria-label={item.label}
            aria-pressed={active}
            className="theme-switcher-option"
            style={{
              minWidth: 72,
              padding: "4px 8px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: active ? "var(--color-neon)" : "transparent",
              color: active ? "var(--color-void)" : "var(--color-text-muted)",
              cursor: "pointer",
              transition: "all 150ms ease",
              textAlign: "left",
            }}
          >
            <span
              className="font-mono"
              style={{
                display: "block",
                fontSize: "0.56rem",
                lineHeight: 1.1,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: active ? 0.8 : 1,
              }}
            >
              {item.short}
            </span>
            <span
              className="font-display"
              style={{
                display: "block",
                fontSize: "0.66rem",
                lineHeight: 1.15,
                fontWeight: 700,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
