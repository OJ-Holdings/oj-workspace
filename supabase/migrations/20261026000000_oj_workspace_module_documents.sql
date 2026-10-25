-- REVIEW-ONLY MIGRATION. DO NOT APPLY TO PRODUCTION until the R40
-- real-data restore, Storage-byte recovery, actor-RLS and owner approval gates pass.
-- Internal drafts are not customer approvals, booked work, invoices or cash.
-- STRATHOS private data and all browser archives are deliberately excluded.

create table oj_private.oj_module_documents (
  organization_id uuid not null references public.oj_organizations(id) on delete restrict,
  kind text not null check (kind in (
    'exterior_estimate','exterior_field','exterior_equipment','exterior_handoff',
    'fleet','commercial_draft'
  )),
  source_id text not null check (length(source_id) between 1 and 80),
  revision integer not null check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,kind,source_id)
);
create index oj_module_documents_recent_idx on oj_private.oj_module_documents
  (organization_id,kind,updated_at desc,source_id);

create table oj_private.oj_module_versions (
  organization_id uuid not null,
  kind text not null,
  source_id text not null,
  revision integer not null check (revision > 0),
  command_id uuid not null,
  payload jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,kind,source_id,revision),
  unique (organization_id,command_id),
  foreign key (organization_id,kind,source_id)
    references oj_private.oj_module_documents(organization_id,kind,source_id) on delete restrict
);
create table oj_private.oj_module_commands (
  organization_id uuid not null,
  command_id uuid not null,
  kind text not null,
  source_id text not null,
  expected_revision integer not null,
  resulting_revision integer not null,
  payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,command_id),
  foreign key (organization_id,kind,source_id,resulting_revision)
    references oj_private.oj_module_versions(organization_id,kind,source_id,revision) on delete restrict
);

create function oj_private.oj_module_no_history_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Shared workspace history is immutable; append a new revision' using errcode = '23514';
end;
$$;
create trigger oj_module_version_immutable
before update or delete on oj_private.oj_module_versions
for each row execute function oj_private.oj_module_no_history_changes();
create trigger oj_module_command_immutable
before update or delete on oj_private.oj_module_commands
for each row execute function oj_private.oj_module_no_history_changes();

alter table oj_private.oj_module_documents enable row level security;
alter table oj_private.oj_module_versions enable row level security;
alter table oj_private.oj_module_commands enable row level security;
revoke all on oj_private.oj_module_documents, oj_private.oj_module_versions,
  oj_private.oj_module_commands from public,anon,authenticated;
revoke all on function oj_private.oj_module_no_history_changes() from public,anon,authenticated;

-- All requests are authenticated against CURRENT company membership. The
-- caller never supplies an actor ID, and readers cannot access whole tables.
create function public.oj_module_document_get(
  p_organization_id uuid, p_kind text, p_source_id text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_record oj_private.oj_module_documents%rowtype;
begin
  if auth.uid() is null or
     oj_private.member_role(p_organization_id) not in ('owner','member') then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  select * into v_record from oj_private.oj_module_documents
    where organization_id = p_organization_id and kind = p_kind and source_id = p_source_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'revision',v_record.revision,'payload',v_record.payload,
    'updatedAt',v_record.updated_at
  );
end;
$$;
revoke all on function public.oj_module_document_get(uuid,text,text) from public,anon;
grant execute on function public.oj_module_document_get(uuid,text,text) to authenticated;

-- Single row-locked command handles concurrent founders, unacknowledged HTTP
-- retries, append-only evidence and stale writes in one transaction. The
-- application server ALSO validates each domain-specific shape.
create function public.oj_module_document_save(
  p_organization_id uuid, p_kind text, p_source_id text,
  p_expected_revision integer, p_command_id uuid, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_prior oj_private.oj_module_commands%rowtype;
  v_old integer;
  v_next integer;
  v_valid_source boolean;
begin
  if v_actor is null or
     oj_private.member_role(p_organization_id) not in ('owner','member') then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  if p_command_id is null or p_expected_revision is null
     or p_expected_revision < 0 or p_kind is null or p_source_id is null
     or p_kind not in ('exterior_estimate','exterior_field','exterior_equipment',
                       'exterior_handoff','fleet','commercial_draft')
     or jsonb_typeof(p_payload) is distinct from 'object'
     or octet_length(p_payload::text) > 262144 then
    raise exception 'Invalid shared document request' using errcode = '22023';
  end if;
  if p_kind in ('fleet','commercial_draft') then
    if p_source_id <> 'main' then
      raise exception 'Invalid organization document key' using errcode = '22023';
    end if;
  else
    if p_source_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Expected an original source UUID' using errcode = '22023';
    end if;
    -- Legacy lead and booking tables lack an organization_id. Until P3
    -- creates explicit source links, only the one legacy Exterior owning
    -- organization may persist source-bound records in this interim layer.
    if not exists (
      select 1 from oj_private.legacy_owner
      where organization_id = p_organization_id
    ) then
      raise exception 'Organization does not own the legacy Exterior source'
        using errcode = '42501';
    end if;
    if p_kind = 'exterior_estimate' then
      select exists(select 1 from public.leads where id = p_source_id::uuid) into v_valid_source;
      if not v_valid_source or p_payload->'current'->>'leadId' is distinct from p_source_id then
        raise exception 'Estimate is not linked to its original lead' using errcode = '22023';
      end if;
    else
      select exists(select 1 from public.bookings where id = p_source_id::uuid) into v_valid_source;
      if not v_valid_source then
        raise exception 'Field record is not linked to its original booking' using errcode = '22023';
      end if;
    end if;
  end if;
  if p_kind = 'fleet' and p_payload->>'organizationId' is distinct from p_organization_id::text then
    raise exception 'Fleet organization mismatch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_kind || ':' || p_source_id,0)
  );
  select * into v_prior from oj_private.oj_module_commands
    where organization_id = p_organization_id and command_id = p_command_id;
  if found then
    if v_prior.kind <> p_kind or v_prior.source_id <> p_source_id
       or v_prior.expected_revision <> p_expected_revision or v_prior.payload <> p_payload then
      raise exception 'Command identifier reused with a different operation' using errcode = '23505';
    end if;
    return jsonb_build_object('ok',true,'replayed',true,'revision',v_prior.resulting_revision);
  end if;

  select revision into v_old from oj_private.oj_module_documents
    where organization_id = p_organization_id and kind = p_kind and source_id = p_source_id
    for update;
  if not found then v_old := 0; end if;
  if v_old <> p_expected_revision then
    return jsonb_build_object('ok',false,'conflict',true,'currentRevision',v_old);
  end if;
  v_next := v_old + 1;
  insert into oj_private.oj_module_documents
    (organization_id,kind,source_id,revision,payload,updated_by)
  values (p_organization_id,p_kind,p_source_id,v_next,p_payload,v_actor)
  on conflict (organization_id,kind,source_id) do update
    set revision = excluded.revision, payload = excluded.payload,
        updated_by = excluded.updated_by, updated_at = clock_timestamp();

  insert into oj_private.oj_module_versions
    (organization_id,kind,source_id,revision,command_id,payload,actor_id)
  values (p_organization_id,p_kind,p_source_id,v_next,p_command_id,p_payload,v_actor);
  insert into oj_private.oj_module_commands
    (organization_id,command_id,kind,source_id,expected_revision,resulting_revision,payload)
  values (p_organization_id,p_command_id,p_kind,p_source_id,p_expected_revision,v_next,p_payload);
  return jsonb_build_object('ok',true,'replayed',false,'revision',v_next);
end;
$$;
revoke all on function public.oj_module_document_save(uuid,text,text,integer,uuid,jsonb)
  from public,anon;
grant execute on function public.oj_module_document_save(uuid,text,text,integer,uuid,jsonb)
  to authenticated;

-- This is a private *interim* shared draft layer, not a substitute for P3
-- canonical customer/quote/job tables or dedicated immutable field/maintenance
-- event records. Nothing here accepts a bid, dispatches staff or posts cash.
