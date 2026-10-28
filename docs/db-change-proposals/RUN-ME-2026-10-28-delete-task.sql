-- OJ Workspace: let owners and members delete a task. NOT APPLIED. Run only with Oscar's OK.
-- Run once in the Supabase SQL editor for the OJ EXTERIOR CARE LEADS project. Safe to run again.
--
-- Additive only: adds one function, public.oj_delete_card(org, card). It changes no table and no existing row.
-- Why a function: tasks have comments and an activity feed that point at them, and the app is not allowed to delete directly.
-- The function checks the caller is an owner or member of that workspace, then removes the task together with its
-- comments and activity, clears it from anyone's "working on" note, and drops it from the leaderboard's untracked list.
-- A task that was completed no longer counts toward the weekly leaderboard once it is deleted.
-- Covered by tests/delete-task-sql.test.ts.
-- To undo: drop function public.oj_delete_card(uuid, uuid);

begin;
create or replace function public.oj_delete_card(p_org uuid, p_card uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then
    raise exception 'Workspace member access required';
  end if;
  if not exists (select 1 from public.oj_cards where organization_id = p_org and id = p_card) then
    raise exception 'That task no longer exists';
  end if;
  delete from public.oj_comments where organization_id = p_org and card_id = p_card;
  delete from public.oj_activity where organization_id = p_org and card_id = p_card;
  if to_regclass('public.oj_current_work') is not null then
    execute 'update public.oj_current_work set card_id = null where organization_id = $1 and card_id = $2' using p_org, p_card;
  end if;
  if to_regclass('oj_private.untracked_done_cards') is not null then
    execute 'delete from oj_private.untracked_done_cards where card_id = $1' using p_card;
  end if;
  delete from public.oj_cards where organization_id = p_org and id = p_card;
end $$;
revoke all on function public.oj_delete_card(uuid, uuid) from public, anon;
grant execute on function public.oj_delete_card(uuid, uuid) to authenticated;
commit;
