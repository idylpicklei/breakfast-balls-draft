import { getAuthUser } from "@/lib/auth";
import { error, handleRouteError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return error("Unauthorized", 401);
    return json(user);
  } catch (err) {
    return handleRouteError(err);
  }
}
