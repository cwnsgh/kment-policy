import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";

function table() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_put_snapshots");
}

/** 카페24에 이용약관 PUT으로 반영할 때마다 쌓인 스냅샷 */
export async function GET(req: NextRequest) {
  const mall_id = req.nextUrl.searchParams.get("mall_id");
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit")) || 80, 1),
    200
  );

  const auth = await requireMallSession(req, mall_id);
  if (auth) return auth;

  const { data, error } = await table()
    .select("*")
    .eq("mall_id", mall_id!)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ snapshots: data ?? [] });
}
