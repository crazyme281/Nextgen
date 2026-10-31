-- =========================================================================
-- Message API — Transparent Database Encryption
-- Handles encrypting message bodies on insert and decrypting them on read
-- via a secure database-level view.
-- =========================================================================

-- The master encryption key for database-level message storage.
create or replace function public.nextgen_get_msg_key()
returns text
language sql
security definer
as $$
  select 'nextgen-db-encryption-secret-2026';
$$;

-- ---- ENCRYPT ----
create or replace function public.nextgen_msg_encrypt(p_plain text)
returns text
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if p_plain is null then return null; end if;
  return encode(extensions.encrypt(p_plain::bytea, nextgen_get_msg_key()::bytea, 'aes-cbc/pad:pkcs'), 'base64');
end;
$$;

-- ---- DECRYPT ----
create or replace function public.nextgen_msg_decrypt(p_cipher text)
returns text
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_plain bytea;
begin
  if p_cipher is null then return null; end if;
  begin
    v_plain := extensions.decrypt(decode(p_cipher, 'base64'), nextgen_get_msg_key()::bytea, 'aes-cbc/pad:pkcs');
    return convert_from(v_plain, 'utf8');
  exception when others then
    return null; 
  end;
end;
$$;

-- ---- TRIGGER: Encrypt body before it hits the disk ----
create or replace function public.nextgen_encrypt_message_body()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_encrypted = false and new.body is not null then
    new.body := nextgen_msg_encrypt(new.body);
    new.is_encrypted := true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_message_encrypt on public.messages;
create trigger on_message_encrypt
  before insert on public.messages
  for each row execute procedure public.nextgen_encrypt_message_body();

-- ---- VIEW: Decrypted messages for the frontend API ----
-- We use DROP VIEW because Postgres doesn't allow replacing a view if it
-- involves changing the column list (adding iv/encrypted_keys back in).
drop view if exists public.messages_plain;

create view public.messages_plain with (security_invoker = true) as
select
  id,
  conversation_id,
  sender_id,
  case
    when is_encrypted = true then nextgen_msg_decrypt(body)
    else body
  end as body,
  media_url,
  media_type,
  reply_to_id,
  is_deleted,
  is_encrypted,
  iv,
  encrypted_keys,
  created_at
from public.messages;