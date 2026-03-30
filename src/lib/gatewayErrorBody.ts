import { z } from "zod";

/** Narrow JSON error payloads from the gateway (e.g. 502) without trusting shape. */
const GatewayErrorBodySchema = z
  .object({ error: z.string().optional() })
  .passthrough();

export type GatewayErrorBody = z.infer<typeof GatewayErrorBodySchema>;

export function parseGatewayErrorBodyJson(
  text: string,
): GatewayErrorBody | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const parsed = GatewayErrorBodySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
