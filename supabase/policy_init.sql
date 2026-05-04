-- Supabase SQL Editor에서 한 번 실행 (kment-policy 전용 스키마)
-- kment-punding의 `punding` 스키마와 분리됩니다.

create schema if not exists policy;

create table if not exists policy.oauth_states (
  state text primary key,
  mall_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists policy.shops (
  mall_id text primary key,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  user_id text,
  shop_no text,
  scopes text,
  issued_at timestamptz,
  shop_name text,
  primary_domain text,
  base_domain text,
  country text,
  country_code text,
  enabled boolean default true,
  created_at timestamptz,
  updated_at timestamptz
);

-- anon 역할이 앱에서 shops를 읽을 수 있게 (getShopByMallId)
grant usage on schema policy to anon, authenticated, service_role;
grant select on table policy.shops to anon, authenticated;
grant all on table policy.shops to service_role;
grant all on table policy.oauth_states to service_role;

alter table policy.oauth_states enable row level security;
alter table policy.shops enable row level security;

-- 클라이언트 getShopByMallId(anon)용 — 운영 시 mall 단위로 좁히는 것을 권장
create policy "shops_select_anon"
  on policy.shops
  for select
  to anon
  using (true);
