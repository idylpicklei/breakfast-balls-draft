const DEV_USER_KEY = "bb_dev_user_id";

export function getDevUserId(): string {
  if (typeof window === "undefined") return "admin";
  return localStorage.getItem(DEV_USER_KEY) || "admin";
}

export function setDevUserId(id: string) {
  localStorage.setItem(DEV_USER_KEY, id);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (process.env.NODE_ENV !== "production") {
    headers.set("x-dev-user-id", getDevUserId());
  }

  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
