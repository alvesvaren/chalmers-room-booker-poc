import { useEffect, useState } from "react";

/** Refreshes `now` on an interval so timeline “past vs future” stays accurate without per-second renders. */
export function useTickingNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
