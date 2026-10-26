#!/usr/bin/env bash
# Disposable PG17 and synthetic records only. No ports or production credentials.
set -Eeuo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
container="oj-content-synth-$RANDOM-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --network none --name "$container" -e POSTGRES_PASSWORD=synthetic-content-only postgres:17 >/dev/null
ready=0
for i in $(seq 1 60); do
  if docker exec "$container" psql -X -U postgres -Atqc 'select 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'FAIL: synthetic PG17 unavailable'; exit 1; }
file(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres < "$1" >/dev/null; }
sql(){ docker exec "$container" psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -c "$1"; }
actor(){ sql "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$1',true); $2 COMMIT;" | tail -1; }
eq(){ [[ "$1" == "$2" ]] || { echo "FAIL: $3"; exit 1; }; echo "PASS: $3"; }
deny(){ if actor "$1" "$2" >/dev/null 2>&1; then echo 'FAIL: forbidden content write'; exit 1; fi; echo 'PASS: forbidden write rejected'; }
file "$repo/scripts/tests/exterior-p3-schema-bootstrap.sql"
file "$repo/supabase/schemas/workspace.sql"
file "$repo/supabase/schemas/collaboration.sql"
file "$repo/supabase/schemas/dashboard.sql"
file "$repo/supabase/schemas/work-leaderboard.sql"
org=10000000-0000-4000-8000-000000000001
owner=20000000-0000-4000-8000-000000000001
member=20000000-0000-4000-8000-000000000002
viewer=20000000-0000-4000-8000-000000000003
outsider=20000000-0000-4000-8000-000000000004
project=30000000-0000-4000-8000-000000000001
sql "insert into auth.users(id) values ('$owner'),('$member'),('$viewer'),('$outsider');
 insert into public.oj_organizations(id,name) values ('$org','Synthetic content');
 insert into public.oj_memberships(organization_id,user_id,role,display_name) values
 ('$org','$owner','owner','Owner'),('$org','$member','member','Member'),('$org','$viewer','viewer','Viewer');" >/dev/null
file "$repo/supabase/applied/2026-10-26-content-studio.sql"
file "$repo/supabase/applied/2026-10-26-content-brand-compatibility.sql"
actor "$owner" "insert into public.oj_content_projects(id,organization_id,title,kind,stage,created_by) values('$project','$org','Synthetic film','Video','Idea','$owner');" >/dev/null
eq "$(actor "$member" 'select count(*) from public.oj_content_projects;')" 1 'member independent read'
actor "$owner" "insert into public.oj_cards(organization_id,title,business) values('$org','Synthetic content task','content');" >/dev/null
eq "$(actor "$member" "select count(*) from public.oj_cards where business='content';")" 1 'content task shared read'
eq "$(actor "$member" "update public.oj_content_projects set stage='Script',revision=0 where id='$project' and revision=0 returning revision;")" 1 'revision increment'
eq "$(actor "$owner" "select count(*) from public.oj_content_projects where id='$project' and revision=0;")" 0 'stale revision unavailable'
eq "$(actor "$viewer" 'select count(*) from public.oj_content_projects;')" 1 'viewer read'
deny "$viewer" "insert into public.oj_content_projects(id,organization_id,title,kind,stage,created_by) values(gen_random_uuid(),'$org','Denied','Video','Idea','$viewer');"
eq "$(actor "$outsider" 'select count(*) from public.oj_content_projects;')" 0 'outsider isolation'
deny "$owner" "update public.oj_content_projects set stage='Published' where id='$project';"
deny "$owner" "update public.oj_content_projects set assigned_to='$outsider' where id='$project';"
deny "$owner" "update public.oj_content_activity set action='created';"
eq "$(actor "$owner" 'select count(*) from public.oj_content_activity;')" 2 'automatic activity only'
sql "delete from public.oj_memberships where user_id='$member';" >/dev/null
eq "$(actor "$member" 'select count(*) from public.oj_content_projects;')" 0 'revocation immediate'
if sql 'SET ROLE anon; select * from public.oj_content_projects;' >/dev/null 2>&1; then echo 'FAIL: anon read'; exit 1; fi
echo 'PASS: anonymous access denied; synthetic Content Studio PG17 complete'
