export function getDevUserId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("bb_dev_user_id") || "";
}

/** @deprecated Header auth disabled in production — use login session. */
export function setDevUserId(id: string) {
  localStorage.setItem("bb_dev_user_id", id);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
