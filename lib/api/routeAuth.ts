import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function requireMallSession(
  req: NextRequest,
  mallId: string | null
): Promise<NextResponse | null> {
  if (!mallId) {
    return NextResponse.json({ error: "mall_id required" }, { status: 400 });
  }
  const session = await getSession(req);
  if (!session?.mall_id || session.mall_id !== mallId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
