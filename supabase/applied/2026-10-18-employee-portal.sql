-- OJ employee portal, v1. REVIEW ONLY until tested on the configured OJ project.
-- Employees are deliberately separate from oj_memberships: workspace members
-- and viewers can read company records, while employees must read assigned work only.

create table oj_private.employees (
  organization_id uuid not null references public.oj_organizations(id),
  user_id uuid not null references auth.users(id),
  email text not null check (length(email) between 3 and 254),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id),
  unique (user_id)
);

create table oj_private.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  email text not null check (length(email) between 3 and 254),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
create index oj_employee_invites_org on oj_private.employee_invitations(organization_id,created_at desc);

create table oj_private.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  employee_id uuid not null,
  commission_percent numeric(5,2) not null check (commission_percent between 0 and 100),
  instructions text not null default '' check (length(instructions) <= 2000),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=40),
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,employee_id) references oj_private.employees(organization_id,user_id)
);
create index oj_employee_assignments_worker on oj_private.employee_assignments(employee_id,organization_id);

create table oj_private.employee_closeouts (
  assignment_id uuid primary key references oj_private.employee_assignments(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned','accepted','in_progress','submitted','verified')),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=40),
  notes text not null default '' check (length(notes)<=4000),
  submitted_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table oj_private.employee_earnings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  assignment_id uuid not null references oj_private.employee_assignments(id),
  employee_id uuid not null,
  entry_type text not null default 'commission' check (entry_type in ('commission','adjustment')),
  commission_percent numeric(5,2),
  collected_amount numeric(12,2) not null check (collected_amount >= 0),
  amount numeric(12,2) not null,
  reason text not null default '' check (length(reason)<=1000),
  status text not null default 'approved' check (status in ('approved','paid')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  paid_by uuid references auth.users(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id,employee_id) references oj_private.employees(organization_id,user_id),
  check ((status='approved' and paid_at is null and paid_by is null) or (status='paid' and paid_at is not null and paid_by is not null)),
  check (entry_type <> 'commission' or (commission_percent is not null and commission_percent between 0 and 100 and amount >= 0)),
  check (entry_type <> 'adjustment' or (commission_percent is null and length(btrim(reason)) between 1 and 1000))
);
create unique index oj_employee_one_commission on oj_private.employee_earnings(assignment_id) where entry_type='commission';
create index oj_employee_earnings_worker on oj_private.employee_earnings(employee_id,organization_id,created_at desc);

create table oj_private.employee_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  assignment_id uuid not null,
  actor_id uuid not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table oj_private.employees enable row level security;
alter table oj_private.employee_invitations enable row level security;
alter table oj_private.employee_assignments enable row level security;
alter table oj_private.employee_closeouts enable row level security;
alter table oj_private.employee_earnings enable row level security;
alter table oj_private.employee_audit enable row level security;
revoke all on oj_private.employees,oj_private.employee_invitations,oj_private.employee_assignments,
  oj_private.employee_closeouts,oj_private.employee_earnings,oj_private.employee_audit from public,anon,authenticated;

create function oj_private.is_employee(org uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from oj_private.employees e where e.organization_id=org and e.user_id=(select auth.uid()) and e.active)
$$;
revoke all on function oj_private.is_employee(uuid) from public,anon;
grant execute on function oj_private.is_employee(uuid) to authenticated;

create function public.oj_validate_employee_invitation(token text,email_address text) returns boolean
language sql stable security definer set search_path='' as $$
  select token ~ '^[a-f0-9]{64}$' and exists (
    select 1 from oj_private.employee_invitations i
    join public.oj_memberships m on m.organization_id=i.organization_id and m.user_id=i.created_by and m.role='owner'
    where i.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and i.email=lower(btrim(email_address))
      and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
  )
$$;

create function public.oj_create_employee_invitation(org uuid,email_address text,digest text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; normalized text;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  normalized:=lower(btrim(email_address));
  if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid employee invitation'; end if;
  if exists(select 1 from oj_private.employees where organization_id=org and email=normalized and active) then raise exception 'Employee already active'; end if;
  perform 1 from public.oj_organizations where id=org for update;
  if (select count(*) from oj_private.employee_invitations where organization_id=org and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation limit reached'; end if;
  update oj_private.employee_invitations set revoked_at=now() where organization_id=org and email=normalized and accepted_at is null and revoked_at is null;
  insert into oj_private.employee_invitations(organization_id,email,token_hash,created_by) values(org,normalized,digest,auth.uid()) returning id into result;
  return result;
end $$;

create function public.oj_list_employee_invitations(org uuid)
returns table(id uuid,email text,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz,accepted_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  return query select i.id,i.email,i.created_at,i.expires_at,i.revoked_at,i.accepted_at from oj_private.employee_invitations i where i.organization_id=org order by i.created_at desc limit 50;
end $$;

create function public.oj_revoke_employee_invitation(org uuid,invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  update oj_private.employee_invitations set revoked_at=now() where organization_id=org and id=invitation_id and accepted_at is null and revoked_at is null;
end $$;

create function public.oj_accept_employee_invitation(token text,display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i oj_private.employee_invitations%rowtype; verified_email text;
begin
  if auth.uid() is null or token !~ '^[a-f0-9]{64}$' or display_name is null or length(btrim(display_name)) not between 1 and 120 then raise exception 'Invalid invitation'; end if;
  select lower(u.email) into verified_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verify your account email first'; end if;
  select * into i from oj_private.employee_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
  if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() or i.email is distinct from verified_email then raise exception 'Invitation unavailable'; end if;
  if not exists(select 1 from public.oj_memberships m where m.organization_id=i.organization_id and m.user_id=i.created_by and m.role='owner') then raise exception 'Invitation unavailable'; end if;
  if exists(select 1 from public.oj_memberships m where m.user_id=auth.uid()) then raise exception 'Workspace member accounts cannot be employee-only accounts'; end if;
  insert into oj_private.employees(organization_id,user_id,email,display_name) values(i.organization_id,auth.uid(),verified_email,btrim(display_name));
  update oj_private.employee_invitations set accepted_at=now(),accepted_by=auth.uid() where id=i.id;
  return i.organization_id;
end $$;

create function public.oj_employee_context()
returns table(display_name text)
language sql stable security definer set search_path='' as $$
  select e.display_name from oj_private.employees e where e.user_id=(select auth.uid()) and e.active limit 1
$$;

create function public.oj_employee_admin_list(org uuid)
returns table(user_id uuid,display_name text,email text,active boolean)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  return query select e.user_id,e.display_name,e.email,e.active from oj_private.employees e where e.organization_id=org order by e.display_name;
end $$;

create function public.oj_employee_set_active(org uuid,employee uuid,is_active boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  if employee=auth.uid() then raise exception 'Owner cannot manage their own employee status'; end if;
  update oj_private.employees set active=is_active where organization_id=org and user_id=employee;
  if not found then raise exception 'Employee unavailable'; end if;
end $$;

create function public.oj_employee_assignment_list(org uuid)
returns table(assignment_id uuid,booking_id uuid,employee_id uuid,employee_name text,job_date date,time_block text,service text,address text,lead_status text,commission_percent numeric,instructions text,checklist jsonb,closeout_status text,closeout_checklist jsonb,closeout_notes text,customer_paid numeric,commission_id uuid,commission_amount numeric,commission_status text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  return query select a.id,b.id,a.employee_id,e.display_name,b.date,b.time_block::text,l.service_requested::text,l.address,l.status::text,a.commission_percent,a.instructions,a.checklist,c.status,c.checklist,c.notes,l.job_revenue,x.id,x.amount,x.status
    from oj_private.employee_assignments a join oj_private.employees e on e.organization_id=a.organization_id and e.user_id=a.employee_id
    join public.bookings b on b.id=a.booking_id join public.leads l on l.id=b.lead_id
    left join oj_private.employee_closeouts c on c.assignment_id=a.id
    left join oj_private.employee_earnings x on x.assignment_id=a.id and x.entry_type='commission'
    where a.organization_id=org order by b.date desc,b.time_block;
end $$;

create function public.oj_employee_admin_earnings(org uuid)
returns table(id uuid,assignment_id uuid,employee_id uuid,employee_name text,entry_type text,amount numeric,reason text,status text,approved_at timestamptz,paid_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  return query select x.id,x.assignment_id,x.employee_id,e.display_name,x.entry_type,x.amount,x.reason,x.status,x.approved_at,x.paid_at
    from oj_private.employee_earnings x join oj_private.employees e on e.organization_id=x.organization_id and e.user_id=x.employee_id
    where x.organization_id=org order by x.created_at desc;
end $$;

create function public.oj_employee_assignment_save(org uuid,booking uuid,employee uuid,commission_percent numeric,instructions text,checklist jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; current_id uuid; current_employee uuid; current_rate numeric; item jsonb; normalized_instructions text;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  if commission_percent is null or commission_percent<0 or commission_percent>100 or scale(commission_percent)>2 then raise exception 'Commission rate must be 0–100 with at most two decimals'; end if;
  normalized_instructions:=coalesce(instructions,'');
  if length(normalized_instructions)>2000 or checklist is null or jsonb_typeof(checklist)<>'array' or jsonb_array_length(checklist)>40 then raise exception 'Invalid job instructions or checklist'; end if;
  for item in select value from jsonb_array_elements(checklist) loop
    if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'text') is distinct from 'string' or length(btrim(item->>'text')) not between 1 and 300 or jsonb_typeof(item->'done') is distinct from 'boolean' then raise exception 'Invalid checklist item'; end if;
  end loop;
  if not exists(select 1 from oj_private.employees e where e.organization_id=org and e.user_id=employee and e.active) then raise exception 'Employee is inactive or unavailable'; end if;
  if not exists(select 1 from public.bookings b where b.id=booking and coalesce(b.status,'') not in ('denied','cancelled')) then raise exception 'Booking is unavailable'; end if;
  select id into current_id from oj_private.employee_assignments where organization_id=org and booking_id=booking for update;
  if current_id is not null then
    select employee_id,commission_percent into current_employee,current_rate from oj_private.employee_assignments where id=current_id;
  end if;
  if current_id is not null and exists(select 1 from oj_private.employee_earnings where assignment_id=current_id and status='paid' and entry_type='commission') then raise exception 'A paid assignment cannot be changed'; end if;
  if current_id is not null and exists(select 1 from oj_private.employee_earnings where assignment_id=current_id and entry_type='commission') and exists(select 1 from oj_private.employee_assignments where id=current_id and employee_id<>employee) then raise exception 'An approved commission cannot be transferred to another employee'; end if;
  if current_id is not null and exists(select 1 from oj_private.employee_assignments where id=current_id and employee_id<>employee) and exists(select 1 from oj_private.employee_closeouts where assignment_id=current_id and status<>'assigned') then raise exception 'An acknowledged job cannot be transferred after employee work begins'; end if;
  if current_id is not null and exists(select 1 from oj_private.employee_earnings where assignment_id=current_id and entry_type='commission') and current_rate is distinct from commission_percent then raise exception 'Approved commission rate is preserved; record an adjustment with a reason'; end if;
  insert into oj_private.employee_assignments(organization_id,booking_id,employee_id,commission_percent,instructions,checklist,assigned_by)
  values(org,booking,employee,commission_percent,normalized_instructions,checklist,auth.uid())
  on conflict(booking_id) do update set employee_id=excluded.employee_id,commission_percent=excluded.commission_percent,instructions=excluded.instructions,checklist=excluded.checklist,assigned_by=excluded.assigned_by,updated_at=now()
  returning id into result;
  insert into oj_private.employee_closeouts(assignment_id,checklist) values(result,checklist) on conflict(assignment_id) do nothing;
  update oj_private.employee_closeouts set checklist=oj_employee_assignment_save.checklist,updated_at=now() where assignment_id=result and status='assigned';
  insert into oj_private.employee_audit(organization_id,assignment_id,actor_id,action,detail)
  values(org,result,auth.uid(),case when current_id is null then 'assigned' else 'assignment_changed' end,jsonb_build_object('old_employee_id',current_employee,'employee_id',employee,'old_commission_percent',current_rate,'commission_percent',commission_percent,'instructions',normalized_instructions,'checklist',checklist));
  return result;
end $$;

create function public.oj_employee_jobs()
returns table(assignment_id uuid,job_date date,time_block text,service text,address text,instructions text,commission_percent numeric,lead_status text,closeout_status text,checklist jsonb,closeout_notes text,commission_status text,commission_estimate numeric)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from oj_private.employees where user_id=auth.uid() and active) then raise exception 'Employee access required'; end if;
  return query select a.id,b.date,b.time_block::text,l.service_requested::text,l.address,a.instructions,a.commission_percent,l.status::text,c.status,c.checklist,c.notes,x.status,
    case when l.job_revenue is null or l.job_revenue<=0 then null else round(l.job_revenue*a.commission_percent/100,2) end
  from oj_private.employee_assignments a join oj_private.employees e on e.organization_id=a.organization_id and e.user_id=a.employee_id
  join public.bookings b on b.id=a.booking_id join public.leads l on l.id=b.lead_id
  left join oj_private.employee_closeouts c on c.assignment_id=a.id
  left join oj_private.employee_earnings x on x.assignment_id=a.id and x.entry_type='commission'
  where e.user_id=auth.uid() and e.active and b.status not in ('denied','cancelled') order by b.date desc,b.time_block;
end $$;

create function public.oj_employee_closeout_update(assignment uuid,new_status text,new_checklist jsonb,new_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare a oj_private.employee_assignments%rowtype; old_status text; item jsonb;
begin
  select * into a from oj_private.employee_assignments where id=assignment and employee_id=auth.uid() for update;
  if not found or not oj_private.is_employee(a.organization_id) then raise exception 'Assignment unavailable'; end if;
  select status into old_status from oj_private.employee_closeouts where assignment_id=assignment for update;
  if old_status not in ('assigned','accepted','in_progress') or new_status not in ('accepted','in_progress','submitted') then raise exception 'Closeout cannot be changed'; end if;
  if (old_status='assigned' and new_status not in ('accepted','in_progress')) or (old_status='accepted' and new_status not in ('accepted','in_progress')) or (old_status='in_progress' and new_status not in ('in_progress','submitted')) then raise exception 'Invalid closeout transition'; end if;
  if new_checklist is null or jsonb_typeof(new_checklist)<>'array' or jsonb_array_length(new_checklist)>40 or new_notes is null or length(new_notes)>4000 then raise exception 'Invalid closeout'; end if;
  for item in select value from jsonb_array_elements(new_checklist) loop
    if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'text') is distinct from 'string' or length(btrim(item->>'text')) not between 1 and 300 or jsonb_typeof(item->'done') is distinct from 'boolean' then raise exception 'Invalid checklist item'; end if;
  end loop;
  update oj_private.employee_closeouts c set status=new_status,checklist=new_checklist,notes=new_notes,submitted_at=case when new_status='submitted' then coalesce(c.submitted_at,now()) else c.submitted_at end,updated_at=now() where c.assignment_id=assignment;
  insert into oj_private.employee_audit(organization_id,assignment_id,actor_id,action) values(a.organization_id,a.id,auth.uid(),'closeout_'||new_status);
end $$;

create function public.oj_employee_earnings()
returns table(id uuid,assignment_id uuid,entry_type text,commission_percent numeric,amount numeric,reason text,status text,approved_at timestamptz,paid_at timestamptz,job_date date,service text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from oj_private.employees where user_id=auth.uid() and active) then raise exception 'Employee access required'; end if;
  return query select x.id,x.assignment_id,x.entry_type,x.commission_percent,x.amount,x.reason,x.status,x.approved_at,x.paid_at,b.date,l.service_requested::text
  from oj_private.employee_earnings x join oj_private.employee_assignments a on a.id=x.assignment_id join public.bookings b on b.id=a.booking_id join public.leads l on l.id=b.lead_id
  where x.employee_id=auth.uid() order by x.created_at desc;
end $$;

create function public.oj_employee_commission_approve(org uuid,assignment uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a oj_private.employee_assignments%rowtype; b public.bookings%rowtype; l public.leads%rowtype; result uuid; amount numeric;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  select * into a from oj_private.employee_assignments where id=assignment and organization_id=org for update;
  if not found then raise exception 'Assignment unavailable'; end if;
  select * into b from public.bookings where id=a.booking_id;
  select * into l from public.leads where id=b.lead_id;
  if l.status is distinct from 'completed' or l.job_revenue is null or l.job_revenue<=0 then raise exception 'Complete the job and record collected payment first'; end if;
  amount:=round(l.job_revenue*a.commission_percent/100,2);
  insert into oj_private.employee_earnings(organization_id,assignment_id,employee_id,entry_type,commission_percent,collected_amount,amount,approved_by)
  values(org,a.id,a.employee_id,'commission',a.commission_percent,l.job_revenue,amount,auth.uid()) returning id into result;
  insert into oj_private.employee_audit(organization_id,assignment_id,actor_id,action,detail) values(org,a.id,auth.uid(),'commission_approved',jsonb_build_object('rate',a.commission_percent,'collected',l.job_revenue,'amount',amount));
  return result;
end $$;

create function public.oj_employee_closeout_verify(org uuid,assignment uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  update oj_private.employee_closeouts c set status='verified',verified_at=now(),updated_at=now()
    from oj_private.employee_assignments a where a.id=c.assignment_id and a.id=assignment and a.organization_id=org and c.status='submitted';
  if not found then raise exception 'Submitted closeout unavailable'; end if;
  insert into oj_private.employee_audit(organization_id,assignment_id,actor_id,action) values(org,assignment,auth.uid(),'closeout_verified');
end $$;

create function public.oj_employee_commission_adjust(org uuid,earning uuid,delta numeric,reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare base oj_private.employee_earnings%rowtype; result uuid;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  if delta is null or delta=0 or delta<>round(delta,2) or abs(delta)>=100000000 or length(btrim(coalesce(reason,''))) not between 1 and 1000 then raise exception 'Enter a non-zero adjustment in cents and a reason'; end if;
  select * into base from oj_private.employee_earnings where id=earning and organization_id=org and entry_type='commission' for update;
  if not found then raise exception 'Commission unavailable'; end if;
  insert into oj_private.employee_earnings(organization_id,assignment_id,employee_id,entry_type,collected_amount,amount,reason,approved_by)
  values(org,base.assignment_id,base.employee_id,'adjustment',0,round(delta,2),btrim(reason),auth.uid()) returning id into result;
  insert into oj_private.employee_audit(organization_id,assignment_id,actor_id,action,detail) values(org,base.assignment_id,auth.uid(),'commission_adjusted',jsonb_build_object('earning_id',earning,'delta',round(delta,2),'reason',btrim(reason)));
  return result;
end $$;

create function public.oj_employee_commission_paid(org uuid,earning uuid) returns void
language plpgsql security definer set search_path='' as $$
declare assignment_id uuid;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  update oj_private.employee_earnings set status='paid',paid_by=auth.uid(),paid_at=now() where id=earning and organization_id=org and status='approved' returning oj_private.employee_earnings.assignment_id into assignment_id;
  if not found then raise exception 'Approved unpaid entry unavailable'; end if;
  insert into oj_private.employee_audit(organization_id,assignment_id,actor_id,action) values(org,assignment_id,auth.uid(),'commission_paid');
end $$;

revoke all on function public.oj_validate_employee_invitation(text,text),public.oj_create_employee_invitation(uuid,text,text),public.oj_list_employee_invitations(uuid),public.oj_revoke_employee_invitation(uuid,uuid),public.oj_accept_employee_invitation(text,text),public.oj_employee_context(),public.oj_employee_admin_list(uuid),public.oj_employee_set_active(uuid,uuid,boolean),public.oj_employee_assignment_list(uuid),public.oj_employee_admin_earnings(uuid),public.oj_employee_assignment_save(uuid,uuid,uuid,numeric,text,jsonb),public.oj_employee_jobs(),public.oj_employee_closeout_update(uuid,text,jsonb,text),public.oj_employee_earnings(),public.oj_employee_closeout_verify(uuid,uuid),public.oj_employee_commission_approve(uuid,uuid),public.oj_employee_commission_adjust(uuid,uuid,numeric,text),public.oj_employee_commission_paid(uuid,uuid) from public,anon;
grant execute on function public.oj_validate_employee_invitation(text,text) to anon,authenticated;
grant execute on function public.oj_create_employee_invitation(uuid,text,text),public.oj_list_employee_invitations(uuid),public.oj_revoke_employee_invitation(uuid,uuid),public.oj_accept_employee_invitation(text,text),public.oj_employee_context(),public.oj_employee_admin_list(uuid),public.oj_employee_set_active(uuid,uuid,boolean),public.oj_employee_assignment_list(uuid),public.oj_employee_admin_earnings(uuid),public.oj_employee_assignment_save(uuid,uuid,uuid,numeric,text,jsonb),public.oj_employee_jobs(),public.oj_employee_closeout_update(uuid,text,jsonb,text),public.oj_employee_earnings(),public.oj_employee_closeout_verify(uuid,uuid),public.oj_employee_commission_approve(uuid,uuid),public.oj_employee_commission_adjust(uuid,uuid,numeric,text),public.oj_employee_commission_paid(uuid,uuid) to authenticated;

-- Private, assignment-scoped job photos. Employees may add images before closeout
-- submission; owner and assigned employee may view. Neither may rewrite an object.
-- Storage evaluates policies as the authenticated caller, who deliberately has no
-- SELECT on oj_private tables. Keep the ownership lookup behind narrow definer
-- helpers instead of granting broad private-table access to make policy queries work.
create function oj_private.can_read_employee_job_photo(folder text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_assignment_id uuid;
begin
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_assignment_id:=folder::uuid;
  return exists(select 1 from oj_private.employee_assignments a where a.id=v_assignment_id and
    (oj_private.member_role(a.organization_id)='owner' or (a.employee_id=(select auth.uid()) and oj_private.is_employee(a.organization_id))));
end $$;
create function oj_private.can_add_employee_job_photo(folder text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_assignment_id uuid;
begin
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_assignment_id:=folder::uuid;
  return exists(select 1 from oj_private.employee_assignments a join oj_private.employee_closeouts c on c.assignment_id=a.id
    where a.id=v_assignment_id and a.employee_id=(select auth.uid()) and oj_private.is_employee(a.organization_id) and c.status in ('assigned','accepted','in_progress'));
end $$;
revoke all on function oj_private.can_read_employee_job_photo(text),oj_private.can_add_employee_job_photo(text) from public,anon;
grant execute on function oj_private.can_read_employee_job_photo(text),oj_private.can_add_employee_job_photo(text) to authenticated;

do $$ begin
  if exists(select 1 from pg_namespace where nspname='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('oj-employee-jobs','oj-employee-jobs',false,10485760,array['image/jpeg','image/png','image/webp','image/heic'])
    on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
    execute 'drop policy if exists oj_employee_job_photo_read on storage.objects';
    execute 'drop policy if exists oj_employee_job_photo_add on storage.objects';
    execute $p$create policy oj_employee_job_photo_read on storage.objects for select to authenticated
      using(bucket_id='oj-employee-jobs' and oj_private.can_read_employee_job_photo((storage.foldername(name))[1]))$p$;
    execute $p$create policy oj_employee_job_photo_add on storage.objects for insert to authenticated
      with check(bucket_id='oj-employee-jobs' and oj_private.can_add_employee_job_photo((storage.foldername(name))[1]))$p$;
  end if;
end $$;
