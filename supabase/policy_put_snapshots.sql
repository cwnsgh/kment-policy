-- 카페24 admin/policy PUT 성공 시마다 남기는 반영 스냅샷
-- Supabase SQL Editor에서 policy 스키마가 이미 있는 DB에 실행

create table if not exists policy.policy_put_snapshots (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null,
  shop_no int not null default 1,
  variant_id uuid null,
  variant_label text null,
  terms_body text not null,
  created_at timestamptz not null default now()
);

create index if not exists policy_put_snapshots_mall_created_idx
  on policy.policy_put_snapshots (mall_id, created_at desc);

grant all on table policy.policy_put_snapshots to service_role;

alter table policy.policy_put_snapshots enable row level security;
