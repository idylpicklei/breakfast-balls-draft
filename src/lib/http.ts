export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

/** Catch Response throws from auth helpers, or wrap unknown errors. */
export function handleRouteError(err: unknown): Response {
  if (err instanceof Response) return err;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return error(message, 500);
}
