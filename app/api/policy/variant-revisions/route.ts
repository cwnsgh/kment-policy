import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";
import { POLICY_SLOTS, type PolicySlot } from "@/types/policyPreset";

function table() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_variant_revisions");
}

function isSlot(s: string): s is PolicySlot {
  return (POLICY_SLOTS as readonly string[]).includes(s);
}

/** mall 단위 변경 히스토리 (최신순) */
export async function GET(req: NextRequest) {
  const mall_id = req.nextUrl.searchParams.get("mall_id");
  const variant_id = req.nextUrl.searchParams.get("variant_id");
  const slot = req.nextUrl.searchParams.get("slot");
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit")) || 80, 1),
    200
  );

  const auth = await requireMallSession(req, mall_id);
  if (auth) return auth;

  let q = table()
    .select("*")
    .eq("mall_id", mall_id!)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (variant_id) {
    q = q.eq("variant_id", variant_id);
  }
  if (slot) {
    if (!isSlot(slot)) {
      return NextResponse.json({ error: "invalid slot" }, { status: 400 });
    }
    q = q.eq("slot", slot);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ revisions: data ?? [] });
}
