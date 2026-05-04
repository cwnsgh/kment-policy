import { supabaseAdmin, POLICY_SCHEMA } from "@/lib/db";
import type { VariantRevisionAction } from "@/types/policyPreset";

function revisionsTable() {
  return supabaseAdmin.schema(POLICY_SCHEMA).from("policy_variant_revisions");
}

/** 변경 히스토리 한 건 (실패해도 본 작업은 막지 않음) */
export async function logVariantRevision(params: {
  mall_id: string;
  variant_id: string;
  slot: string;
  label: string;
  body: string;
  action: VariantRevisionAction;
}): Promise<void> {
  const { error } = await revisionsTable().insert({
    mall_id: params.mall_id,
    variant_id: params.variant_id,
    slot: params.slot,
    label: params.label,
    body: params.body,
    action: params.action,
  });
  if (error) {
    console.error("[policy] variant revision log failed", error.message);
  }
}
