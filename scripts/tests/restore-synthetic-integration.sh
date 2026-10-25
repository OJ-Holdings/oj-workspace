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
echo "[synthetic] Installing pinned age v1.3.2 tool in the temporary test directory"
age_archive="$tmp/age-v1.3.2-linux-amd64.tar.gz"
curl -fsSL "https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz" -o "$age_archive"
echo "cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10  $age_archive" | sha256sum --check --status
mkdir -p "$tmp/age"
tar -xzf "$age_archive" -C "$tmp/age"
export PATH="$tmp/age/age:$PATH"
age --version
age-keygen -o "$tmp/private/age-identity.txt" 2>"$tmp/private/age-keygen.log"
recipient="$(age-keygen -y "$tmp/private/age-identity.txt")"
echo "[synthetic] Launching two ephemeral PostgreSQL 17 servers; target binds only 127.0.0.1:15432"
docker run --rm -d --name "$source_container" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" postgres:17 >/dev/null
docker run --rm -d --name "$target_container" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" -p 127.0.0.1:15432:5432 postgres:17 >/dev/null
# Docker's first-launch initdb brings up a TEMPORARY socket-only server,
# runs bootstrapping SQL, shuts it down and only THEN starts final PostgreSQL.
# An unqualified socket pg_isready can report success for that temporary
# server, followed by an intermittent psql socket failure on clean CI runners.
# TCP loopback is available only on the final database server. Verify a
# successful query too, not just a briefly responsive socket.
for c in "$source_container" "$target_container"; do
  ready=0
  for attempt in $(seq 1 60); do
    if docker exec "$c" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1 &&
       [[ "$(docker exec "$c" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc 'SELECT 1' 2>/dev/null)" == "1" ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != 1 ]]; then
    echo "Synthetic PostgreSQL did not become queryable on TCP after 60 seconds." >&2
    docker logs "$c" 2>&1 | tail -n 25 >&2 || true
    exit 1
  fi
done
echo "[synthetic] Preparing public/auth OJ fixture; no production data"
docker exec -i "$source_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$repo/scripts/tests/restore-synthetic-fixture.sql" >/dev/null
archive="$tmp/supabase-vgckpcktsfuithqggknd-20261024T063000Z.dump.age"
docker exec "$source_container" pg_dump -Fc -U postgres -d postgres --no-owner \
  | age -r "$recipient" -o "$archive"
python3 - "$archive" <<'PY'
import datetime,hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1])
data=p.read_bytes()
manifest={
 "project_ref":"vgckpcktsfuithqggknd",
 "format":"pg_dump-custom+age-v1","encrypted":True,"client_major":17,
 "produced_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
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
exec docker run --rm -i --network host \
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
pwsh -NoProfile -NonInteractive -File "$script" -Action Inspect \
  -ArchivePath "$archive" -AgeIdentity "$tmp/private/age-identity.txt"
docker exec "$target_container" psql -v ON_ERROR_STOP=1 \
  -U postgres -d postgres -c "CREATE DATABASE oj_drill_a1b2c3d4;" >/dev/null
echo "[synthetic] Restoring to a DIFFERENT empty disposable database"
pwsh -NoProfile -NonInteractive -File "$script" -Action Restore \
  -ArchivePath "$archive" -EvidenceDirectory "$tmp/private" \
  -AgeIdentity "$tmp/private/age-identity.txt" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4'
receipt="$tmp/private/$(basename "$archive" .age)-oj_drill_a1b2c3d4.receipt.json"
test -f "$receipt"
python3 - "$receipt" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding="utf-8-sig"))
assert r["mechanical_restore_passed"] is True
assert r["archive_name"].endswith(".dump.age")
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
  -AgeIdentity "$tmp/private/age-identity.txt" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4'
echo "[synthetic] Rejecting any second restore into non-empty target"
if pwsh -NoProfile -NonInteractive -File "$script" -Action Restore \
  -ArchivePath "$archive" -EvidenceDirectory "$tmp/private" \
  -AgeIdentity "$tmp/private/age-identity.txt" \
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
  -AgeIdentity "$tmp/private/age-identity.txt" \
  -TargetHost 127.0.0.1 -TargetPort 15432 \
  -TargetDatabase oj_drill_a1b2c3d4 -TargetUser postgres \
  -TargetConfirmation 'RESTORE ONLY INTO oj_drill_a1b2c3d4' >/dev/null 2>&1; then
  echo "ERROR: target drift not detected" >&2; exit 1
fi
echo "[synthetic] Rejecting checksum tampering before any DB connection"
cp "$archive" "$tmp/tamper/$(basename "$archive")"
cp "$archive.manifest.json" "$tmp/tamper/$(basename "$archive").manifest.json"
printf 'tamper' >> "$tmp/tamper/$(basename "$archive")"
python3 - "$tmp/tamper/$(basename "$archive")" "$tmp/tamper/$(basename "$archive").manifest.json" <<'PY'
import hashlib,json,pathlib,sys
archive=pathlib.Path(sys.argv[1]); manifest_path=pathlib.Path(sys.argv[2])
manifest=json.loads(manifest_path.read_text(encoding="utf8"))
data=archive.read_bytes(); manifest["size_bytes"]=len(data); manifest["sha256"]=hashlib.sha256(data).hexdigest().upper()
manifest_path.write_text(json.dumps(manifest),encoding="utf8")
PY
if pwsh -NoProfile -NonInteractive -File "$script" -Action Inspect \
  -ArchivePath "$tmp/tamper/$(basename "$archive")" \
  -AgeIdentity "$tmp/private/age-identity.txt" >/dev/null 2>&1; then
  echo "ERROR: altered archive accepted" >&2; exit 1
fi
echo "SUCCESS: PostgreSQL 17 synthetic archive -> isolated restore -> receipt -> refusals."
echo "Important: synthetic only; NO production OJ backup was restored."
