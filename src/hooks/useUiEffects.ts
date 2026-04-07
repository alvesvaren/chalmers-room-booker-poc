import { useEffect } from "react";

/** Clears transient message state after `durationMs`. */
export function useAutoDismiss(
  message: string | null,
  clear: () => void,
  durationMs: number,
) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => clear(), durationMs);
    return () => window.clearTimeout(t);
  }, [message, clear, durationMs]);
}

/** Registers a window `keydown` listener for Escape; DOM sync belongs in a hook per project conventions. */
export function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
