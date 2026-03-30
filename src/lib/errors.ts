function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function errorMessage(err: unknown): string {
  if (err === null || err === undefined) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (isRecord(err) && typeof err.error === "string") {
    const d = err.detail;
    return typeof d === "string" ? `${err.error}: ${d}` : err.error;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
