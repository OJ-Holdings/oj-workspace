-- OJ OS: job photos (master plan 6.1 "before and after photos", 6.15 "property memory", 6.4 crew phone flow).
-- Photos are taken on the phone from the Job sheet and stored privately: a private storage bucket, plus a table that says which job each photo belongs to,
-- whether it is a before, after or other photo, and an optional caption. Only owners and members of the workspace can see or add them; nobody is
-- ever given a public link. Additive only. Run once in the Supabase SQL editor. Until it is run the Job sheet simply shows no Photos section.
--
-- File path convention (enforced by the policies and a check): <organization id>/<job id>/<random name>.<ext>
begin;

create table public.oj_job_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  -- The job's lead (public.leads.id). No foreign key: that table belongs to the original Exterior Care app.
  lead_id uuid not null,
  storage_path text not null check (length(storage_path) between 40 and 300),
  kind text not null default 'other' check (kind in ('before','after','other')),
  caption text not null default '' check (length(caption) <= 200),
  taken_on date not null default current_date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (storage_path),
  -- A photo's file lives under its own workspace and job, so a row can never point at another company's file.
  check (storage_path like organization_id::text || '/' || lead_id::text || '/%')
);
create index oj_job_photos_lead on public.oj_job_photos(organization_id, lead_id, created_at desc);
create index oj_job_photos_created_by on public.oj_job_photos(created_by);

alter table public.oj_job_photos enable row level security;
revoke all on public.oj_job_photos from public, anon, authenticated;
grant select, insert, delete on public.oj_job_photos to authenticated;
grant update (kind, caption) on public.oj_job_photos to authenticated;
-- Photos of customers' homes are business records: owners and members only, like the customer records.
create policy photos_read on public.oj_job_photos for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));
create policy photos_add on public.oj_job_photos for insert to authenticated with check (oj_private.member_role(organization_id) in ('owner','member') and created_by = (select auth.uid()));
create policy photos_change on public.oj_job_photos for update to authenticated using (oj_private.member_role(organization_id) in ('owner','member')) with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy photos_remove on public.oj_job_photos for delete to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));

-- Storage policies evaluate as the signed-in caller, who has no direct access to the private schema, so the membership check sits behind a narrow helper.
-- The first folder of the file's path is the workspace; the caller must be an owner or member of that workspace.
create function oj_private.can_use_job_photo_folder(folder text) returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return coalesce(oj_private.member_role(folder::uuid), '') in ('owner', 'member');
end $$;
revoke all on function oj_private.can_use_job_photo_folder(text) from public, anon;
grant execute on function oj_private.can_use_job_photo_folder(text) to authenticated;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
      values ('oj-job-photos', 'oj-job-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
      on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute $p$create policy oj_job_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'oj-job-photos' and oj_private.can_use_job_photo_folder((storage.foldername(name))[1]))$p$;
    execute $p$create policy oj_job_photos_add on storage.objects for insert to authenticated
      with check (bucket_id = 'oj-job-photos' and oj_private.can_use_job_photo_folder((storage.foldername(name))[1]))$p$;
    execute $p$create policy oj_job_photos_remove on storage.objects for delete to authenticated
      using (bucket_id = 'oj-job-photos' and oj_private.can_use_job_photo_folder((storage.foldername(name))[1]))$p$;
  end if;
end $$;

commit;
