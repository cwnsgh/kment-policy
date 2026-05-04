-- variant 본문·라벨이 바뀔 때마다 스냅샷 (대시보드 히스토리)
-- Supabase SQL Editor에서 policy 스키마가 이미 있는 DB에 실행

create table if not exists policy.policy_variant_revisions (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null,
  variant_id uuid not null,
  slot text not null,
  label text not null,
  body text not null default '',
  action text not null,
  created_at timestamptz not null default now(),
  constraint policy_variant_revisions_slot_chk check (
    slot in (
      'privacy_all',
      'terms_using_mall',
      'privacy_join',
      'withdrawal'
    )
  ),
  constraint policy_variant_revisions_action_chk check (
    action in ('create', 'update', 'delete')
  )
);

create index if not exists policy_variant_revisions_mall_created_idx
  on policy.policy_variant_revisions (mall_id, created_at desc);

create index if not exists policy_variant_revisions_variant_created_idx
  on policy.policy_variant_revisions (variant_id, created_at desc);

grant all on table policy.policy_variant_revisions to service_role;

alter table policy.policy_variant_revisions enable row level security;
