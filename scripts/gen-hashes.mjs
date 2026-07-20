const ITER = 100_000;
const KEY_LEN = 32;

function toB64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
      iterations: ITER,
    },
    keyMaterial,
    KEY_LEN * 8,
  );
  return `pbkdf2:${ITER}:${toB64(salt)}:${toB64(new Uint8Array(derived))}`;
}

const users = [
  ["MinJungKyu", "mjk2026"],
  ["PaulHawk", "hawk2026"],
  ["PigTank", "pig2026"],
  ["Dylpickle", "balls2026"],
];

for (const [username, password] of users) {
  console.log(`${username}=${await hashPassword(password)}`);
}
