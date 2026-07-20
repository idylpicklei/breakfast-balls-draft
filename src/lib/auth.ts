import { getDb, getSecret } from "@/lib/db/client";
import type { AuthUser, User } from "@/lib/db/types";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asBool(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1;
}

async function loadUser(id: string): Promise<AuthUser | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, name, is_admin FROM users WHERE id = ?")
    .bind(id)
    .first<User>();

  if (!row) return null;
  return { id: row.id, name: row.name, is_admin: asBool(row.is_admin) };
}

async function headerAuthAllowed(): Promise<boolean> {
  const flag = await getSecret("ALLOW_HEADER_AUTH");
  if (flag === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Resolve the current user from Cloudflare Access headers.
 * With ALLOW_HEADER_AUTH=true (or non-production), also accept x-dev-user-id.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const email = request.headers.get("cf-access-authenticated-user-email");
  const assertion = request.headers.get("cf-access-jwt-assertion");
  const headerUserId = request.headers.get("x-dev-user-id");

  let identity: string | null = null;
  let displayName: string | null = null;

  if (email) {
    identity = email.toLowerCase();
    displayName = email.split("@")[0] ?? email;
  } else if (assertion) {
    const payload = decodeJwtPayload(assertion);
    const sub = typeof payload?.sub === "string" ? payload.sub : null;
    const jwtEmail =
      typeof payload?.email === "string" ? payload.email.toLowerCase() : null;
    identity = jwtEmail ?? sub;
    displayName =
      (typeof payload?.name === "string" && payload.name) ||
      jwtEmail?.split("@")[0] ||
      sub;
  } else if (headerUserId && (await headerAuthAllowed())) {
    identity = headerUserId;
    displayName = headerUserId;
  }

  if (!identity) return null;

  const existing = await loadUser(identity);
  if (existing) return existing;

  // Auto-provision non-seed Access identities as non-admin players
  const db = await getDb();
  await db
    .prepare("INSERT OR IGNORE INTO users (id, name, is_admin) VALUES (?, ?, 0)")
    .bind(identity, displayName ?? identity)
    .run();

  return loadUser(identity);
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (!user.is_admin) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
