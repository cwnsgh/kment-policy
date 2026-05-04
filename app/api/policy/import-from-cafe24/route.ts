import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";
import { logVariantRevision } from "@/lib/policy/variantRevisions";
import { ensureValidAccessToken } from "@/lib/api/ensureValidAccessToken";
import { fetchCafe24Policy } from "@/lib/api/cafe24Policy";
import { getLiveSlotBody } from "@/lib/policy/mapCafe24";
import { POLICY_SLOTS, type PolicySlot } from "@/types/policyPreset";

function table() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_text_variants");
}

function isSlot(s: string): s is PolicySlot {
  return (POLICY_SLOTS as readonly string[]).includes(s);
}

/** 카페24 GET에서 한 슬롯 본문만 읽어 새 variant로 저장 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mall_id = body.mall_id as string | undefined;
    const auth = await requireMallSession(req, mall_id ?? null);
    if (auth) return auth;

    const slot = body.slot as string;
    if (!isSlot(slot)) {
      return NextResponse.json({ error: "invalid slot" }, { status: 400 });
    }

    const shop_no = Number(body.shop_no) || 1;
    const label =
      String(body.label ?? "").trim() ||
      `카페24 ${new Date().toLocaleString("ko-KR")}`;

    const token = await ensureValidAccessToken(mall_id!);
    if (token === null) {
      return NextResponse.json({ error: "No token" }, { status: 404 });
    }
    if (typeof token === "object" && "reinstallRequired" in token) {
      return NextResponse.json({ error: "reinstall_required" }, { status: 403 });
    }

    const live = await fetchCafe24Policy(mall_id!, token, shop_no);
    if (!live.ok) {
      return NextResponse.json(
        {
          error: "Cafe24 policy fetch failed",
          cafe24_status: live.status,
          cafe24: live.body,
        },
        { status: 502 }
      );
    }

    const text = getLiveSlotBody(live.policy, slot);

    const { data, error } = await table()
      .insert({
        mall_id: mall_id!,
        slot,
        label,
        body: text,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    void logVariantRevision({
      mall_id: mall_id!,
      variant_id: data.id as string,
      slot,
      label: data.label as string,
      body: data.body as string,
      action: "create",
    });
    return NextResponse.json({ variant: data });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
