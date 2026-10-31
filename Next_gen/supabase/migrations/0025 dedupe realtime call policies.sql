-- Removes a duplicate set of realtime.messages policies (functionally
-- identical to the ones from migration 0021, just added again under
-- different names during troubleshooting) to avoid confusion. Not a
-- behavior change — RLS policies for the same command already OR
-- together, so the duplicates were redundant, not conflicting.
drop policy if exists "users can join call signaling channels" on "realtime"."messages";
drop policy if exists "users can send call invites" on "realtime"."messages";
drop policy if exists "users can send call signaling" on "realtime"."messages";
drop policy if exists "users receive invites on their own inbox" on "realtime"."messages";