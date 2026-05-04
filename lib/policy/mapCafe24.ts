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

/** 슬롯별 최종 본문(이미 pick 반영)으로 PUT 본문 생성 */
export function mergeLiveWithResolvedBodies(
  live: Cafe24PolicyPayload,
  resolved: Record<PolicySlot, string>
): PolicyRequestBody {
  const base = payloadToRequestBody(live);
  return {
    ...base,
    privacy_all: resolved.privacy_all,
    terms_using_mall: resolved.terms_using_mall,
    privacy_join: resolved.privacy_join,
    withdrawal: resolved.withdrawal,
  };
}
