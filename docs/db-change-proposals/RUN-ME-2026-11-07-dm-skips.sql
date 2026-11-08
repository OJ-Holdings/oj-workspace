-- NOT APPLIED. Founder review and verified production backup required.
-- Durable Daily 10 skip reasons and audited actor, original sheet row, business and channel.
begin;
create table if not exists public.oj_outreach_skips (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.oj_organizations(id),
 prospect_id uuid not null,
 actor_id uuid not null references auth.users(id),
 business_name text not null,
 source_row integer not null,
 channel text not null check (channel in ('instagram','facebook','linkedin','other')),
 reason text not null check (reason in ('Gap isn''t real','Page or profile dead','Wrong person or name','Already contacted or a customer','Message is bad','Not a fit','Other')),
 note text not null default '' check (length(note) <= 160),
 skipped_at timestamptz not null default now(),
 unique(organization_id, prospect_id),
 foreign key (organization_id,prospect_id) references public.oj_outreach_prospects(organization_id,id)
);
create index if not exists oj_outreach_skips_latest on public.oj_outreach_skips(organization_id,skipped_at desc);
alter table public.oj_outreach_skips enable row level security;
revoke all on public.oj_outreach_skips from public,anon,authenticated;
grant select on public.oj_outreach_skips to authenticated;
create policy oj_skips_members_read on public.oj_outreach_skips for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create or replace function public.oj_skip_dm_prospect(p_org uuid,p_prospect uuid,p_channel text,p_reason text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.oj_outreach_prospects; found_id uuid;
begin
 if auth.uid() is null or coalesce(oj_private.member_role(p_org),'') not in ('owner','member') then
  raise exception 'Workspace member access required'; end if;
 if p_channel not in ('instagram','facebook','linkedin','other') then raise exception 'Invalid channel'; end if;
 if p_reason not in ('Gap isn''t real','Page or profile dead','Wrong person or name','Already contacted or a customer','Message is bad','Not a fit','Other') then raise exception 'Invalid skip reason'; end if;
 if p_note is null or length(p_note)>160 or (p_reason='Other' and length(btrim(p_note))=0) then
  raise exception 'Add a short note for Other (max 160)'; end if;
 select * into p from public.oj_outreach_prospects where organization_id=p_org and id=p_prospect for update;
 if not found then raise exception 'Prospect not found'; end if;
 if coalesce(p.outreach_status,p.source_status) not in ('Not Sent','Emailed') then
  raise exception 'Prospect has already been contacted or removed'; end if;
 insert into public.oj_outreach_skips(organization_id,prospect_id,actor_id,business_name,source_row,channel,reason,note)
 values(p_org,p_prospect,auth.uid(),p.business_name,p.source_row,p_channel,p_reason,btrim(p_note))
 on conflict(organization_id,prospect_id) do nothing returning id into found_id;
 return jsonb_build_object('ok',true,'created',found_id is not null);
end $$;
revoke all on function public.oj_skip_dm_prospect(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.oj_skip_dm_prospect(uuid,uuid,text,text,text) to authenticated;
commit;
