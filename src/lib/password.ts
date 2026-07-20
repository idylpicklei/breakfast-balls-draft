const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;

function bufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Uint8Array.from(bytes);
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  const salt = bufferSource(fromBase64(parts[2]));
  const expected = fromBase64(parts[3]);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  const actual = new Uint8Array(derived);
  if (actual.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** For local tooling only — not used at runtime. */
export async function hashPassword(password: string): Promise<string> {
  const salt = bufferSource(crypto.getRandomValues(new Uint8Array(16)));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(new Uint8Array(derived))}`;
}
