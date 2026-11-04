"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

function current(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Theme follows the system until the visitor chooses; the choice is remembered. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    setThemeState(current());
    const obs = new MutationObserver(() => setThemeState(current()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("vibes-theme");
      } catch {}
      if (!stored) document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    };
    mq.addEventListener("change", onSys);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onSys);
    };
  }, []);
  const setTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    root.dataset.theme = t;
    try {
      localStorage.setItem("vibes-theme", t);
    } catch {}
    window.setTimeout(() => root.classList.remove("theme-anim"), 950);
  }, []);
  return { theme, setTheme, toggle: () => setTheme(current() === "dark" ? "light" : "dark") };
}
