-- Supabase schema for FamTree Cloud
create extension if not exists "pgcrypto";

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  is_public boolean not null default true,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.clan_memberships (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ("admin", "member")),
  created_at timestamptz not null default now(),
  unique (clan_id, user_id)
);

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans on delete cascade,
  branch_root_id uuid references public.persons,
  full_name text not null,
  birth_date date,
  death_date date,
  is_alive boolean not null default true,
  gender text,
  photo_url text,
  notes text,
  stats jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans on delete cascade,
  parent_id uuid not null references public.persons on delete cascade,
  child_id uuid not null references public.persons on delete cascade,
  relationship_type text not null default 'parent' check (relationship_type in ('parent', 'partner')),
  created_at timestamptz not null default now()
);

create table if not exists public.person_positions (
  person_id uuid primary key references public.persons on delete cascade,
  clan_id uuid not null references public.clans on delete cascade,
  x numeric not null default 0,
  y numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.branch_owners (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  branch_root_id uuid not null references public.persons on delete cascade,
  created_at timestamptz not null default now(),
  unique (clan_id, user_id, branch_root_id)
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans on delete cascade,
  created_by uuid references auth.users,
  creator_email text,
  target_type text not null check (target_type in ('person', 'relationship', 'position')),
  target_id uuid,
  action text not null check (action in ('create', 'update', 'delete')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.change_events (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans on delete cascade,
  actor_id uuid references auth.users,
  actor_name text,
  target_type text not null check (target_type in ('person', 'relationship', 'position')),
  target_id uuid,
  action text not null check (action in ('create', 'update', 'delete')),
  diff jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.set_branch_root()
returns trigger as $$
begin
  if new.branch_root_id is null then
    new.branch_root_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_person_updated_at on public.persons;
create trigger set_person_updated_at
before update on public.persons
for each row execute procedure public.set_updated_at();

drop trigger if exists set_person_branch_root on public.persons;
create trigger set_person_branch_root
before insert on public.persons
for each row execute procedure public.set_branch_root();

create or replace function public.is_clan_member(target_clan uuid)
returns boolean as $$
  select exists (
    select 1 from public.clan_memberships m
    where m.clan_id = target_clan and m.user_id = auth.uid()
  );
$$ language sql stable;

create or replace function public.is_clan_public(target_clan uuid)
returns boolean as $$
  select exists (
    select 1 from public.clans c
    where c.id = target_clan and c.is_public = true
  );
$$ language sql stable;

create or replace function public.is_clan_admin(target_clan uuid)
returns boolean as $$
  select exists (
    select 1 from public.clan_memberships m
    where m.clan_id = target_clan and m.user_id = auth.uid() and m.role = 'admin'
  );
$$ language sql stable;

create or replace function public.is_branch_owner(target_clan uuid, branch_root uuid)
returns boolean as $$
  select exists (
    select 1 from public.branch_owners bo
    where bo.clan_id = target_clan and bo.user_id = auth.uid()
      and bo.branch_root_id = branch_root
  );
$$ language sql stable;

alter table public.clans enable row level security;
alter table public.profiles enable row level security;
alter table public.clan_memberships enable row level security;
alter table public.persons enable row level security;
alter table public.relationships enable row level security;
alter table public.person_positions enable row level security;
alter table public.branch_owners enable row level security;
alter table public.suggestions enable row level security;
alter table public.change_events enable row level security;

create policy "clans_select_members"
on public.clans for select
using (public.is_clan_member(id) or public.is_clan_public(id));

create policy "clans_insert_self"
on public.clans for insert
with check (auth.uid() = created_by);

create policy "profiles_select_self"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid());

create policy "clans_update_admin"
on public.clans for update
using (public.is_clan_admin(id));

create policy "memberships_select_self_or_admin"
on public.clan_memberships for select
using (user_id = auth.uid() or public.is_clan_admin(clan_id));

create policy "memberships_insert_admin"
on public.clan_memberships for insert
with check (public.is_clan_admin(clan_id));

create policy "persons_select_members"
on public.persons for select
using (public.is_clan_member(clan_id) or public.is_clan_public(clan_id));

create policy "persons_insert_admin_or_owner"
on public.persons for insert
with check (
  public.is_clan_admin(clan_id)
  or public.is_branch_owner(clan_id, branch_root_id)
);

create policy "persons_update_admin_or_owner"
on public.persons for update
using (
  public.is_clan_admin(clan_id)
  or public.is_branch_owner(clan_id, branch_root_id)
);

create policy "relationships_select_members"
on public.relationships for select
using (public.is_clan_member(clan_id) or public.is_clan_public(clan_id));

create policy "relationships_insert_admin_or_owner"
on public.relationships for insert
with check (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = parent_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "relationships_update_admin_or_owner"
on public.relationships for update
using (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = parent_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "relationships_delete_admin_or_owner"
on public.relationships for delete
using (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = parent_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "positions_select_members"
on public.person_positions for select
using (public.is_clan_member(clan_id) or public.is_clan_public(clan_id));

create policy "positions_insert_admin_or_owner"
on public.person_positions for insert
with check (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = person_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "positions_update_admin_or_owner"
on public.person_positions for update
using (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = person_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "positions_delete_admin_or_owner"
on public.person_positions for delete
using (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = person_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "branch_owners_admin_only"
on public.branch_owners for all
using (public.is_clan_admin(clan_id));

create policy "suggestions_select_members"
on public.suggestions for select
using (public.is_clan_member(clan_id));

create policy "suggestions_insert_any"
on public.suggestions for insert
with check (
  status = 'pending'
  and (public.is_clan_member(clan_id) or public.is_clan_public(clan_id))
);

create policy "suggestions_update_admin_or_owner"
on public.suggestions for update
using (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = target_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);

create policy "change_events_select_members"
on public.change_events for select
using (public.is_clan_member(clan_id));

create policy "change_events_insert_admin_or_owner"
on public.change_events for insert
with check (
  public.is_clan_admin(clan_id)
  or exists (
    select 1 from public.persons p
    where p.id = target_id
      and public.is_branch_owner(clan_id, p.branch_root_id)
  )
);
