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

-- 슬롯별 본문 '번' (이용약관·개인정보 등 각각 여러 개)
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

-- 슬롯별 variant 변경 히스토리 (create / update 직전 스냅샷 / delete 직전 스냅샷)
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
