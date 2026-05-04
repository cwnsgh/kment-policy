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
  const payload = {
    shop_no: shopNo,
    request: {
      privacy_all: request.privacy_all ?? "",
      terms_using_mall: request.terms_using_mall ?? "",
      use_privacy_join: request.use_privacy_join,
      privacy_join: request.privacy_join ?? "",
      use_withdrawal: request.use_withdrawal,
      required_withdrawal: request.required_withdrawal,
      withdrawal: request.withdrawal ?? "",
    },
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
