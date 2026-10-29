import { useEffect } from "react";

/**
 * useKeyboardShortcuts
 * ─────────────────────
 * Registers global keyboard shortcuts. Handlers object:
 *   { focusInput, newSession, toggleSchema, escape }
 *
 * Shortcuts:
 *   ⌘K / Ctrl+K  → focusInput
 *   ⌘N / Ctrl+N  → newSession
 *   ⌘/ / Ctrl+/  → toggleSchema
 *   Escape        → escape
 */
export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.includes("Mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === "k") {
        e.preventDefault();
        handlers.focusInput?.();
      }
      if (mod && e.key === "n") {
        e.preventDefault();
        handlers.newSession?.();
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        handlers.toggleSchema?.();
      }
      if (e.key === "Escape") {
        handlers.escape?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}