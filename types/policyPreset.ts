/** 카페24 PUT `request` 본문 (플래그 + 네 본문) */
export interface PolicyRequestBody {
  privacy_all?: string;
  terms_using_mall?: string;
  use_privacy_join: "T" | "F";
  privacy_join?: string;
  use_withdrawal: "T" | "F";
  required_withdrawal: "T" | "F";
  withdrawal?: string;
}

export const POLICY_SLOTS = [
  "privacy_all",
  "terms_using_mall",
  "privacy_join",
  "withdrawal",
] as const;

export type PolicySlot = (typeof POLICY_SLOTS)[number];

/** 슬롯마다 따로 저장하는 한 줄(1번, 2번 …) */
export interface PolicyTextVariantRow {
  id: string;
  mall_id: string;
  slot: PolicySlot;
  label: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/** PUT 조합: null/빈 = 해당 슬롯은 GET 현재값 유지 */
export type PolicySlotPicks = Partial<
  Record<PolicySlot, string | null | undefined>
>;

export const SLOT_LABELS: Record<PolicySlot, string> = {
  privacy_all: "개인정보처리방침 (전체)",
  terms_using_mall: "쇼핑몰 이용약관",
  privacy_join: "회원가입 개인정보처리방침",
  withdrawal: "청약철회",
};

export type VariantRevisionAction = "create" | "update" | "delete";

export interface VariantRevisionRow {
  id: string;
  mall_id: string;
  variant_id: string;
  slot: PolicySlot;
  label: string;
  body: string;
  action: VariantRevisionAction;
  created_at: string;
}

export const REVISION_ACTION_LABELS: Record<VariantRevisionAction, string> = {
  create: "추가됨",
  update: "수정 직전",
  delete: "삭제 직전",
};
