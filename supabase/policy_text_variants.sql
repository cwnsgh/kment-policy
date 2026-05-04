-- 기존 DB에만 추가 시 실행. 예전 테이블 정리(선택):
-- drop table if exists policy.policy_text_presets;
-- drop table if exists policy.policy_snapshots;

create table if not exists policy.policy_text_variants (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null,
  slot text not null,
  label text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_text_variants_slot_chk check (
    slot in (
      'privacy_all',
      'terms_using_mall',
      'privacy_join',
      'withdrawal'
    )
  ),
  constraint policy_text_variants_mall_slot_label_uk unique (mall_id, slot, label)
);

create index if not exists policy_text_variants_mall_slot_idx
  on policy.policy_text_variants (mall_id, slot);

grant all on table policy.policy_text_variants to service_role;

alter table policy.policy_text_variants enable row level security;

-- 변경 히스토리: supabase/policy_variant_revisions.sql 실행
