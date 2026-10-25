-- R50 staging-only INVOKER quote-save transaction. It does not grant
-- executable SQL to the Data API, client users, anon or authenticated.
-- Caller must be a trusted future server adapter with privileged *private*
-- connection after verifying original lead/source and current membership.
--
-- In particular, a browser-provided P3Attestation, claim, or approval field
-- cannot call this function, and this function never accepts customer approval.
-- Data changes here are exercised ONLY on disposable PostgreSQL 17 fixtures.
create function oj_private.ext_p3_issue_quote_version(
 p_organization_id uuid,
 p_quote_id uuid,
 p_command_id uuid,
 p_version_id uuid,
 p_actor_id uuid,
 p_expected_revision integer,
 p_source_updated_at text,
 p_source_quote_cents bigint,
 p_scope jsonb,
 p_subtotal_cents bigint,
 p_discount_cents bigint,
 p_price_cents bigint,
 p_content_hash text
) returns table(version_id uuid,version_sequence integer,quote_revision integer,replayed boolean)
language plpgsql security invoker set search_path='' as $$
declare
 q record;
 prior record;
 actual_actor uuid;
 written_id uuid;
begin
 -- Not sufficient ALONE to establish a trusted connection. The adapter
 -- must validate the server-side session and the source record separately.
 actual_actor:=auth.uid();
 if actual_actor is null or actual_actor<>p_actor_id or
    oj_private.member_role(p_organization_id) not in ('owner','member') then
  raise exception 'A current authorized company operator is required'
   using errcode='42501';
 end if;
 if p_command_id is null or p_version_id is null or
    p_expected_revision is null or p_expected_revision<0 then
  raise exception 'Command identity and expected revision are required'
   using errcode='23514';
 end if;
 select * into q from public.oj_exterior_quotes
  where organization_id=p_organization_id and id=p_quote_id
  for update;
 if not found then
  raise exception 'The original company quote is unavailable'
   using errcode='23503';
 end if;
 -- Existing command is checked inside the quote row lock so simultaneous
 -- callers cannot both insert the same logical version. Cross-quote command
 -- reuse is not an idempotent success (the unique index also blocks it).
 select * into prior from public.oj_exterior_quote_versions
  where organization_id=p_organization_id and command_id=p_command_id;
 if found then
  if prior.quote_id<>p_quote_id or prior.id<>p_version_id or
     prior.expected_revision<>p_expected_revision or
     prior.created_by<>p_actor_id or
     prior.source_updated_at is distinct from p_source_updated_at or
     prior.source_quote_cents is distinct from p_source_quote_cents or
     prior.scope<>p_scope or prior.subtotal_cents<>p_subtotal_cents or
     prior.discount_cents<>p_discount_cents or
     prior.price_cents<>p_price_cents or prior.content_hash<>p_content_hash then
   raise exception 'Idempotency key has different or cross-quote content'
    using errcode='23505';
  end if;
  return query select prior.id,prior.sequence,q.revision,true;
  return;
 end if;
 if p_expected_revision<>q.revision then
  raise exception 'The quote changed; refresh before preparing a new version'
   using errcode='40001';
 end if;
 if exists(select 1 from public.oj_exterior_work_orders w
  where w.organization_id=p_organization_id and w.quote_id=p_quote_id) then
  raise exception 'An ordered job requires a new amendment flow, not quote rewriting'
   using errcode='23514';
 end if;
 -- The existing version INSERT trigger validates public-only line fields,
 -- line totals, expected revision and monotonic sequence; it advances the
 -- quote pointer atomically in this transaction.
 insert into public.oj_exterior_quote_versions(
  organization_id,id,quote_id,sequence,command_id,expected_revision,created_by,
  source_updated_at,source_quote_cents,scope,subtotal_cents,discount_cents,
  price_cents,content_hash
 ) values(
  p_organization_id,p_version_id,p_quote_id,q.latest_version_sequence+1,
  p_command_id,p_expected_revision,p_actor_id,p_source_updated_at,
  p_source_quote_cents,p_scope,p_subtotal_cents,p_discount_cents,
  p_price_cents,p_content_hash
 ) returning id into written_id;
 return query select written_id,q.latest_version_sequence+1,q.revision+1,false;
end;
$$;
revoke all on function oj_private.ext_p3_issue_quote_version(
 uuid,uuid,uuid,uuid,uuid,integer,text,bigint,jsonb,bigint,bigint,bigint,text
) from public,anon,authenticated;
comment on function oj_private.ext_p3_issue_quote_version(
 uuid,uuid,uuid,uuid,uuid,integer,text,bigint,jsonb,bigint,bigint,bigint,text
) is 'PRIVATE P3 staging transaction only. Not a trusted public RPC, provider verification or a source-approved live endpoint.';
