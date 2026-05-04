import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";
import { ensureValidAccessToken } from "@/lib/api/ensureValidAccessToken";
import { fetchCafe24Policy, putCafe24Policy } from "@/lib/api/cafe24Policy";
import {
  getLiveSlotBody,
  mergeLiveWithResolvedBodies,
} from "@/lib/policy/mapCafe24";
import {
  POLICY_SLOTS,
  type PolicySlot,
  type PolicySlotPicks,
} from "@/types/policyPreset";

function variantsTable() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_text_variants");
}

/** 카페24 현재 약관 전체 */
export async function GET(req: NextRequest) {
  const mall_id = req.nextUrl.searchParams.get("mall_id");
  const shop_no = Number(req.nextUrl.searchParams.get("shop_no")) || 1;
  const auth = await requireMallSession(req, mall_id);
  if (auth) return auth;

  const token = await ensureValidAccessToken(mall_id!);
  if (token === null) {
    return NextResponse.json({ error: "No token" }, { status: 404 });
  }
  if (typeof token === "object" && "reinstallRequired" in token) {
    return NextResponse.json({ error: "reinstall_required" }, { status: 403 });
  }

  const live = await fetchCafe24Policy(mall_id!, token, shop_no);
  if (!live?.policy) {
    return NextResponse.json(
      { error: "Cafe24 policy fetch failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({ policy: live.policy });
}

/**
 * picks: 슬롯마다 variant id 또는 빈 문자열(현재 쇼핑몰 GET 값 유지)
 * → GET → 조합 → PUT 한 번
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const mall_id = body.mall_id as string | undefined;
    const shop_no = Number(body.shop_no) || 1;
    const picks = (body.picks ?? {}) as PolicySlotPicks;

    const auth = await requireMallSession(req, mall_id ?? null);
    if (auth) return auth;

    const token = await ensureValidAccessToken(mall_id!);
    if (token === null) {
      return NextResponse.json({ error: "No token" }, { status: 404 });
    }
    if (typeof token === "object" && "reinstallRequired" in token) {
      return NextResponse.json({ error: "reinstall_required" }, { status: 403 });
    }

    const liveRes = await fetchCafe24Policy(mall_id!, token, shop_no);
    if (!liveRes?.policy) {
      return NextResponse.json(
        { error: "Cafe24 policy fetch failed" },
        { status: 502 }
      );
    }
    const live = liveRes.policy;

    const ids = POLICY_SLOTS.map((s) => picks[s])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    let rows: { id: string; slot: string; body: string }[] = [];
    if (ids.length) {
      const { data, error } = await variantsTable()
        .select("id, slot, body")
        .eq("mall_id", mall_id!)
        .in("id", ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rows = (data ?? []) as { id: string; slot: string; body: string }[];
    }

    const resolved = {} as Record<PolicySlot, string>;
    for (const slot of POLICY_SLOTS) {
      const pick = picks[slot];
      if (typeof pick === "string" && pick.trim()) {
        const row = rows.find((r) => r.id === pick && r.slot === slot);
        if (!row) {
          return NextResponse.json(
            { error: `variant not found for slot ${slot}` },
            { status: 400 }
          );
        }
        resolved[slot] = row.body;
      } else {
        resolved[slot] = getLiveSlotBody(live, slot);
      }
    }

    const requestBody = mergeLiveWithResolvedBodies(live, resolved);
    const result = await putCafe24Policy(mall_id!, token, shop_no, requestBody);
    if (!result?.policy) {
      return NextResponse.json(
        { error: "Cafe24 policy update failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ policy: result.policy });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
