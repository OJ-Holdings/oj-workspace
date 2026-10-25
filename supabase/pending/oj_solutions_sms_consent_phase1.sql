-- STAGED ONLY. Do not apply until Phase 1 founder approval.
-- Deploy before replacing the public Edge Function; never merge a form that accepts
-- SMS consent unless the database can persist it and Workspace can display it.
alter table public.oj_solutions_consultations
  add column if not exists sms_consent boolean not null default false,
  add column if not exists sms_consent_at timestamptz null;

alter table public.oj_solutions_consultations
  add constraint oj_solutions_consultation_sms_consent_valid
  check (
    (sms_consent = false and sms_consent_at is null)
    or (sms_consent = true and sms_consent_at is not null and length(btrim(phone)) >= 7)
  );

create or replace function oj_private.oj_solutions_consultation_touch()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.organization_id <> old.organization_id
     or new.email <> old.email or new.name <> old.name
     or new.preferred_date <> old.preferred_date or new.preferred_time <> old.preferred_time
     or new.sms_consent is distinct from old.sms_consent
     or new.sms_consent_at is distinct from old.sms_consent_at
     or new.created_at <> old.created_at then
    raise exception 'Consultation identity, consent, and requested slot are immutable';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function oj_private.oj_solutions_consultation_touch() from public;
