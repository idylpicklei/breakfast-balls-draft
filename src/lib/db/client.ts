import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

/**
 * OpenNext exposes Worker secrets/vars on process.env at request time.
 * Also check getCloudflareContext().env as a fallback for bindings-style access.
 */
export async function getSecret(name: keyof CloudflareEnv): Promise<string | undefined> {
  const fromProcess = process.env[name as string];
  if (typeof fromProcess === "string" && fromProcess.length > 0) {
    return fromProcess;
  }

  try {
    const env = await getEnv();
    const fromCf = env[name];
    if (typeof fromCf === "string" && fromCf.length > 0) {
      return fromCf;
    }
  } catch {
    // getCloudflareContext can fail outside a request; process.env is enough for next dev
  }

  return undefined;
}
