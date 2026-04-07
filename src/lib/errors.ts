import { z } from "zod";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const GatewayErrorBodySchema = z
  .object({ error: z.string().optional() })
  .passthrough();

/** Narrow JSON error payloads from the gateway (e.g. 502) without trusting shape. */
export function parseGatewayErrorBodyJson(text: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const parsed = GatewayErrorBodySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
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
