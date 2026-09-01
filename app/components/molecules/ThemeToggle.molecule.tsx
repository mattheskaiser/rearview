"use client";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/app/hooks/useTheme";
import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle, always visible in the Sidebar. Persists an explicit
 * choice to localStorage (a UI preference, not journal content) and otherwise
 * follows the OS preference — see `useTheme`.
 *
 * Renders a neutral placeholder until mounted so the icon never flips right
 * after hydration (the theme itself is already correct pre-hydration, applied
 * by the inline script in the root layout).
 */
export const ThemeToggle = () => {
  const { theme, mounted, toggle } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={
        mounted ? (theme === "dark" ? "Switch to light theme" : "Switch to dark theme") : "Toggle theme"
      }
      onClick={toggle}
    >
      {mounted ? (
        theme === "dark" ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )
      ) : (
        <span className="size-4" aria-hidden />
      )}
    </Button>
  );
};
