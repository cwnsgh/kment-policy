import type { Cafe24PolicyPayload } from "@/lib/api/cafe24Policy";
import type { PolicyRequestBody, PolicySlot } from "@/types/policyPreset";

export function normalizeTf(v: unknown, fallback: "T" | "F" = "T"): "T" | "F" {
  const s = String(v ?? "").toUpperCase();
  if (s === "F") return "F";
  if (s === "T") return "T";
  return fallback;
}

/** 카페24 GET policy → PUT request 형태로 변환 */
export function payloadToRequestBody(p: Cafe24PolicyPayload): PolicyRequestBody {
  return {
    privacy_all: p.privacy_all ?? "",
    terms_using_mall: p.terms_using_mall ?? "",
    use_privacy_join: normalizeTf(p.use_privacy_join),
    privacy_join: p.privacy_join ?? "",
    use_withdrawal: normalizeTf(p.use_withdrawal),
    required_withdrawal: normalizeTf(p.required_withdrawal),
    withdrawal: p.withdrawal ?? "",
  };
}

export function getLiveSlotBody(
  live: Cafe24PolicyPayload,
  slot: PolicySlot
): string {
  const v = live[slot as keyof Cafe24PolicyPayload];
  return typeof v === "string" ? v : "";
}

/**
 * 카페24 검증: 플래그가 끄면 해당 본문을 PUT에 실으면 422가 날 수 있음.
 * (예: use_withdrawal=F 인데 withdrawal HTML 전송 → Cancellation Policy 미사용 오류)
 */
export function enforcePolicyFlagsAgainstBodies(
  body: PolicyRequestBody
): PolicyRequestBody {
  let out = { ...body };
  if (out.use_privacy_join === "F") {
    out = { ...out, privacy_join: "" };
  }
  if (out.use_withdrawal === "F") {
    out = {
      ...out,
      withdrawal: "",
      required_withdrawal: "F",
    };
  }
  return out;
}

/** 슬롯별 최종 본문(이미 pick 반영)으로 PUT 본문 생성 */
export function mergeLiveWithResolvedBodies(
  live: Cafe24PolicyPayload,
  resolved: Record<PolicySlot, string>
): PolicyRequestBody {
  const base = payloadToRequestBody(live);
  const merged: PolicyRequestBody = {
    ...base,
    privacy_all: resolved.privacy_all,
    terms_using_mall: resolved.terms_using_mall,
    privacy_join: resolved.privacy_join,
    withdrawal: resolved.withdrawal,
  };
  return enforcePolicyFlagsAgainstBodies(merged);
}
