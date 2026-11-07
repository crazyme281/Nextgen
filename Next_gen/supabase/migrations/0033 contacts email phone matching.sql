-- Add-by-email and phone-book matching for contacts. (Already applied to the live project.)

-- Last 10 digits of a phone number, so 0803 123 4567, +234 803 123 4567 and 2348031234567 all match.
create or replace function public.phone_key(p text)
returns text
language sql
immutable
as $$
  select case when length(d) >= 10 then right(d, 10) else null end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create index if not exists profiles_phone_key_idx on public.profiles (public.phone_key(phone));

-- Find a Nextgen account by exact email (emails live in auth.users, which clients can't read).
create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, full_name text, avatar_url text, phone text, trust_level public.trust_level)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.full_name, p.avatar_url, p.phone, p.trust_level
  from auth.users u
  join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and u.id <> auth.uid()
    and lower(u.email) = lower(trim(p_email))
  limit 1
$$;

-- Which of these phone numbers belong to Nextgen accounts? Capped at 2000 per call.
create or replace function public.match_phone_contacts(p_phones text[])
returns table (id uuid, full_name text, avatar_url text, phone text, trust_level public.trust_level, phone_key text)
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select distinct public.phone_key(x) as k
    from unnest(p_phones[1:2000]) as x
    where public.phone_key(x) is not null
  )
  select p.id, p.full_name, p.avatar_url, p.phone, p.trust_level, public.phone_key(p.phone)
  from public.profiles p
  join keys on keys.k = public.phone_key(p.phone)
  where auth.uid() is not null
    and p.id <> auth.uid()
$$;

revoke all on function public.find_user_by_email(text) from public, anon;
revoke all on function public.match_phone_contacts(text[]) from public, anon;
grant execute on function public.find_user_by_email(text) to authenticated;
grant execute on function public.match_phone_contacts(text[]) to authenticated;

-- New contacts are mirrored automatically (mirror_contact_insert trigger); complete older one-way ones.
insert into public.contacts (owner_id, contact_user_id)
select c.contact_user_id, c.owner_id from public.contacts c
on conflict do nothing;