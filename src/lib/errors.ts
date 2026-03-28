export function errorMessage(err: unknown): string {
  if (err === null || err === undefined) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const r = err as Record<string, unknown>;
    if (typeof r.error === "string") {
      const d = r.detail;
      return typeof d === "string" ? `${r.error}: ${d}` : r.error;
    }
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
