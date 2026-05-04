import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ensureValidAccessToken } from "@/lib/api/ensureValidAccessToken";
import { callCafe24Api } from "@/lib/api/cafe24Api";

/**
 * 예시: 세션 mall과 일치할 때만 `ensureValidAccessToken` → 카페24 `admin/store` 호출
 * (실제 기능 붙일 때 이 패턴을 복사하면 됩니다.)
 */
export async function GET(req: NextRequest) {
  const mall_id = req.nextUrl.searchParams.get("mall_id");
  if (!mall_id) {
    return NextResponse.json({ error: "mall_id required" }, { status: 400 });
  }

  const session = await getSession(req);
  if (!session || session.mall_id !== mall_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await ensureValidAccessToken(mall_id);
  if (token === null) {
    return NextResponse.json({ error: "No shop or token" }, { status: 404 });
  }
  if (typeof token === "object" && "reinstallRequired" in token) {
    return NextResponse.json(
      {
        error: "reinstall_required",
        message: "앱 재연동(OAuth)이 필요합니다.",
      },
      { status: 403 },
    );
  }

  const res = await callCafe24Api({
    mallId: mall_id,
    endpoint: "admin/store?shop_no=1",
    method: "GET",
    accessToken: token,
  });

  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  return NextResponse.json(res.data);
}
