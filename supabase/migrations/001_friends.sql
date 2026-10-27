-- AgentPet Friends: run once in the Supabase dashboard (SQL Editor › New query › paste › Run).
--
-- What is stored: per user only the pet's name, skin, level and a friend code, plus who is
-- friends with whom. Users are anonymous (no email, no password). Everything the app does goes
-- through Row Level Security or the functions below; the app only ever has the anon key.

-- ---------------------------------------------------------------- tables

create table if not exists public.pets (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  -- the pet's name + 4 random characters without look-alikes (0/O/1/I), e.g. NOODLE-48K2
  friend_code text not null unique check (friend_code ~ '^[A-Z]{2,6}-[A-HJ-NP-Z2-9]{4}$'),
  pet_name    text not null check (char_length(pet_name) between 1 and 24),
  skin        text not null check (skin in ('noodle', 'mochi', 'zitouna')),
  level       int  not null default 1 check (level between 1 and 100000),
  updated_at  timestamptz not null default now()
);

create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  blocked_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);

-- one row per pair, whoever asked first
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);
create index if not exists friendships_requester on public.friendships (requester);

-- every request ever sent (kept 2 days), so deleting requests can't get around the daily limit
create table if not exists public.friend_request_log (
  requester uuid not null references auth.users (id) on delete cascade,
  at        timestamptz not null default now()
);
create index if not exists friend_request_log_requester on public.friend_request_log (requester, at);

alter table public.pets enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_request_log enable row level security; -- no policies: functions only

-- ---------------------------------------------------------------- helpers

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- max 20 friend requests a day per user, however they are sent
create or replace function public.friend_request_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.friend_request_log where at < now() - interval '2 days';
  if (select count(*) from public.friend_request_log
      where requester = new.requester and at > now() - interval '1 day') >= 20 then
    raise exception 'limit' using errcode = 'P0001', hint = 'max 20 friend requests a day';
  end if;
  insert into public.friend_request_log (requester) values (new.requester);
  return new;
end;
$$;

drop trigger if exists friend_request_limit on public.friendships;
create trigger friend_request_limit
  before insert on public.friendships
  for each row execute function public.friend_request_limit();

-- ---------------------------------------------------------------- row level security

-- pets: your own row (read/write), and accepted friends' rows (read)
drop policy if exists "own pet or friends' pets" on public.pets;
create policy "own pet or friends' pets" on public.pets
  for select to authenticated
  using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));

drop policy if exists "insert own pet" on public.pets;
create policy "insert own pet" on public.pets
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "update own pet" on public.pets;
create policy "update own pet" on public.pets
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- friendships: see the ones you're in
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- create requests (as yourself, pending)
drop policy if exists "send requests" on public.friendships;
create policy "send requests" on public.friendships
  for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending' and blocked_by is null);

-- accept or block only requests addressed to you
drop policy if exists "answer requests to you" on public.friendships;
create policy "answer requests to you" on public.friendships
  for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (
    addressee = (select auth.uid())
    and (status = 'accepted' or (status = 'blocked' and blocked_by = (select auth.uid())))
  );

-- decline / cancel / remove; a block can only be lifted by whoever blocked
drop policy if exists "remove friendships" on public.friendships;
create policy "remove friendships" on public.friendships
  for delete to authenticated
  using (
    (status <> 'blocked' and (select auth.uid()) in (requester, addressee))
    or blocked_by = (select auth.uid())
  );

-- ---------------------------------------------------------------- functions the app calls

-- Creates or updates your pet row; returns your friend code (made once, kept forever).
create or replace function public.upsert_my_pet(p_name text, p_skin text, p_level int)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text;
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  prefix text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select friend_code into code from public.pets where user_id = me;
  if code is null then
    -- the pet's name in capitals, letters only, e.g. NOODLE
    prefix := left(regexp_replace(upper(coalesce(p_name, '')), '[^A-Z]', '', 'g'), 6);
    if char_length(prefix) < 2 then prefix := 'PET'; end if;
    loop
      code := prefix || '-' || (
        select string_agg(substr(chars, 1 + floor(random() * length(chars))::int, 1), '')
        from generate_series(1, 4)
      );
      exit when not exists (select 1 from public.pets where friend_code = code);
    end loop;
  end if;
  insert into public.pets (user_id, friend_code, pet_name, skin, level, updated_at)
  values (me, code, left(trim(p_name), 24), p_skin, greatest(1, p_level), now())
  on conflict (user_id) do update
    set pet_name = excluded.pet_name, skin = excluded.skin, level = excluded.level,
        updated_at = now();
  return code;
end;
$$;

-- Sends a friend request by code. Answers: sent | accepted (they had asked you) | already |
-- not_found (also for people who blocked you: nothing is revealed) | self | limit
create or replace function public.send_friend_request(p_code text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
  f public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  select user_id into other from public.pets where friend_code = upper(trim(p_code));
  if other is null then return 'not_found'; end if;
  if other = me then return 'self'; end if;

  select * into f from public.friendships
  where least(requester, addressee) = least(me, other)
    and greatest(requester, addressee) = greatest(me, other);
  if found then
    if f.status = 'blocked' then return 'not_found'; end if;
    if f.status = 'accepted' then return 'already'; end if;
    if f.requester = other then
      update public.friendships set status = 'accepted' where id = f.id;
      return 'accepted';
    end if;
    return 'already';
  end if;

  begin
    insert into public.friendships (requester, addressee) values (me, other);
  exception when sqlstate 'P0001' then
    return 'limit';
  end;
  return 'sent';
end;
$$;

-- accept | decline (requests to you) · cancel (your requests) · remove (friends) ·
-- block (anyone you have a row with) · unblock (only if you blocked)
create or replace function public.respond_friend(p_id bigint, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  f public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into f from public.friendships where id = p_id and me in (requester, addressee);
  if not found then raise exception 'not found'; end if;

  if p_action = 'accept' and f.addressee = me and f.status = 'pending' then
    update public.friendships set status = 'accepted' where id = p_id;
  elsif p_action = 'decline' and f.addressee = me and f.status = 'pending' then
    delete from public.friendships where id = p_id;
  elsif p_action = 'cancel' and f.requester = me and f.status = 'pending' then
    delete from public.friendships where id = p_id;
  elsif p_action = 'remove' and f.status = 'accepted' then
    delete from public.friendships where id = p_id;
  elsif p_action = 'block' and f.status <> 'blocked' then
    update public.friendships set status = 'blocked', blocked_by = me where id = p_id;
  elsif p_action = 'unblock' and f.status = 'blocked' and f.blocked_by = me then
    delete from public.friendships where id = p_id;
  else
    raise exception 'not allowed';
  end if;
end;
$$;

-- Everything the Friends screen shows, in one call. Pending requests show the other pet's name
-- and code (they shared their code or you shared yours); blocked rows only for the blocker.
create or replace function public.friends_overview()
returns table (
  id bigint, kind text, user_id uuid, pet_name text, skin text, level int, friend_code text
)
language sql stable security definer set search_path = ''
as $$
  select f.id,
         case
           when f.status = 'accepted' then 'friend'
           when f.status = 'blocked' then 'blocked'
           when f.addressee = auth.uid() then 'incoming'
           else 'outgoing'
         end,
         p.user_id, p.pet_name, p.skin, p.level, p.friend_code
  from public.friendships f
  join public.pets p
    on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
    and (f.status <> 'blocked' or f.blocked_by = auth.uid())
  order by p.pet_name;
$$;

revoke execute on function public.upsert_my_pet(text, text, int) from public, anon;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend(bigint, text) from public, anon;
revoke execute on function public.friends_overview() from public, anon;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.upsert_my_pet(text, text, int) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend(bigint, text) to authenticated;
grant execute on function public.friends_overview() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- realtime (online dots)
-- One private channel per user: "pet:<user id>". You track your presence on your own channel;
-- only you and your accepted friends may join it (Realtime Authorization).

create or replace function public.may_use_pet_channel(topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select topic = 'pet:' || auth.uid()::text
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester = auth.uid() and topic = 'pet:' || f.addressee::text)
            or (f.addressee = auth.uid() and topic = 'pet:' || f.requester::text))
      );
$$;
revoke execute on function public.may_use_pet_channel(text) from public, anon;
grant execute on function public.may_use_pet_channel(text) to authenticated;

drop policy if exists "pet channels: you and your friends listen" on realtime.messages;
create policy "pet channels: you and your friends listen" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('presence', 'broadcast')
    and public.may_use_pet_channel(realtime.topic())
  );

drop policy if exists "pet channels: you and your friends send" on realtime.messages;
create policy "pet channels: you and your friends send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('presence', 'broadcast')
    and public.may_use_pet_channel(realtime.topic())
  );
