import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";
import { logVariantRevision } from "@/lib/policy/variantRevisions";
import {
  MANAGED_POLICY_SLOT,
  POLICY_SLOTS,
  type PolicySlot,
} from "@/types/policyPreset";

function table() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_text_variants");
}

function isSlot(s: string): s is PolicySlot {
  return (POLICY_SLOTS as readonly string[]).includes(s);
}

/** 쇼핑몰 이용약관(terms_using_mall) 저장본만 조회 */
export async function GET(req: NextRequest) {
  const mall_id = req.nextUrl.searchParams.get("mall_id");
  const auth = await requireMallSession(req, mall_id);
  if (auth) return auth;

  const q = table()
    .select("*")
    .eq("mall_id", mall_id!)
    .eq("slot", MANAGED_POLICY_SLOT)
    .order("updated_at", {
      ascending: false,
    });

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ variants: data ?? [] });
}

/** 수동으로 한 슬롯·한 라벨 본문 저장 */
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
    if (slot !== MANAGED_POLICY_SLOT) {
      return NextResponse.json(
        {
          error:
            "이 앱은 쇼핑몰 이용약관(terms_using_mall)만 저장할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const label = String(body.label ?? "").trim() || "1번";
    const row = {
      mall_id: mall_id!,
      slot,
      label,
      body: String(body.body ?? ""),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await table().insert(row).select("*").single();

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
