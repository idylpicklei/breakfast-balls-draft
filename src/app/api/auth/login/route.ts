import { authenticateUsernamePassword } from "@/lib/auth";
import { error, handleRouteError, json, readJson } from "@/lib/http";
import {
  buildSessionCookie,
  createSessionToken,
  requestIsSecure,
} from "@/lib/session";

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJson<LoginBody>(request);
    const username = body.username?.trim();
    const password = body.password ?? "";

    if (!username || !password) {
      return error("Username and password are required");
    }

    const user = await authenticateUsernamePassword(username, password);
    if (!user) {
      return error("Invalid username or password", 401);
    }

    const token = await createSessionToken(user.id);
    if (!token) {
      return error("Session secret not configured", 500);
    }

    const response = json({ user });
    response.headers.set(
      "Set-Cookie",
      buildSessionCookie(token, requestIsSecure(request)),
    );
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
