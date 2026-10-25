#!/usr/bin/env bash
# Disposable PostgreSQL 17, synthetic OJ actors and estimate records ONLY.
set -Eeuo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
container="oj-commercial-synth-$RANDOM-$$"
export PGPASSWORD='synthetic-only-do-not-use-in-production'
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD="$PGPASSWORD" postgres:17 >/dev/null
ready=0
for i in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1 &&
     [[ "$(docker exec "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc 'select 1' 2>/dev/null)" == 1 ]]; then
    ready=1; break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Synthetic PostgreSQL 17 did not start' >&2; exit 1; }
run_file(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1" >/dev/null; }
sql(){ docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$1"; }
actor(){
  local user="$1" statement="$2"
  docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc \
    "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user',true); $statement COMMIT;" | tail -n 1
}
anon(){
  local statement="$1"
  docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc \
    "BEGIN; SET LOCAL ROLE anon; $statement ROLLBACK;"
}
fail(){
  local label="$1" statement="$2"
  if sql "$statement" >/dev/null 2>&1; then echo "FAIL: $label" >&2; exit 1; fi
  echo "PASS (rejected): $label"
}
eq(){
  [[ "$1" == "$2" ]] || { echo "FAIL: $3 expected '$2', received '$1'" >&2; exit 1; }
  echo "PASS: $3"
}

org='10000000-0000-4000-8000-000000000001'
other='10000000-0000-4000-8000-000000000002'
owner='20000000-0000-4000-8000-000000000001'
member='20000000-0000-4000-8000-000000000002'
viewer='20000000-0000-4000-8000-000000000003'
outsider='20000000-0000-4000-8000-000000000004'
project='30000000-0000-4000-8000-000000000001'
project2='30000000-0000-4000-8000-000000000002'
command='40000000-0000-4000-8000-000000000001'
command2='40000000-0000-4000-8000-000000000002'
command3='40000000-0000-4000-8000-000000000003'
command4='40000000-0000-4000-8000-000000000004'
command5='40000000-0000-4000-8000-000000000005'
payload='{"name":"Synthetic campus","input":{"sites":[{"id":"building-1","name":"Building 1","location":"","levels":1,"panes":0,"crewHours":8,"liftDays":0,"access":"review","notes":""}],"laborRate":35,"liftDaily":350,"materials":0,"mobilization":0,"other":0,"contingency":15,"margin":30,"deposit":25},"review":[false,false,false,false,false],"phase":"scoping","bookingId":null,"plannedAssetIds":[],"fieldCrewPlan":{"crewSize":null,"productiveHoursPerPersonDay":null,"plannedFieldDays":null,"stagingNote":""}}'
changed='{"name":"Changed synthetic campus","input":{"sites":[{"id":"building-1","name":"Building 1","location":"","levels":1,"panes":0,"crewHours":8,"liftDays":0,"access":"review","notes":""}],"laborRate":35,"liftDaily":350,"materials":0,"mobilization":0,"other":0,"contingency":15,"margin":30,"deposit":25},"review":[false,false,false,false,false],"phase":"scoping","bookingId":null,"plannedAssetIds":[],"fieldCrewPlan":{"crewSize":null,"productiveHoursPerPersonDay":null,"plannedFieldDays":null,"stagingNote":""}}'

echo '[Commercial] Bootstrapping synthetic Auth, organizations and membership actors'
run_file "$repo/scripts/tests/exterior-p3-schema-bootstrap.sql"
run_file "$repo/supabase/schemas/workspace.sql"
run_file "$repo/supabase/schemas/collaboration.sql"
sql "INSERT INTO public.oj_organizations(id,name) VALUES ('$org','SYNTHETIC OJ'),('$other','SYNTHETIC OTHER');
 INSERT INTO auth.users(id) VALUES ('$owner'),('$member'),('$viewer'),('$outsider');
 INSERT INTO public.oj_memberships(organization_id,user_id,role,display_name) VALUES
 ('$org','$owner','owner','Synthetic Owner'),('$org','$member','member','Synthetic Member'),
 ('$org','$viewer','viewer','Synthetic Viewer'),('$other','$outsider','owner','Synthetic Outsider');" >/dev/null
echo '[Commercial] Applying the proposed additive migration ONLY to this disposable PostgreSQL 17 database'
run_file "$repo/supabase/migrations/20261025000000_oj_commercial_estimating_shared_records.sql"

receipt="$(actor "$owner" "SELECT public.oj_commercial_project_save('$org','$project',NULL,'$command','$payload'::jsonb);")"
eq "$(printf '%s' "$receipt" | jq -r '.revision')" 1 'Owner creates first shared version'
eq "$(printf '%s' "$receipt" | jq -r '.replayed')" false 'Initial write is not a retry'
eq "$(actor "$member" "SELECT public.oj_commercial_project_get('$org','$project')->>'name';")" 'Synthetic campus' 'Member reads authorized shared project'
eq "$(actor "$member" "SELECT public.oj_commercial_project_get('$org','$project')->>'revision';")" 1 'Shared project read exposes current revision'
eq "$(actor "$owner" "SELECT public.oj_commercial_projects_list('$org',1,NULL,NULL)->>'hasMore';")" false 'Single project page reports no extra records'
eq "$(sql "SELECT labor_total||':'||scenario_price||':'||deposit_amount FROM oj_private.oj_commercial_cost_assumptions LIMIT 1;")" '280.00:460.00:115.00' 'Database recomputes private internal estimate math'

replay="$(actor "$owner" "SELECT public.oj_commercial_project_save('$org','$project',NULL,'$command','$payload'::jsonb);")"
eq "$(printf '%s' "$replay" | jq -r '.replayed')" true 'Same command and payload returns idempotent receipt'
eq "$(sql 'SELECT count(*) FROM public.oj_commercial_estimate_versions;')" 1 'Idempotent retry creates no second estimate version'
fail 'Reused command ID cannot carry a different payload' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$owner',true); SELECT public.oj_commercial_project_save('$org','$project',NULL,'$command','$changed'::jsonb); ROLLBACK;"

receipt2="$(actor "$owner" "SELECT public.oj_commercial_project_save('$org','$project',1,'$command2','$changed'::jsonb);")"
eq "$(printf '%s' "$receipt2" | jq -r '.revision')" 2 'Current expected revision appends a version'
stale="$(actor "$owner" "SELECT public.oj_commercial_project_save('$org','$project',1,'$command3','$payload'::jsonb);")"
eq "$(printf '%s' "$stale" | jq -r '.conflict')" true 'Stale writer receives explicit conflict'
eq "$(printf '%s' "$stale" | jq -r '.currentRevision')" 2 'Conflict reports authoritative revision'
receipt3="$(actor "$owner" "SELECT public.oj_commercial_project_save('$org','$project',2,'$command4','$payload'::jsonb);")"
eq "$(printf '%s' "$receipt3" | jq -r '.revision')" 3 'Fresh writer can append after resolving conflict'

second="$(actor "$owner" "SELECT public.oj_commercial_project_save('$org','$project2',NULL,'$command5','$payload'::jsonb);")"
eq "$(printf '%s' "$second" | jq -r '.revision')" 1 'Second project is isolated in same organization'
page1="$(actor "$member" "SELECT public.oj_commercial_projects_list('$org',1,NULL,NULL);")"
eq "$(printf '%s' "$page1" | jq -r '.projects|length')" 1 'Keyset pagination returns bounded first page'
eq "$(printf '%s' "$page1" | jq -r '.hasMore')" true 'Keyset pagination indicates more rows'
cursor_at="$(printf '%s' "$page1" | jq -r '.nextUpdatedAt')"
cursor_id="$(printf '%s' "$page1" | jq -r '.nextId')"
page2="$(actor "$member" "SELECT public.oj_commercial_projects_list('$org',1,'$cursor_at'::timestamptz,'$cursor_id'::uuid);")"
eq "$(printf '%s' "$page2" | jq -r '.projects|length')" 1 'Keyset cursor returns next page without overlap'
eq "$(printf '%s' "$page2" | jq -r '.hasMore')" false 'Final keyset page reports completion'

fail 'Viewer cannot list internal projects' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$viewer',true); SELECT public.oj_commercial_projects_list('$org',10,NULL,NULL); ROLLBACK;"
fail 'Other organization owner cannot read this tenant' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$outsider',true); SELECT public.oj_commercial_project_get('$org','$project'); ROLLBACK;"
fail 'Authenticated members have no direct project table access' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$member',true); SELECT * FROM public.oj_commercial_projects; ROLLBACK;"
fail 'Authenticated members have no direct private cost access' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$owner',true); SELECT * FROM oj_private.oj_commercial_cost_assumptions; ROLLBACK;"
fail 'Anonymous role cannot call project RPC' "BEGIN; SET LOCAL ROLE anon; SELECT public.oj_commercial_projects_list('$org',10,NULL,NULL); ROLLBACK;"
fail 'Database rejects unsupported margin' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$owner',true); SELECT public.oj_commercial_project_save('$org','50000000-0000-4000-8000-000000000001',NULL,'50000000-0000-4000-8000-000000000002',jsonb_set('$payload'::jsonb,'{input,margin}','99'::jsonb)); ROLLBACK;"
fail 'Database rejects unsupported crew scenario' "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$owner',true); SELECT public.oj_commercial_project_save('$org','50000000-0000-4000-8000-000000000003',NULL,'50000000-0000-4000-8000-000000000004',jsonb_set('$payload'::jsonb,'{fieldCrewPlan,crewSize}','41'::jsonb)); ROLLBACK;"

eq "$(sql "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname LIKE 'oj_commercial_%' OR n.nspname='oj_private' AND c.relname LIKE 'oj_commercial_%') AND c.relkind='r' AND c.relrowsecurity;")" 7 'RLS enabled on every commercial relation'
eq "$(sql "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='authenticated' AND table_name LIKE 'oj_commercial_%' AND privilege_type IN ('INSERT','UPDATE','DELETE');")" 0 'Authenticated role has no direct commercial table writes'
eq "$(sql 'SELECT count(*) FROM public.oj_commercial_estimate_versions;')" 4 'Only accepted writes appended immutable commercial versions'
eq "$(sql 'SELECT count(*) FROM public.oj_commercial_history;')" 4 'Every accepted version has a persisted history receipt'
echo 'SUCCESS: synthetic PostgreSQL 17 commercial persistence, roles, tenant isolation, CAS, idempotency, private costs and pagination.'
echo 'NO production DDL, real customer data, quotes, jobs, payments or customer communications were performed.'
