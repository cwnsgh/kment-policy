import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import { requireMallSession } from "@/lib/api/routeAuth";
import { ensureValidAccessToken } from "@/lib/api/ensureValidAccessToken";
import { fetchCafe24Policy, putCafe24Policy } from "@/lib/api/cafe24Policy";
import {
  getLiveSlotBody,
  mergeLiveWithResolvedBodies,
} from "@/lib/policy/mapCafe24";
import { logger } from "@/lib/utils/logger";
import {
  MANAGED_POLICY_SLOT,
  POLICY_SLOTS,
  type PolicySlot,
  type PolicySlotPicks,
  type PolicyRequestBody,
} from "@/types/policyPreset";

function summarizePolicyPut(rb: PolicyRequestBody) {
  return {
    use_privacy_join: rb.use_privacy_join,
    use_withdrawal: rb.use_withdrawal,
    required_withdrawal: rb.required_withdrawal,
    len_privacy_all: (rb.privacy_all ?? "").length,
    len_terms_using_mall: (rb.terms_using_mall ?? "").length,
    len_privacy_join: (rb.privacy_join ?? "").length,
    len_withdrawal: (rb.withdrawal ?? "").length,
  };
}

/** Vercel에서 카페24 왕복이 길 때 기본 타임아웃 방지 (플랜별 상한은 Vercel 정책 따름) */
export const maxDuration = 60;

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
  if (!live.ok) {
    return NextResponse.json(
      {
        error: "Cafe24 policy fetch failed",
        step: "cafe24_get",
        cafe24_status: live.status,
        cafe24: live.body,
        hint:
          live.status === 401
            ? "액세스 토큰이 없거나 만료됐을 수 있습니다. 앱 재설치(재인증)를 시도하세요."
            : live.status === 403
              ? "이 토큰으로 admin/policy를 호출할 권한이 없을 수 있습니다. 개발자 센터 스코프·앱 권한을 확인하세요."
              : live.status === 404
                ? "몰 아이디(mall_id) 또는 shop_no가 잘못됐을 수 있습니다."
                : "카페24 API 응답을 확인하세요. (cafe24 필드)",
      },
      { status: 502 }
    );
  }
  return NextResponse.json({ policy: live.policy });
}

/**
 * picks: 쇼핑몰 이용약관(terms_using_mall)만 variant id 가능, 나머지 슬롯은 항상 카페24 GET 유지
 * → GET → 조합 → PUT 한 번
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const mall_id = body.mall_id as string | undefined;
    const shop_no = Number(body.shop_no) || 1;
    const picksRaw = (body.picks ?? {}) as PolicySlotPicks;
    const picks: PolicySlotPicks = {};
    const only = picksRaw[MANAGED_POLICY_SLOT];
    if (typeof only === "string" && only.trim()) {
      picks[MANAGED_POLICY_SLOT] = only.trim();
    }

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
    if (!liveRes.ok) {
      return NextResponse.json(
        {
          error: "Cafe24 policy fetch failed",
          step: "cafe24_get",
          cafe24_status: liveRes.status,
          cafe24: liveRes.body,
          hint:
            liveRes.status === 401
              ? "액세스 토큰 문제 가능. 재인증 후 다시 시도하세요."
              : liveRes.status === 403
                ? "GET 권한 부족 가능. 개발자 센터 스코프를 확인하세요."
                : "PUT 전에 현재 약관을 읽어오는 단계에서 실패했습니다.",
        },
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
    if (
      requestBody.use_privacy_join === "T" &&
      !(requestBody.privacy_join ?? "").trim()
    ) {
      return NextResponse.json(
        {
          error: "privacy_join_empty",
          step: "validate_before_put",
          hint:
            "save_type C(사용자 정의)일 때 회원가입 개인정보처리방침(use_privacy_join=T) 본문이 비어 있으면 카페24가 거부합니다. 카페24 관리자에서 해당 항목에 내용을 입력한 뒤 다시 저장하세요.",
        },
        { status: 400 }
      );
    }
    logger.info("admin/policy PUT 시도", {
      mall_id,
      shop_no,
      save_type: "C",
      ...summarizePolicyPut(requestBody),
    });
    const result = await putCafe24Policy(mall_id!, token, shop_no, requestBody);
    if (!result.ok) {
      logger.warn("admin/policy PUT 실패", {
        mall_id,
        shop_no,
        save_type: "C",
        status: result.status,
        ...summarizePolicyPut(requestBody),
        cafe24: result.body,
      });
      return NextResponse.json(
        {
          error: "Cafe24 policy update failed",
          step: "cafe24_put",
          cafe24_status: result.status,
          cafe24: result.body,
          hint:
            result.status === 401
              ? "액세스 토큰 문제 가능."
              : result.status === 403
                ? "약관 수정(쓰기) 권한이 없을 수 있습니다. mall.write_application 등 쓰기 스코프·앱 권한을 확인하세요."
                : result.status === 400
                  ? "요청 본문 검증 실패일 수 있습니다. 카페24 에러 메시지(cafe24)를 확인하세요."
                  : result.status === 422
                    ? "플래그·HTML·save_type C 조합 검증 실패입니다. 메시지에 privacy_join/withdrawal 등이 나오면 관리자에서 해당 본문을 채우거나, 가입 개인정보·철회 사용 여부와 본문이 맞는지 확인하세요."
                    : "카페24 admin/policy PUT 응답을 확인하세요.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ policy: result.policy });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
