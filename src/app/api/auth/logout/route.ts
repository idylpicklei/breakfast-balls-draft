import { clearSessionCookie, requestIsSecure } from "@/lib/session";
import { json } from "@/lib/http";

export async function POST(request: Request) {
  const response = json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    clearSessionCookie(requestIsSecure(request)),
  );
  return response;
}
