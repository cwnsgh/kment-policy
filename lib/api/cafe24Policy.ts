/**
 * 카페24 Admin Policy API (GET / PUT admin/policy)
 */

import { config } from "@/lib/config/env";
import { logger } from "@/lib/utils/logger";
import type { PolicyRequestBody } from "@/types/policyPreset";

export interface Cafe24PolicyPayload {
  shop_no: number;
  privacy_all?: string;
  terms_using_mall?: string;
  use_privacy_join: string;
  privacy_join?: string;
  use_withdrawal: string;
  required_withdrawal: string;
  withdrawal?: string;
}

function policyHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Cafe24-Api-Version": config.cafe24.apiVersion,
  };
}

export type FetchCafe24PolicyResult =
  | { ok: true; policy: Cafe24PolicyPayload }
  | { ok: false; status: number; body: unknown };

export async function fetchCafe24Policy(
  mallId: string,
  accessToken: string,
  shopNo: number = 1
): Promise<FetchCafe24PolicyResult> {
  const url = `https://${mallId}.cafe24api.com/api/v2/admin/policy?shop_no=${shopNo}`;
  const res = await fetch(url, {
    method: "GET",
    headers: policyHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    logger.error("admin/policy GET 실패", { mallId, status: res.status, body });
    return { ok: false, status: res.status, body };
  }
  const parsed = body as { policy?: Cafe24PolicyPayload } | null;
  if (!parsed?.policy) {
    logger.error("admin/policy GET에 policy 필드 없음", { mallId, body });
    return { ok: false, status: res.status, body };
  }
  return { ok: true, policy: parsed.policy };
}

export type PutCafe24PolicyResult =
  | { ok: true; policy: Cafe24PolicyPayload }
  | { ok: false; status: number; body: unknown };

export async function putCafe24Policy(
  mallId: string,
  accessToken: string,
  shopNo: number,
  request: PolicyRequestBody
): Promise<PutCafe24PolicyResult> {
  const url = `https://${mallId}.cafe24api.com/api/v2/admin/policy`;
  /**
   * 철회 미사용(F)인데 required_withdrawal/withdrawal까지내면
   * "Cancellation Policy…" 422가 나는 몰이 있어, 철회 OFF일 땐 해당 키를 생략.
   * (문서 예시는 전 필드지만, 실제 API는 부분 생략을 허용하는 경우가 있음)
   */
  /** 카페24 기본은 S(표준); 앱 PUT은 사용자 정의 반영이므로 C 고정. */
  const requestPayload: Record<string, string> = {
    save_type: "C",
    privacy_all: request.privacy_all ?? "",
    terms_using_mall: request.terms_using_mall ?? "",
    use_privacy_join: request.use_privacy_join,
    privacy_join: request.privacy_join ?? "",
  };
  if (request.use_withdrawal === "T") {
    requestPayload.use_withdrawal = "T";
    requestPayload.required_withdrawal = request.required_withdrawal;
    requestPayload.withdrawal = request.withdrawal ?? "";
  } else {
    requestPayload.use_withdrawal = "F";
  }

  const payload = {
    shop_no: shopNo,
    request: requestPayload,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: policyHeaders(accessToken),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    logger.error("admin/policy PUT 실패", { mallId, status: res.status, data });
    return { ok: false, status: res.status, body: data };
  }
  const parsed = data as { policy?: Cafe24PolicyPayload } | null;
  if (!parsed?.policy) {
    logger.error("admin/policy PUT 응답에 policy 없음", { mallId, data });
    return { ok: false, status: res.status, body: data };
  }
  return { ok: true, policy: parsed.policy };
}
