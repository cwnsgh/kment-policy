import type { Cafe24PolicyPayload } from "@/lib/api/cafe24Policy";
import type { PolicyRequestBody, PolicySlot } from "@/types/policyPreset";

/**
 * 카페24 policy 플래그. API가 "T"/"F" 외 값을 줄 수 있어 true/false 계열만 넓게 인식.
 */
export function normalizePolicyBooleanStrict(v: unknown): "T" | "F" {
  const s = String(v ?? "").trim().toUpperCase();
  if (
    s === "T" ||
    s === "Y" ||
    s === "1" ||
    s === "YES" ||
    s === "TRUE"
  ) {
    return "T";
  }
  if (s === "F" || s === "N" || s === "0" || s === "NO" || s === "FALSE") {
    return "F";
  }
  return "F";
}

/** 카페24 GET policy → PUT request 형태로 변환 */
export function payloadToRequestBody(p: Cafe24PolicyPayload): PolicyRequestBody {
  const usePrivacyJoin = normalizePolicyBooleanStrict(p.use_privacy_join);
  const useWithdrawal = normalizePolicyBooleanStrict(p.use_withdrawal);
  return {
    privacy_all: p.privacy_all ?? "",
    terms_using_mall: p.terms_using_mall ?? "",
    use_privacy_join: usePrivacyJoin,
    privacy_join: p.privacy_join ?? "",
    use_withdrawal: useWithdrawal,
    required_withdrawal:
      useWithdrawal === "T"
        ? normalizePolicyBooleanStrict(p.required_withdrawal)
        : "F",
    withdrawal: useWithdrawal === "T" ? (p.withdrawal ?? "") : "",
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
