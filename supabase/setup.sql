-- Supabase-side setup that lives OUTSIDE Prisma migrations
-- (touches the auth schema / realtime publication, which Prisma's shadow
-- database can't replay). Idempotent: safe to run multiple times.
--
-- Apply with:  npx prisma db execute --file supabase/setup.sql
-- or paste into the Supabase SQL Editor.

-- ============================================================
-- 1. Mirror auth.users -> public."User" (profile row on signup)
-- ============================================================
-- mcpToken must be generated here: Prisma's @default(uuid()) is applied by
-- the Prisma client, not the database, so trigger inserts need their own.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := lower(
    regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9]', '', 'g')
  );
  if length(base) < 3 then
    base := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;
  base := left(base, 24);

  loop
    candidate := case
      when suffix = 0 then base
      else left(base, greatest(3, 24 - length(suffix::text) - 1)) || '_' || suffix::text
    end;
    exit when not exists (
      select 1 from public."User" where username = candidate
    );
    suffix := suffix + 1;
    if suffix > 9999 then
      candidate := 'user_' || left(replace(new.id::text, '-', ''), 12);
      exit;
    end if;
  end loop;

  begin
    insert into public."User" (id, email, username, "mcpToken", "createdAt")
    values (new.id, new.email, candidate, gen_random_uuid(), now());
  exception
    when unique_violation then
      -- Email already exists on a legacy profile row. Keep the derived
      -- username but omit the conflicting email so OAuth signup can finish.
      insert into public."User" (id, username, "mcpToken", "createdAt")
      values (new.id, candidate, gen_random_uuid(), now())
      on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. Membership check helper (security definer avoids recursive
--    RLS lookups inside policies)
-- ============================================================
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public."WorkspaceMembership" m
    where m."workspaceId" = ws_id
      and m."userId" = auth.uid()
  );
$$;

-- ============================================================
-- 3. RLS read policies (web clients read via Realtime/PostgREST;
--    all WRITES go through the backend service layer, which
--    connects as the table owner and bypasses RLS)
-- ============================================================
alter table public."User"                enable row level security;
alter table public."Workspace"           enable row level security;
alter table public."WorkspaceMembership" enable row level security;
alter table public."Task"                enable row level security;
alter table public."Asset"               enable row level security;
alter table public."WorkspaceLink"       enable row level security;
alter table public."WorkspaceInvite"     enable row level security;
alter table public."TaskUpdate"          enable row level security;
alter table public."WorkspaceMessage"    enable row level security;
alter table public."MemoryEvent"         enable row level security;
alter table public."MemoryDocument"      enable row level security;
alter table public."MemoryDocumentReview" enable row level security;

drop policy if exists "members_read_tasks" on public."Task";
create policy "members_read_tasks" on public."Task"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_workspace" on public."Workspace";
create policy "members_read_workspace" on public."Workspace"
  for select using (public.is_workspace_member(id));

drop policy if exists "members_read_memberships" on public."WorkspaceMembership";
create policy "members_read_memberships" on public."WorkspaceMembership"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_assets" on public."Asset";
create policy "members_read_assets" on public."Asset"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_links" on public."WorkspaceLink";
create policy "members_read_links" on public."WorkspaceLink"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_task_updates" on public."TaskUpdate";
create policy "members_read_task_updates" on public."TaskUpdate"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_workspace_messages" on public."WorkspaceMessage";
create policy "members_read_workspace_messages" on public."WorkspaceMessage"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_memory_events" on public."MemoryEvent";
create policy "members_read_memory_events" on public."MemoryEvent"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_memory_documents" on public."MemoryDocument";
create policy "members_read_memory_documents" on public."MemoryDocument"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "members_read_memory_document_reviews" on public."MemoryDocumentReview";
create policy "members_read_memory_document_reviews" on public."MemoryDocumentReview"
  for select using (public.is_workspace_member("workspaceId"));

drop policy if exists "users_read_self" on public."User";
create policy "users_read_self" on public."User"
  for select using (id = auth.uid());

-- ============================================================
-- 3b. Whiteboard live collaboration: private broadcast channels
--     (topic "whiteboard-<workspaceId>"), members only
-- ============================================================
-- Safe cast helper: policies must not error on malformed topics, and SQL
-- AND does not guarantee evaluation order.
create or replace function public.is_workspace_member_text(ws text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return public.is_workspace_member(ws::uuid);
exception when others then
  return false;
end;
$$;

drop policy if exists "whiteboard_broadcast_read" on realtime.messages;
create policy "whiteboard_broadcast_read" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'whiteboard-%'
    and realtime.messages.extension in ('broadcast', 'presence')
    and public.is_workspace_member_text(
      replace(realtime.topic(), 'whiteboard-', '')
    )
  );

drop policy if exists "whiteboard_broadcast_write" on realtime.messages;
create policy "whiteboard_broadcast_write" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() like 'whiteboard-%'
    and realtime.messages.extension in ('broadcast', 'presence')
    and public.is_workspace_member_text(
      replace(realtime.topic(), 'whiteboard-', '')
    )
  );

-- ============================================================
-- 4. Realtime: Postgres changes -> subscribed dashboards
--    (events are filtered per-user through RLS policies above)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['Task', 'Workspace', 'WorkspaceMembership', 'Asset', 'WorkspaceLink', 'TaskUpdate', 'WorkspaceMessage', 'Post', 'PostMessage', 'MemoryEvent']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end $$;

-- Filters on non-PK columns (e.g. workspaceId) need full row images for Realtime.
alter table public."Task" replica identity full;
alter table public."Asset" replica identity full;
alter table public."WorkspaceLink" replica identity full;
alter table public."TaskUpdate" replica identity full;
alter table public."WorkspaceMessage" replica identity full;
alter table public."Post" replica identity full;
alter table public."PostMessage" replica identity full;
alter table public."Workspace" replica identity full;
alter table public."MemoryEvent" replica identity full;
