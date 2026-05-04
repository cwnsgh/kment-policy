import "server-only";

import { cookies } from "next/headers";
import { verifySession, COOKIE_NAME, type SessionData } from "@/lib/auth/session";

export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySession(token);
}
