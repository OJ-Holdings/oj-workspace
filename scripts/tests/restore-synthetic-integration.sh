#!/usr/bin/env bash
# R39: ACTUAL synthetic pg_dump -> pg_restore to separate disposable PostgreSQL
# 17 containers. No credentials, backups or customer records from production.
set -Eeuo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "$RUNNER_TEMP/oj-r39-restore.XXXXXXXX")"
export OJ_R39_TMP="$tmp"
export PGPASSWORD="synthetic-only-restore-password-never-production"
prefix="oj-r39-$RANDOM-$$"
source_container="$prefix-source"
target_container="$prefix-target"
cleanup() {
  docker rm -f "$source_container" "$target_container" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
mkdir -p "$tmp/bin" "$tmp/private" "$tmp/tamper"
echo "[synthetic] Launching two ephemeral PostgreSQL 17 servers; target binds only 127.0.0.1:15432"
docker run --rm -d --name "$source_container" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" postgres:17 >/dev/null
docker run --rm -d --name "$target_container" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" -p 127.0.0.1:15432:5432 postgres:17 >/dev/null
for c in "$source_container" "$target_container"; do
  ready=0
  for attempt in $(seq 1 45); do
    if docker exec "$c" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != 1 ]]; then echo "Synthetic $c not ready" >&2; exit 1; fi
done
echo "[synthetic] Preparing public/auth OJ fixture; no production data"
docker exec -i "$source_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$repo/scripts/tests/restore-synthetic-fixture.sql" >/dev/null
docker exec "$source_container" pg_dump -Fc -U postgres -d postgres \
  --no-owner --file=/tmp/oj-r39-synthetic.dump
archive="$tmp/supabase-vgckpcktsfuithqggknd-20261024T063000Z.dump"
docker cp "$source_container":/tmp/oj-r39-synthetic.dump "$archive" >/dev/null
python3 - "$archive" <<'PY'
import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1])
data=p.read_bytes()
manifest={
 "project_ref":"vgckpcktsfuithqggknd",
 "format":"pg_dump-custom","client_major":17,
 "size_bytes":len(data),"sha256":hashlib.sha256(data).hexdigest().upper(),
 "archive_list_checked":True,"restored_in_isolation":False,
 "note":"SYNTHETIC CI FIXTURE, NOT ACTUAL OJ BACKUP",
}
p.with_name(p.name+".manifest.json").write_text(json.dumps(manifest),encoding="utf8")
PY
# PostgreSQL 17 clients are run from pinned major Docker image, not host.
# GitHub's ephemeral Linux runner permits host network + loopback target.
cat > "$tmp/bin/pg_restore" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
exec docker run --rm --network host \
  -e PGPASSWORD -v "$OJ_R39_TMP:$OJ_R39_TMP:ro" \
  postgres:17 pg_restore "$@"
SH
cat > "$tmp/bin/psql" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
exec docker run --rm --network host -e PGPASSWORD postgres:17 psql "$@"
SH
chmod +x "$tmp/bin/pg_restore" "$tmp/bin/psql"
export PATH="$tmp/bin:$PATH"
script="$repo/scripts/restore-supabase-isolated.ps1"
echo "[synthetic] Testing local archive inspection"
pwsh -NoProfile -NonInteractive -File "$script" -Action Inspect -ArchivePath "$archive"
docker exec "$target_container" psql -v ON_ERROR_STOP=1 \
  -U postgres -d postgres -c "CREATE DATABASE oj_drill_a1b2c3d4;" >/dev/null
echo "[synthetic] Restoring to a DIFFERENT empty disposable database"
pwsh -NoProfile -NonInteractive -File "$script" -Action Restore \
  -ArchivePath "$archive" -EvidenceDirectory "$tmp/private" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4'
receipt="$tmp/private/$(basename "$archive" .dump)-oj_drill_a1b2c3d4.receipt.json"
test -f "$receipt"
python3 - "$receipt" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding="utf-8-sig"))
assert r["mechanical_restore_passed"] is True
assert r["target_counts"]["public_leads"]==1
assert r["target_counts"]["public_bookings"]==1
assert r["target_counts"]["source_policies"]>=5
for name in ("source_vs_restore_reconciled","authenticated_rls_actor_tests_passed",
  "storage_objects_restored","email_sms_and_webhooks_proven_disabled",
  "complete_application_recovery_verified","production_migration_approved"):
 assert r[name] is False, name
print("PASS: synthetic restore receipt excludes business recovery approval")
PY
echo "[synthetic] Verifying receipt with fresh isolated target query"
pwsh -NoProfile -NonInteractive -File "$script" -Action VerifyTarget \
  -ArchivePath "$archive" -EvidenceDirectory "$tmp/private" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4'
echo "[synthetic] Rejecting any second restore into non-empty target"
if pwsh -NoProfile -NonInteractive -File "$script" -Action Restore \
  -ArchivePath "$archive" -EvidenceDirectory "$tmp/private" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4' >/dev/null 2>&1; then
  echo "ERROR: duplicate restore allowed" >&2; exit 1
fi
echo "[synthetic] Rejecting post-restore row drift"
docker exec "$target_container" psql -v ON_ERROR_STOP=1 -U postgres \
  -d oj_drill_a1b2c3d4 -c "INSERT INTO public.leads(id) VALUES('synthetic-drift');" >/dev/null
if pwsh -NoProfile -NonInteractive -File "$script" -Action VerifyTarget \
  -ArchivePath "$archive" -EvidenceDirectory "$tmp/private" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4' >/dev/null 2>&1; then
  echo "ERROR: target drift not detected" >&2; exit 1
fi
echo "[synthetic] Rejecting checksum tampering before any DB connection"
cp "$archive" "$tmp/tamper/$(basename "$archive")"
cp "$archive.manifest.json" "$tmp/tamper/$(basename "$archive").manifest.json"
printf 'tamper' >> "$tmp/tamper/$(basename "$archive")"
if pwsh -NoProfile -NonInteractive -File "$script" -Action Inspect \
  -ArchivePath "$tmp/tamper/$(basename "$archive")" >/dev/null 2>&1; then
  echo "ERROR: altered archive accepted" >&2; exit 1
fi
echo "SUCCESS: PostgreSQL 17 synthetic archive -> isolated restore -> receipt -> refusals."
echo "Important: synthetic only; NO production OJ backup was restored."
