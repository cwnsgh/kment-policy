-- policy_init.sql 이후 적용하거나, 기존 DB에만 추가할 때 실행
-- 예전 policy_snapshots 쓰던 경우(선택): drop table if exists policy.policy_snapshots;

create table if not exists policy.policy_text_presets (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null,
  title text not null default '1안',
  privacy_all text default '',
  terms_using_mall text default '',
  privacy_join text default '',
  withdrawal text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_text_presets_mall_id_idx
  on policy.policy_text_presets (mall_id);

grant all on table policy.policy_text_presets to service_role;

alter table policy.policy_text_presets enable row level security;
