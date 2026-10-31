-- messages_plain ran with its owner's rights, which bypasses Row Level Security: any signed-in user could
-- read EVERY conversation's decrypted messages through it. security_invoker makes the view obey the caller's
-- RLS on public.messages. (Already applied to the live project.)
alter view public.messages_plain set (security_invoker = true);
