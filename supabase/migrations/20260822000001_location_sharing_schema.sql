-- 参加者(匿名認証のuidをそのままidとして使用)
create table if not exists public.participants (
  id uuid primary key references auth.users(id) on delete cascade,
  display_code text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists public.participant_code_seq;

alter table public.participants
  alter column display_code set default lpad(nextval('public.participant_code_seq')::text, 3, '0');

-- 位置データ
create table if not exists public.location_points (
  id uuid primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  altitude double precision,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists location_points_participant_id_recorded_at_idx
  on public.location_points (participant_id, recorded_at desc);

-- 管理画面を閲覧できるユーザー
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- 保持期間などの設定値(実証版では1行のみ使用)
create table if not exists public.app_config (
  id boolean primary key default true check (id),
  location_retention_days integer not null default 14
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;

create or replace function public.cleanup_old_location_points()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.location_points
  where recorded_at < now() - (
    select (location_retention_days || ' days')::interval from public.app_config
  );
$$;

alter table public.participants enable row level security;
alter table public.location_points enable row level security;
alter table public.admins enable row level security;
alter table public.app_config enable row level security;

-- participants: 本人のみ作成・閲覧可能
create policy "participants_select_own" on public.participants
  for select using (auth.uid() = id);

create policy "participants_insert_own" on public.participants
  for insert with check (auth.uid() = id);

-- participants: 管理者は全件閲覧可能
create policy "participants_select_admin" on public.participants
  for select using (exists (select 1 from public.admins where user_id = auth.uid()));

-- location_points: 本人のみ自分のIDで登録・閲覧可能
create policy "location_points_insert_own" on public.location_points
  for insert with check (auth.uid() = participant_id);

create policy "location_points_select_own" on public.location_points
  for select using (auth.uid() = participant_id);

-- location_points: 管理者は全件閲覧可能
create policy "location_points_select_admin" on public.location_points
  for select using (exists (select 1 from public.admins where user_id = auth.uid()));

-- admins: 自分がadminかどうかのみ確認可能
create policy "admins_select_self" on public.admins
  for select using (auth.uid() = user_id);

-- app_config: 誰でも読み取り可能(閾値表示などクライアント側で使うため)
create policy "app_config_select_all" on public.app_config
  for select using (true);
