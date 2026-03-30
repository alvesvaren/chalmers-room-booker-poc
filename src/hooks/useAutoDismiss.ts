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
