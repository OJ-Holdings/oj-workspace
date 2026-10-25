-- Additive shared commercial estimating foundation.
-- Prepared for review only: do not apply until the documented R40 recovery,
-- Storage-byte and authenticated role-access gates have passed.

create table public.oj_commercial_projects (
  organization_id uuid not null references public.oj_organizations(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 140),
  phase text not null check (phase in ('scoping','founder-review','archived')),
  source_booking_id uuid,
  planned_asset_ids text[] not null default '{}',
  field_crew_plan jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,id),
  check (cardinality(planned_asset_ids) <= 40),
  check (jsonb_typeof(field_crew_plan) = 'object')
);
create index oj_commercial_projects_updated_idx
  on public.oj_commercial_projects (organization_id,updated_at desc,id desc);

create table public.oj_commercial_estimates (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  currency text not null default 'USD' check (currency = 'USD'),
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,id),
  unique (organization_id,project_id),
  foreign key (organization_id,project_id)
    references public.oj_commercial_projects(organization_id,id) on delete restrict
);

create table public.oj_commercial_estimate_versions (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  estimate_id uuid not null,
  version integer not null check (version > 0),
  command_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{32}$'),
  building_scope jsonb not null,
  review_items jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,id),
  unique (organization_id,estimate_id,version),
  unique (organization_id,command_id),
  foreign key (organization_id,estimate_id)
    references public.oj_commercial_estimates(organization_id,id) on delete restrict,
  check (jsonb_typeof(building_scope) = 'array' and jsonb_array_length(building_scope) between 1 and 12),
  check (jsonb_typeof(review_items) = 'array' and jsonb_array_length(review_items) = 5)
);

create table public.oj_commercial_buildings (
  organization_id uuid not null,
  estimate_version_id uuid not null,
  sort_order smallint not null check (sort_order between 0 and 11),
  building_id text not null check (length(building_id) between 1 and 80),
  label text not null check (length(label) <= 70),
  location text not null default '' check (length(location) <= 180),
  levels numeric not null check (levels between 0 and 100),
  panes numeric not null check (panes between 0 and 100000),
  crew_hours numeric not null check (crew_hours between 0 and 10000),
  lift_days numeric not null check (lift_days between 0 and 365),
  access text not null check (access in ('review','ground','water-fed','lift')),
  notes text not null default '' check (length(notes) <= 2000),
  primary key (organization_id,estimate_version_id,sort_order),
  foreign key (organization_id,estimate_version_id)
    references public.oj_commercial_estimate_versions(organization_id,id) on delete restrict
);

create table public.oj_commercial_history (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  estimate_version_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('project.created','project.updated','project.archived')),
  revision integer not null check (revision > 0),
  command_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,id),
  unique (organization_id,command_id),
  foreign key (organization_id,project_id)
    references public.oj_commercial_projects(organization_id,id) on delete restrict,
  foreign key (organization_id,estimate_version_id)
    references public.oj_commercial_estimate_versions(organization_id,id) on delete restrict
);
create index oj_commercial_history_project_idx
  on public.oj_commercial_history (organization_id,project_id,occurred_at desc,id desc);

-- Private costing is stored separately from customer-visible quote material.
create table oj_private.oj_commercial_cost_assumptions (
  organization_id uuid not null,
  estimate_version_id uuid not null,
  labor_rate numeric not null check (labor_rate between 0 and 10000),
  lift_daily numeric not null check (lift_daily between 0 and 100000),
  materials numeric not null check (materials between 0 and 1000000),
  mobilization numeric not null check (mobilization between 0 and 1000000),
  other_cost numeric not null check (other_cost between 0 and 1000000),
  contingency numeric not null check (contingency between 0 and 100),
  target_margin numeric not null check (target_margin between 0 and 90),
  deposit_percent numeric not null check (deposit_percent between 0 and 100),
  labor_total numeric not null,
  equipment_total numeric not null,
  base_cost numeric not null,
  contingency_cost numeric not null,
  total_cost numeric not null,
  scenario_price numeric not null,
  contribution numeric not null,
  deposit_amount numeric not null,
  primary key (organization_id,estimate_version_id),
  foreign key (organization_id,estimate_version_id)
    references public.oj_commercial_estimate_versions(organization_id,id) on delete restrict
);

create table oj_private.oj_commercial_commands (
  organization_id uuid not null,
  command_id uuid not null,
  project_id uuid not null,
  estimate_version_id uuid not null,
  revision integer not null,
  payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,command_id),
  foreign key (organization_id,project_id)
    references public.oj_commercial_projects(organization_id,id) on delete restrict,
  foreign key (organization_id,estimate_version_id)
    references public.oj_commercial_estimate_versions(organization_id,id) on delete restrict
);

-- Estimate version history, per-version building scope, cost assumptions and
-- command receipts are append-only evidence, not editable working tables.
-- Workspace projects and their CURRENT estimate pointer remain mutable through
-- the guarded RPC, but old snapshots can never be rewritten or deleted.
create function oj_private.oj_commercial_reject_immutable_change()
returns trigger language plpgsql security invoker set search_path = '' as $commercial_history$
begin
  raise exception 'Commercial estimate history is immutable; save a new version'
    using errcode = '23514';
end;
$commercial_history$;
revoke all on function oj_private.oj_commercial_reject_immutable_change()
  from public, anon, authenticated;
create trigger oj_commercial_version_immutable
  before update or delete on public.oj_commercial_estimate_versions
  for each row execute function oj_private.oj_commercial_reject_immutable_change();
create trigger oj_commercial_building_immutable
  before update or delete on public.oj_commercial_buildings
  for each row execute function oj_private.oj_commercial_reject_immutable_change();
create trigger oj_commercial_history_immutable
  before update or delete on public.oj_commercial_history
  for each row execute function oj_private.oj_commercial_reject_immutable_change();
create trigger oj_commercial_cost_immutable
  before update or delete on oj_private.oj_commercial_cost_assumptions
  for each row execute function oj_private.oj_commercial_reject_immutable_change();
create trigger oj_commercial_command_immutable
  before update or delete on oj_private.oj_commercial_commands
  for each row execute function oj_private.oj_commercial_reject_immutable_change();

alter table public.oj_commercial_projects enable row level security;
alter table public.oj_commercial_estimates enable row level security;
alter table public.oj_commercial_estimate_versions enable row level security;
alter table public.oj_commercial_buildings enable row level security;
alter table public.oj_commercial_history enable row level security;
alter table oj_private.oj_commercial_cost_assumptions enable row level security;
alter table oj_private.oj_commercial_commands enable row level security;

-- No direct Data API access. All operations cross narrowly-scoped RPCs which
-- derive the actor from auth.uid(), check the organization's live membership,
-- and keep private costing out of customer-facing data relations.
revoke all on public.oj_commercial_projects, public.oj_commercial_estimates,
  public.oj_commercial_estimate_versions, public.oj_commercial_buildings,
  public.oj_commercial_history from anon, authenticated;
revoke all on oj_private.oj_commercial_cost_assumptions,
  oj_private.oj_commercial_commands from anon, authenticated;

create or replace function public.oj_commercial_project_save(
  p_organization_id uuid,
  p_project_id uuid,
  p_expected_revision integer,
  p_command_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_old_revision integer;
  v_revision integer;
  v_hash text;
  v_prior oj_private.oj_commercial_commands%rowtype;
  v_estimate_id uuid;
  v_version_id uuid := gen_random_uuid();
  v_action text;
  v_site jsonb;
  v_site_index integer := 0;
  v_labor_rate numeric;
  v_lift_daily numeric;
  v_materials numeric;
  v_mobilization numeric;
  v_other numeric;
  v_contingency numeric;
  v_margin numeric;
  v_deposit numeric;
  v_labor numeric := 0;
  v_equipment numeric := 0;
  v_base numeric;
  v_contingency_cost numeric;
  v_total_cost numeric;
  v_price numeric;
  v_contribution numeric;
  v_deposit_amount numeric;
begin
  if v_actor is null or p_organization_id is null or p_project_id is null or p_command_id is null then
    raise exception 'Authenticated workspace, project and command identifiers are required.' using errcode='22023';
  end if;
  v_role := oj_private.member_role(p_organization_id);
  if v_role is null or v_role not in ('owner','member') then
    raise exception 'Only current organization owners and members may manage internal estimates.' using errcode='42501';
  end if;
  if p_expected_revision is not null and p_expected_revision < 1 then
    raise exception 'Expected revision must be positive or null for a new project.' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_payload)) <> 7
     or not (p_payload ?& array['name','input','review','phase','bookingId','plannedAssetIds','fieldCrewPlan'])
     or length(btrim(coalesce(p_payload->>'name',''))) not between 1 and 140
     or p_payload->>'phase' is null or p_payload->>'phase' not in ('scoping','founder-review','archived')
     or jsonb_typeof(p_payload->'input') is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_payload->'input')) <> 9
     or not ((p_payload->'input') ?& array['sites','laborRate','liftDaily','materials','mobilization','other','contingency','margin','deposit'])
     or jsonb_typeof(p_payload->'input'->'sites') is distinct from 'array'
     or jsonb_array_length(p_payload->'input'->'sites') not between 1 and 12
     or jsonb_typeof(p_payload->'review') is distinct from 'array'
     or jsonb_array_length(p_payload->'review') <> 5
     or exists (select 1 from jsonb_array_elements(p_payload->'review') as r(value) where jsonb_typeof(value) <> 'boolean')
     or jsonb_typeof(p_payload->'plannedAssetIds') is distinct from 'array'
     or jsonb_array_length(p_payload->'plannedAssetIds') > 40
     or jsonb_typeof(p_payload->'fieldCrewPlan') is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_payload->'fieldCrewPlan')) <> 4
     or not ((p_payload->'fieldCrewPlan') ?& array['crewSize','productiveHoursPerPersonDay','plannedFieldDays','stagingNote']) then
    raise exception 'Commercial estimate payload failed structural validation.' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'plannedAssetIds') as a(value) where jsonb_typeof(value) <> 'string')
     or exists (select 1 from jsonb_array_elements_text(p_payload->'plannedAssetIds') as a(value) where value !~ '^[A-Za-z0-9_-]{1,80}$')
     or (select count(distinct value) from jsonb_array_elements_text(p_payload->'plannedAssetIds') as a(value)) <> jsonb_array_length(p_payload->'plannedAssetIds') then
    raise exception 'Planned asset identifiers must be unique text values.' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload->'fieldCrewPlan'->'stagingNote') is distinct from 'string'
     or jsonb_typeof(p_payload->'fieldCrewPlan'->'crewSize') not in ('number','null')
     or jsonb_typeof(p_payload->'fieldCrewPlan'->'productiveHoursPerPersonDay') not in ('number','null')
     or jsonb_typeof(p_payload->'fieldCrewPlan'->'plannedFieldDays') not in ('number','null') then
    raise exception 'Field crew scenario has invalid field types.' using errcode='22023';
  end if;
  if length(p_payload->'fieldCrewPlan'->>'stagingNote') > 1800
     or (p_payload->'fieldCrewPlan'->>'crewSize') is not null
       and ((p_payload->'fieldCrewPlan'->>'crewSize')::numeric not between 1 and 40 or trunc((p_payload->'fieldCrewPlan'->>'crewSize')::numeric) <> (p_payload->'fieldCrewPlan'->>'crewSize')::numeric)
     or (p_payload->'fieldCrewPlan'->>'productiveHoursPerPersonDay') is not null
       and ((p_payload->'fieldCrewPlan'->>'productiveHoursPerPersonDay')::numeric not between 0.5 and 12 or mod((p_payload->'fieldCrewPlan'->>'productiveHoursPerPersonDay')::numeric * 4,1) <> 0)
     or (p_payload->'fieldCrewPlan'->>'plannedFieldDays') is not null
       and ((p_payload->'fieldCrewPlan'->>'plannedFieldDays')::numeric not between 1 and 45 or trunc((p_payload->'fieldCrewPlan'->>'plannedFieldDays')::numeric) <> (p_payload->'fieldCrewPlan'->>'plannedFieldDays')::numeric) then
    raise exception 'Field crew scenario exceeds supported limits.' using errcode='22023';
  end if;
  if nullif(p_payload->>'bookingId','') is not null and (p_payload->>'bookingId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'A linked booking must be an exact source UUID.' using errcode='22023';
  end if;

  -- Every numeric field is type/range checked before casting. The database
  -- independently recomputes totals, so caller-supplied scenario totals cannot
  -- overwrite persisted calculations.
  for v_site in select value from jsonb_array_elements(p_payload->'input'->'sites') loop
    if jsonb_typeof(v_site) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_site)) <> 9
       or not (v_site ?& array['id','name','location','levels','panes','crewHours','liftDays','access','notes'])
       or coalesce(v_site->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$'
       or length(coalesce(v_site->>'name','')) > 70
       or length(coalesce(v_site->>'location','')) > 180
       or length(coalesce(v_site->>'notes','')) > 2000
       or v_site->>'access' is null or v_site->>'access' not in ('review','ground','water-fed','lift') then
      raise exception 'Building scope failed validation.' using errcode='22023';
    end if;
    if jsonb_typeof(v_site->'levels') is distinct from 'number' or jsonb_typeof(v_site->'panes') is distinct from 'number'
       or jsonb_typeof(v_site->'crewHours') is distinct from 'number' or jsonb_typeof(v_site->'liftDays') is distinct from 'number' then
      raise exception 'Building quantities must be finite numbers.' using errcode='22023';
    end if;
    if (v_site->>'levels')::numeric not between 0 and 100
       or (v_site->>'panes')::numeric not between 0 and 100000
       or (v_site->>'crewHours')::numeric not between 0 and 10000
       or (v_site->>'liftDays')::numeric not between 0 and 365 then
      raise exception 'Building quantities exceed supported limits.' using errcode='22023';
    end if;
    v_labor := v_labor + round((v_site->>'crewHours')::numeric * coalesce((p_payload->'input'->>'laborRate')::numeric,0),2);
    v_equipment := v_equipment + round((v_site->>'liftDays')::numeric * coalesce((p_payload->'input'->>'liftDaily')::numeric,0),2);
    v_site_index := v_site_index + 1;
  end loop;
  for v_site in select value from jsonb_each(p_payload->'input') where key <> 'sites' loop
    if jsonb_typeof(v_site) is distinct from 'number' then
      raise exception 'Cost assumptions must be finite numbers.' using errcode='22023';
    end if;
  end loop;
  v_labor_rate := (p_payload->'input'->>'laborRate')::numeric;
  v_lift_daily := (p_payload->'input'->>'liftDaily')::numeric;
  v_materials := (p_payload->'input'->>'materials')::numeric;
  v_mobilization := (p_payload->'input'->>'mobilization')::numeric;
  v_other := (p_payload->'input'->>'other')::numeric;
  v_contingency := (p_payload->'input'->>'contingency')::numeric;
  v_margin := (p_payload->'input'->>'margin')::numeric;
  v_deposit := (p_payload->'input'->>'deposit')::numeric;
  if v_labor_rate not between 0 and 10000 or v_lift_daily not between 0 and 100000
     or v_materials not between 0 and 1000000 or v_mobilization not between 0 and 1000000
     or v_other not between 0 and 1000000 or v_contingency not between 0 and 100
     or v_margin not between 0 and 90 or v_deposit not between 0 and 100 then
    raise exception 'Commercial cost assumptions exceed supported limits.' using errcode='22023';
  end if;
  v_labor := round((select coalesce(sum((value->>'crewHours')::numeric),0) from jsonb_array_elements(p_payload->'input'->'sites')) * v_labor_rate,2);
  v_equipment := round((select coalesce(sum((value->>'liftDays')::numeric),0) from jsonb_array_elements(p_payload->'input'->'sites')) * v_lift_daily,2);
  v_base := round(v_labor + v_equipment + v_materials + v_mobilization + v_other,2);
  v_contingency_cost := round(v_base * v_contingency / 100,2);
  v_total_cost := round(v_base + v_contingency_cost,2);
  v_price := round(v_total_cost / (1 - v_margin / 100),2);
  v_contribution := round(v_price - v_total_cost,2);
  v_deposit_amount := round(v_price * v_deposit / 100,2);
  v_hash := pg_catalog.md5(p_payload::text);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_organization_id::text),pg_catalog.hashtext(p_project_id::text));
  select * into v_prior from oj_private.oj_commercial_commands
    where organization_id=p_organization_id and command_id=p_command_id;
  if found then
    if v_prior.project_id<>p_project_id or v_prior.payload is distinct from p_payload then
      raise exception 'Command ID was already used for a different commercial save.' using errcode='23505';
    end if;
    return jsonb_build_object('ok',true,'replayed',true,'projectId',v_prior.project_id,
      'revision',v_prior.revision,'versionId',v_prior.estimate_version_id);
  end if;

  select revision into v_old_revision from public.oj_commercial_projects
    where organization_id=p_organization_id and id=p_project_id for update;
  if not found then
    if p_expected_revision is not null then
      return jsonb_build_object('ok',false,'conflict',true,'reason','missing');
    end if;
    v_revision := 1;
    insert into public.oj_commercial_projects(organization_id,id,title,phase,source_booking_id,
      planned_asset_ids,field_crew_plan,revision,created_by,updated_by)
    values(p_organization_id,p_project_id,btrim(p_payload->>'name'),p_payload->>'phase',
      nullif(p_payload->>'bookingId','')::uuid,
      array(select jsonb_array_elements_text(p_payload->'plannedAssetIds')),
      coalesce(p_payload->'fieldCrewPlan','{}'::jsonb),v_revision,v_actor,v_actor);
    v_action := 'project.created';
  else
    if p_expected_revision is null or p_expected_revision<>v_old_revision then
      return jsonb_build_object('ok',false,'conflict',true,'currentRevision',v_old_revision);
    end if;
    v_revision := v_old_revision + 1;
    update public.oj_commercial_projects set title=btrim(p_payload->>'name'),phase=p_payload->>'phase',
      source_booking_id=nullif(p_payload->>'bookingId','')::uuid,
      planned_asset_ids=array(select jsonb_array_elements_text(p_payload->'plannedAssetIds')),
      field_crew_plan=coalesce(p_payload->'fieldCrewPlan','{}'::jsonb),revision=v_revision,
      updated_by=v_actor,updated_at=clock_timestamp()
      where organization_id=p_organization_id and id=p_project_id;
    v_action := case when p_payload->>'phase'='archived' then 'project.archived' else 'project.updated' end;
  end if;

  insert into public.oj_commercial_estimates(organization_id,project_id,current_version)
    values(p_organization_id,p_project_id,v_revision)
    on conflict(organization_id,project_id) do update set current_version=excluded.current_version,updated_at=clock_timestamp()
    returning id into v_estimate_id;
  insert into public.oj_commercial_estimate_versions(organization_id,id,estimate_id,version,command_id,payload_hash,building_scope,review_items,created_by)
    values(p_organization_id,v_version_id,v_estimate_id,v_revision,p_command_id,v_hash,
      p_payload->'input'->'sites',p_payload->'review',v_actor);
  v_site_index := 0;
  for v_site in select value from jsonb_array_elements(p_payload->'input'->'sites') loop
    insert into public.oj_commercial_buildings(organization_id,estimate_version_id,sort_order,building_id,label,location,levels,panes,crew_hours,lift_days,access,notes)
    values(p_organization_id,v_version_id,v_site_index,
      v_site->>'id',coalesce(v_site->>'name',''),coalesce(v_site->>'location',''),
      (v_site->>'levels')::numeric,(v_site->>'panes')::numeric,(v_site->>'crewHours')::numeric,
      (v_site->>'liftDays')::numeric,v_site->>'access',coalesce(v_site->>'notes',''));
    v_site_index := v_site_index + 1;
  end loop;
  insert into oj_private.oj_commercial_cost_assumptions(organization_id,estimate_version_id,labor_rate,lift_daily,materials,mobilization,other_cost,contingency,target_margin,deposit_percent,labor_total,equipment_total,base_cost,contingency_cost,total_cost,scenario_price,contribution,deposit_amount)
    values(p_organization_id,v_version_id,v_labor_rate,v_lift_daily,v_materials,v_mobilization,v_other,
      v_contingency,v_margin,v_deposit,v_labor,v_equipment,v_base,v_contingency_cost,v_total_cost,v_price,v_contribution,v_deposit_amount);
  insert into public.oj_commercial_history(organization_id,project_id,estimate_version_id,actor_id,action,revision,command_id)
    values(p_organization_id,p_project_id,v_version_id,v_actor,v_action,v_revision,p_command_id);
  insert into oj_private.oj_commercial_commands(organization_id,command_id,project_id,estimate_version_id,revision,payload)
    values(p_organization_id,p_command_id,p_project_id,v_version_id,v_revision,p_payload);
  return jsonb_build_object('ok',true,'replayed',false,'projectId',p_project_id,
    'revision',v_revision,'versionId',v_version_id);
end;
$$;

create or replace function public.oj_commercial_projects_list(
  p_organization_id uuid,
  p_limit integer default 24,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_items jsonb;
  v_next_at timestamptz;
  v_next_id uuid;
  v_has_more boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to access commercial estimates.' using errcode='28000'; end if;
  v_role := oj_private.member_role(p_organization_id);
  if v_role is null or v_role not in ('owner','member') then raise exception 'Internal estimates are available to current owners and members only.' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Page size must be between 1 and 100.' using errcode='22023'; end if;
  with page as (
    select p.*,e.id estimate_id,e.current_version,v.id version_id,v.building_scope,v.review_items,
      c.labor_rate,c.lift_daily,c.materials,c.mobilization,c.other_cost,c.contingency,c.target_margin,c.deposit_percent
    from public.oj_commercial_projects p
    join public.oj_commercial_estimates e on e.organization_id=p.organization_id and e.project_id=p.id
    join public.oj_commercial_estimate_versions v on v.organization_id=e.organization_id and v.estimate_id=e.id and v.version=e.current_version
    join oj_private.oj_commercial_cost_assumptions c on c.organization_id=v.organization_id and c.estimate_version_id=v.id
    where p.organization_id=p_organization_id
      and (p_before_updated_at is null or (p.updated_at,p.id)<(p_before_updated_at,p_before_id))
    order by p.updated_at desc,p.id desc limit p_limit+1
  ), numbered as (select page.*,row_number() over(order by updated_at desc,id desc) rn from page)
  select coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'revision',revision,'createdAt',created_at,'updatedAt',updated_at,'name',title,'phase',phase,
      'bookingId',source_booking_id,'plannedAssetIds',to_jsonb(planned_asset_ids),'fieldCrewPlan',field_crew_plan,
      'review',review_items,
      'input',jsonb_build_object('sites',building_scope,'laborRate',labor_rate,'liftDaily',lift_daily,
        'materials',materials,'mobilization',mobilization,'other',other_cost,'contingency',contingency,
        'margin',target_margin,'deposit',deposit_percent)
    ) order by updated_at desc,id desc) filter(where rn<=p_limit) from numbered),'[]'::jsonb),
    (select updated_at from numbered where rn=p_limit),(select id from numbered where rn=p_limit),
    (select count(*)>p_limit from numbered)
    into v_items,v_next_at,v_next_id,v_has_more;
  return jsonb_build_object('projects',v_items,'nextUpdatedAt',v_next_at,'nextId',v_next_id,
    'hasMore',coalesce(v_has_more,false));
end;
$$;

create or replace function public.oj_commercial_project_get(
  p_organization_id uuid,
  p_project_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_project jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to access commercial estimates.' using errcode='28000'; end if;
  v_role := oj_private.member_role(p_organization_id);
  if v_role is null or v_role not in ('owner','member') then raise exception 'Internal estimates are available to current owners and members only.' using errcode='42501'; end if;
  select jsonb_build_object(
    'id',p.id,'revision',p.revision,'createdAt',p.created_at,'updatedAt',p.updated_at,'name',p.title,'phase',p.phase,
    'bookingId',p.source_booking_id,'plannedAssetIds',to_jsonb(p.planned_asset_ids),'fieldCrewPlan',p.field_crew_plan,
    'review',v.review_items,
    'input',jsonb_build_object('sites',v.building_scope,'laborRate',c.labor_rate,'liftDaily',c.lift_daily,
      'materials',c.materials,'mobilization',c.mobilization,'other',c.other_cost,'contingency',c.contingency,
      'margin',c.target_margin,'deposit',c.deposit_percent)
  ) into v_project
  from public.oj_commercial_projects p
  join public.oj_commercial_estimates e on e.organization_id=p.organization_id and e.project_id=p.id
  join public.oj_commercial_estimate_versions v on v.organization_id=e.organization_id and v.estimate_id=e.id and v.version=e.current_version
  join oj_private.oj_commercial_cost_assumptions c on c.organization_id=v.organization_id and c.estimate_version_id=v.id
  where p.organization_id=p_organization_id and p.id=p_project_id;
  return v_project;
end;
$$;

revoke all on function public.oj_commercial_project_save(uuid,uuid,integer,uuid,jsonb) from public,anon;
revoke all on function public.oj_commercial_projects_list(uuid,integer,timestamptz,uuid) from public,anon;
revoke all on function public.oj_commercial_project_get(uuid,uuid) from public,anon;
grant execute on function public.oj_commercial_project_save(uuid,uuid,integer,uuid,jsonb) to authenticated;
grant execute on function public.oj_commercial_projects_list(uuid,integer,timestamptz,uuid) to authenticated;
grant execute on function public.oj_commercial_project_get(uuid,uuid) to authenticated;
