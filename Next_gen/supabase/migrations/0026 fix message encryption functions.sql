-- Reverts nextgen_msg_encrypt/decrypt back to pgp_sym_encrypt/decrypt.
-- Someone had rewritten these to use raw pgcrypto encrypt()/decrypt()
-- with a plain-text passphrase as the key — but those functions require
-- an EXACT-length AES key (16/24/32 bytes), and the passphrase used
-- isn't one, so encryption was silently producing unreadable ciphertext
-- and decryption failed on every row, including brand new ones.
-- pgp_sym_encrypt/decrypt are specifically designed to accept a
-- passphrase of any length via internal key derivation — this is the
-- version already proven to work correctly earlier in this project.

create or replace function public.nextgen_msg_encrypt(p_plain text)
returns text
language sql
security definer set search_path = public, extensions
as $$
  select case when p_plain is null then null
    else encode(extensions.pgp_sym_encrypt(p_plain, nextgen_get_msg_key()), 'base64')
  end;
$$;

create or replace function public.nextgen_msg_decrypt(p_cipher text)
returns text
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if p_cipher is null then
    return null;
  end if;
  return extensions.pgp_sym_decrypt(decode(p_cipher, 'base64'), nextgen_get_msg_key());
exception when others then
  return null;
end;
$$;