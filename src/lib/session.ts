import { getSecret } from "@/lib/db/client";

export const SESSION_COOKIE = "bb_session";
const SESSION_DAYS = 30;

interface SessionPayload {
  userId: string;
  exp: number;
}

function bufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Uint8Array.from(bytes);
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(sig));
}

async function hmacVerify(message: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      bufferSource(fromBase64Url(signature)),
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}

async function getSessionSecret(): Promise<string | null> {
  return (await getSecret("SESSION_SECRET" as keyof CloudflareEnv)) ?? null;
}

export async function createSessionToken(userId: string): Promise<string | null> {
  const secret = await getSessionSecret();
  if (!secret) return null;

  const payload: SessionPayload = {
    userId,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(body, secret);
  return `${body}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<string | null> {
  const secret = await getSessionSecret();
  if (!secret) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!(await hmacVerify(body, sig, secret))) return null;

  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.userId || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE && rest.length > 0) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const flags = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export function requestIsSecure(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  return request.headers.get("x-forwarded-proto") === "https";
}
