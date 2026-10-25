#!/usr/bin/env bash
# Disposable PostgreSQL 17, synthetic actor and P3 source records ONLY.
set -Eeuo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
container="oj-p3-synth-$RANDOM-$$"
export PGPASSWORD="synthetic-only-do-not-use-in-production"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD="$PGPASSWORD" postgres:17 >/dev/null
ready=0
for i in $(seq 1 60); do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1 &&
    [[ "$(docker exec "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc 'select 1' 2>/dev/null)" == 1 ]];then
  ready=1;break
 fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo "Synthetic PostgreSQL 17 did not start" >&2;exit 1; }
run_file(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1" >/dev/null; }
sql(){ docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc "$1"; }
fail(){
 local label="$1" statement="$2"
 if sql "$statement" >/dev/null 2>&1;then echo "FAIL: $label" >&2;exit 1;fi
 echo "PASS (rejected): $label"
}
eq(){
 [[ "$1" == "$2" ]] || { echo "FAIL: $3 expected $2, received $1" >&2;exit 1; }
 echo "PASS: $3"
}
actor_count(){
 sql "BEGIN; SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','$1',true);
 SELECT count(*) FROM public.$2 WHERE organization_id='$3';
 ROLLBACK;" | tail -n 1
}
echo "[P3.1] Preparing fake Auth + genuine workspace membership SQL"
run_file "$repo/scripts/tests/exterior-p3-schema-bootstrap.sql"
run_file "$repo/supabase/schemas/workspace.sql"
echo "[P3.1] Applying production-INERT P3 staging schema to disposable PostgreSQL"
run_file "$repo/supabase/staging/exterior-p3-foundation.sql"
run_file "$repo/scripts/tests/exterior-p3-schema-seed.sql"
org="10000000-0000-4000-8000-000000000001"
other="10000000-0000-4000-8000-000000000002"
owner="20000000-0000-4000-8000-000000000001"
member="20000000-0000-4000-8000-000000000002"
viewer="20000000-0000-4000-8000-000000000003"
outsider="20000000-0000-4000-8000-000000000004"
revoked="20000000-0000-4000-8000-000000000005"
other_owner="20000000-0000-4000-8000-000000000006"
eq "$(actor_count "$owner" oj_exterior_customers "$org")" 1 "Owner reads own customer"
eq "$(actor_count "$member" oj_exterior_customers "$org")" 1 "Member reads own customer"
eq "$(actor_count "$viewer" oj_exterior_customers "$org")" 0 "Viewer denied customer"
eq "$(actor_count "$outsider" oj_exterior_customers "$org")" 0 "Outsider denied customer"
eq "$(actor_count "$other_owner" oj_exterior_customers "$org")" 0 "Other tenant cannot read customer"
eq "$(actor_count "$other_owner" oj_exterior_customers "$other")" 1 "Other tenant reads own customer"
for table in oj_exterior_properties oj_exterior_legacy_links oj_exterior_opportunities \
 oj_exterior_quotes oj_exterior_quote_versions oj_exterior_quote_claims \
 oj_exterior_work_orders oj_exterior_order_events;do
 actor_count "$member" "$table" "$org" >/dev/null
 eq "$(actor_count "$viewer" "$table" "$org")" 0 "Viewer blocked: $table"
done
eq "$(actor_count "$revoked" oj_exterior_quote_versions "$org")" 3 "Member before revocation sees all three staged versions"
sql "DELETE FROM public.oj_memberships WHERE organization_id='$org' AND user_id='$revoked';" >/dev/null
eq "$(actor_count "$revoked" oj_exterior_quote_versions "$org")" 0 "Revoked user blocked without JWT refresh"
fail "Anon has no quote SELECT grant" \
 "BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.oj_exterior_quotes;ROLLBACK;"
fail "Owner has no private provider-receipt SELECT" \
 "BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','$owner',true);
 SELECT count(*) FROM oj_private.oj_exterior_verified_acceptances;ROLLBACK;"
fail "Member has no direct proposal INSERT" \
 "BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','$member',true);
 INSERT INTO public.oj_exterior_customers(organization_id,display_name,created_by)
 VALUES('$org','Unapproved client','$member');ROLLBACK;"
fail "Member cannot forge a customer-accepted claim" \
 "BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','$member',true);
 INSERT INTO public.oj_exterior_quote_claims(
 organization_id,quote_id,version_id,kind,reference,recorded_by,verification_state)
 VALUES('$org','60000000-0000-4000-8000-000000000001',
 '70000000-0000-4000-8000-000000000001','operator-report','Forged accepted',
 '$member','verified');ROLLBACK;"
eq "$(sql "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE ((n.nspname='public' AND c.relname LIKE 'oj_exterior_%')
 OR (n.nspname='oj_private' AND c.relname='oj_exterior_verified_acceptances'))
 AND c.relkind='r' AND c.relrowsecurity;")" 10 "All ten P3 tables have RLS"
eq "$(sql "SELECT count(*) FROM information_schema.role_table_grants
 WHERE grantee='authenticated' AND table_name LIKE 'oj_exterior_%'
 AND privilege_type IN ('INSERT','UPDATE','DELETE');")" 0 "Authenticated has no direct P3 write grants"
eq "$(sql "SELECT latest_version_sequence::text||':'||revision::text
 FROM public.oj_exterior_quotes WHERE organization_id='$org'
 AND id='60000000-0000-4000-8000-000000000002';")" "2:2" "Version append advanced quote revision"
eq "$(sql "SELECT consumed_at IS NOT NULL FROM oj_private.oj_exterior_verified_acceptances
 WHERE organization_id='$org' AND id='90000000-0000-4000-8000-000000000001';")" t "Initial receipt consumed exactly once"
fail "Cross-tenant property/customer composite foreign key" \
 "INSERT INTO public.oj_exterior_properties(organization_id,id,customer_id,address_text,created_by)
 VALUES('$other','40000000-0000-4000-8000-000000000099',
 '30000000-0000-4000-8000-000000000001','Fake site','$owner');"
fail "One legacy lead cannot be linked to multiple sources" \
 "INSERT INTO public.oj_exterior_legacy_links(
 organization_id,legacy_lead_id,customer_id,property_id,linked_by)
 VALUES('$org','legacy-lead:001','30000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001','$owner');"
fail "Cannot change source identity after mapping" \
 "UPDATE public.oj_exterior_legacy_links SET legacy_lead_id='replacement'
 WHERE organization_id='$org' AND legacy_lead_id='legacy-lead:001';"
fail "Immutable quote version" \
 "UPDATE public.oj_exterior_quote_versions SET content_hash=repeat('f',64)
 WHERE organization_id='$org' AND id='70000000-0000-4000-8000-000000000001';"
fail "Immutable acceptance claim" \
 "UPDATE public.oj_exterior_quote_claims SET verification_state='verified'
 WHERE organization_id='$org' AND id='80000000-0000-4000-8000-000000000001';"
fail "Private cost/unit leakage in public quote scope is prohibited" \
 "INSERT INTO public.oj_exterior_quote_versions(
 organization_id,quote_id,sequence,command_id,expected_revision,created_by,
 scope,subtotal_cents,discount_cents,price_cents,content_hash)
 VALUES('$org','60000000-0000-4000-8000-000000000002',3,
 'b0000000-0000-4000-8000-000000000090',2,'$owner',
 '[{\"id\":\"line-x\",\"service\":\"Window\",\"unit\":\"pane\",\"quantity\":1,
 \"unitPriceCents\":30000,\"costPerUnit\":100}]'::jsonb,
 30000,0,30000,repeat('e',64));"
fail "Public scope quantity times unit-price must equal subtotal" \
 "INSERT INTO public.oj_exterior_quote_versions(
 organization_id,quote_id,sequence,command_id,expected_revision,created_by,
 scope,subtotal_cents,discount_cents,price_cents,content_hash)
 VALUES('$org','60000000-0000-4000-8000-000000000002',3,
 'b0000000-0000-4000-8000-000000000091',2,'$owner',
 '[{\"id\":\"line-x\",\"service\":\"Window\",\"unit\":\"pane\",\"quantity\":1,
 \"unitPriceCents\":100}]'::jsonb,
 30000,0,30000,repeat('e',64));"
fail "Private verified provider receipt identity is immutable" \
 "UPDATE oj_private.oj_exterior_verified_acceptances SET price_cents=1
 WHERE organization_id='$org' AND id='90000000-0000-4000-8000-000000000003';"
fail "Stale optimistic quote revision" \
 "INSERT INTO public.oj_exterior_quote_versions(
 organization_id,quote_id,sequence,command_id,expected_revision,created_by,
 scope,subtotal_cents,discount_cents,price_cents,content_hash)
 VALUES('$org','60000000-0000-4000-8000-000000000002',3,
 'b0000000-0000-4000-8000-000000000099',0,'$owner',
 '[{\"id\":\"line\",\"service\":\"Window\",\"quantity\":1,\"unitPriceCents\":30000}]'::jsonb,
 30000,0,30000,repeat('d',64));"
fail "Provider-event replay is unique" \
 "INSERT INTO oj_private.oj_exterior_verified_acceptances(
 organization_id,quote_id,version_id,booking_id,content_hash,price_cents,
 issuer,provider_event_id,verified_at)
 VALUES('$org','60000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000003',
 'legacy-booking:002',repeat('c',64),30000,
 'synthetic-provider','event_000000003',now());"
scope_old='[{"id":"line-2","service":"Window washing old scope","unit":"pane","quantity":20,"unitPriceCents":1250}]'
scope_new='[{"id":"line-3","service":"Window washing revised","unit":"pane","quantity":20,"unitPriceCents":1500}]'
fail "Superseded quote version cannot create work order" \
 "INSERT INTO public.oj_exterior_work_orders(
 organization_id,id,opportunity_id,quote_id,version_id,booking_id,
 verified_receipt_id,price_cents,scope_snapshot)
 VALUES('$org','a0000000-0000-4000-8000-000000000002',
 '50000000-0000-4000-8000-000000000002',
 '60000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000002','legacy-booking:002',
 '90000000-0000-4000-8000-000000000002',25000,'$scope_old'::jsonb);"
fail "Incorrect price cannot create work order" \
 "INSERT INTO public.oj_exterior_work_orders(
 organization_id,id,opportunity_id,quote_id,version_id,booking_id,
 verified_receipt_id,price_cents,scope_snapshot)
 VALUES('$org','a0000000-0000-4000-8000-000000000002',
 '50000000-0000-4000-8000-000000000002',
 '60000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000003','legacy-booking:002',
 '90000000-0000-4000-8000-000000000003',1,'$scope_new'::jsonb);"
eq "$(sql "SELECT consumed_at IS NULL FROM oj_private.oj_exterior_verified_acceptances
 WHERE organization_id='$org' AND id='90000000-0000-4000-8000-000000000003';")" t "Failed insert rolled back receipt consumption"
sql "INSERT INTO public.oj_exterior_work_orders(
 organization_id,id,opportunity_id,quote_id,version_id,booking_id,
 verified_receipt_id,price_cents,scope_snapshot)
 VALUES('$org','a0000000-0000-4000-8000-000000000002',
 '50000000-0000-4000-8000-000000000002',
 '60000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000003','legacy-booking:002',
 '90000000-0000-4000-8000-000000000003',30000,'$scope_new'::jsonb);" >/dev/null
eq "$(sql "SELECT consumed_at IS NOT NULL FROM oj_private.oj_exterior_verified_acceptances
 WHERE organization_id='$org' AND id='90000000-0000-4000-8000-000000000003';")" t "Valid work order consumes single-use receipt"
fail "Consumed provider receipt cannot be rewritten or reconsumed" \
 "UPDATE oj_private.oj_exterior_verified_acceptances SET consumed_at=now()
 WHERE organization_id='$org' AND id='90000000-0000-4000-8000-000000000003';"

fail "Consumed receipt cannot be replayed" \
 "INSERT INTO public.oj_exterior_work_orders(
 organization_id,id,opportunity_id,quote_id,version_id,booking_id,
 verified_receipt_id,price_cents,scope_snapshot)
 VALUES('$org','a0000000-0000-4000-8000-000000000003',
 '50000000-0000-4000-8000-000000000002',
 '60000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000003','legacy-booking:002',
 '90000000-0000-4000-8000-000000000003',30000,'$scope_new'::jsonb);"
eq "$(sql "SELECT count(*) FROM public.oj_exterior_work_orders WHERE organization_id='$org';")" 2 "Exactly one work order per original booking"
echo "SUCCESS: synthetic PG17 P3 schema, RLS actors, revocation, immutable versions, CAS and verified receipts."
echo "NO production migrations, real customer records or provider acceptance occurred."
