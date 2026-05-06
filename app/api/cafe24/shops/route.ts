import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ensureValidAccessToken } from "@/lib/api/ensureValidAccessToken";
import { callCafe24Api } from "@/lib/api/cafe24Api";
import type { Cafe24ShopListItem } from "@/types/cafe24Shop";

function parseBoolish(v: unknown): boolean {
  return v === true || v === "T" || v === "t" || v === 1 || v === "1";
}

function parseShopsFromCafe24Body(data: unknown): Cafe24ShopListItem[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const raw = root.shops;
  if (!Array.isArray(raw)) return [];

  const out: Cafe24ShopListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const shop_no = Number(o.shop_no);
    if (!Number.isFinite(shop_no) || shop_no < 1) continue;
    const nameRaw = o.shop_name;
    const shop_name =
      typeof nameRaw === "string" && nameRaw.trim()
        ? nameRaw.trim()
        : `쇼핑몰 ${shop_no}`;
    const lang = o.language_name;
    const language_name =
      typeof lang === "string" && lang.trim() ? lang.trim() : null;
    out.push({
      shop_no,
      shop_name,
      language_name,
      default_shop: parseBoolish(o.default_shop),
      active: parseBoolish(o.active) || o.active === undefined,
    });
  }
  out.sort((a, b) => a.shop_no - b.shop_no);
  return out;
}

/**
 * 멀티쇼핑몰 목록 (카페24 `GET admin/shops`, SCOPE: mall.read_store)
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
    endpoint: "admin/shops",
    method: "GET",
    accessToken: token,
  });

  if (!res.success) {
    return NextResponse.json(
      { error: res.error ?? "shops fetch failed", shops: [] as Cafe24ShopListItem[] },
      { status: 502 },
    );
  }

  const shops = parseShopsFromCafe24Body(res.data);
  return NextResponse.json({ shops });
}
