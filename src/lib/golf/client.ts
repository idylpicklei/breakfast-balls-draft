import { getEnv } from "@/lib/db/client";

export const RAPIDAPI_HOST = "live-golf-data.p.rapidapi.com";
export const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;
export const PGA_ORG_ID = "1";

export class RapidApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "RapidApiError";
  }
}

export async function rapidFetch<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const env = await getEnv();
  const apiKey = env.RAPID_API;
  if (!apiKey) {
    throw new RapidApiError("RAPID_API is not configured", 500);
  }

  const url = new URL(`${RAPIDAPI_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": RAPIDAPI_HOST,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    console.error("[RapidAPI] Rate limit exceeded (429)");
    throw new RapidApiError("RapidAPI rate limit exceeded — try again shortly", 429);
  }

  if (res.status === 401 || res.status === 403) {
    console.error(`[RapidAPI] Invalid or unauthorized key (${res.status})`);
    throw new RapidApiError("Invalid RapidAPI key or subscription", res.status);
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`[RapidAPI] ${res.status}: ${body.slice(0, 300)}`);
    throw new RapidApiError(`RapidAPI request failed (${res.status})`, res.status);
  }

  return res.json() as Promise<T>;
}
