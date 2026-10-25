# Applies proposed saves ONLY to a new network-isolated synthetic PostgreSQL 17
# container. No source credentials, backup archives, host ports or data mounts.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
$image = 'supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00'
$container = 'oj-synthetic-save-' + [guid]::NewGuid().ToString('N')
$database = 'oj_save_fixture'
$created = $false
$priorPassword = $env:POSTGRES_PASSWORD
function Invoke-SyntheticSql([string]$Sql,[switch]$ExpectDenied) {
  $prior = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = @($Sql | & $docker exec -i $container psql -X -q -A -t -U supabase_admin -d $database -v ON_ERROR_STOP=1 2>&1)
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $prior }
  if ($ExpectDenied) {
    if ($code -eq 0) { throw 'Synthetic unauthorized operation unexpectedly succeeded.' }
    return
  }
  if ($code -ne 0) { throw ('Synthetic SQL failed: ' + (($output | ForEach-Object { [string]$_ }) -join ' ')) }
  return (($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}
function ActorSql([string]$Actor,[string]$Sql,[string]$Role='authenticated') {
  return "BEGIN; SET LOCAL ROLE $Role; SET LOCAL request.jwt.claim.sub = '$Actor'; $Sql; COMMIT;"
}
try {
  $env:POSTGRES_PASSWORD = [guid]::NewGuid().ToString('N')
  $null = & $docker run --detach --network none --name $container --env POSTGRES_PASSWORD $image
  if ($LASTEXITCODE -ne 0) { throw 'Could not start synthetic database.' }
  $created = $true
  $ready = $false
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    $health = & $docker inspect --format '{{.State.Health.Status}}' $container
    if ($LASTEXITCODE -eq 0 -and $health -eq 'healthy') { $ready=$true;break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Synthetic database startup deadline exceeded.' }
  $null = & $docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database TEMPLATE template0;"
  if ($LASTEXITCODE -ne 0) { throw 'Could not create an empty synthetic database.' }
  $org='00000000-0000-4000-8000-000000000001'; $other='00000000-0000-4000-8000-000000000002'
  $owner='00000000-0000-4000-8000-000000000011'; $member='00000000-0000-4000-8000-000000000012'
  $viewer='00000000-0000-4000-8000-000000000013'; $outsider='00000000-0000-4000-8000-000000000014'
  $lead='00000000-0000-4000-8000-000000000021'
  $first='00000000-0000-4000-8000-000000000031'; $second='00000000-0000-4000-8000-000000000032'
  $third='00000000-0000-4000-8000-000000000033'
  $null=Invoke-SyntheticSql @'
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
'@
  $null=Invoke-SyntheticSql (Get-Content (Join-Path $repo 'supabase/schemas/workspace.sql') -Raw)
  $null=Invoke-SyntheticSql (Get-Content (Join-Path $repo 'supabase/schemas/collaboration.sql') -Raw)
  $null=Invoke-SyntheticSql @"
INSERT INTO auth.users VALUES ('$owner'),('$member'),('$viewer'),('$outsider');
INSERT INTO public.oj_organizations(id,name) VALUES ('$org','SYNTHETIC OJ'),('$other','SYNTHETIC OTHER');
INSERT INTO public.oj_memberships(organization_id,user_id,role,display_name) VALUES
('$org','$owner','owner','Owner'),('$org','$member','member','Member'),('$org','$viewer','viewer','Viewer'),('$other','$outsider','owner','Outsider');
CREATE TABLE oj_private.legacy_owner(organization_id uuid PRIMARY KEY REFERENCES public.oj_organizations(id));
INSERT INTO oj_private.legacy_owner VALUES ('$org');
CREATE TABLE public.leads(id uuid PRIMARY KEY);
CREATE TABLE public.bookings(id uuid PRIMARY KEY,lead_id uuid REFERENCES public.leads(id),date date,status varchar(50));
INSERT INTO public.leads VALUES ('$lead');
"@
  $null=Invoke-SyntheticSql (Get-Content (Join-Path $repo 'supabase/migrations/20261025000000_oj_commercial_estimating_shared_records.sql') -Raw)
  $null=Invoke-SyntheticSql (Get-Content (Join-Path $repo 'supabase/migrations/20261026000000_oj_workspace_module_documents.sql') -Raw)
  $payload='{"schema":1,"current":{"schema":1,"leadId":"'+$lead+'","lines":[{"id":"line-1","service":"Synthetic service","quantity":1,"unit":"flat","pricePerUnit":250,"costPerUnit":null,"notes":""}],"discount":0},"revisions":[]}'
  $write="SELECT public.oj_module_document_save('$org','exterior_estimate','$lead',0,'$first','$payload'::jsonb)"
  $receipt=(Invoke-SyntheticSql (ActorSql $owner $write)) | ConvertFrom-Json
  if ($receipt.revision -ne 1 -or $receipt.replayed) { throw 'First save receipt invalid.' }
  $read=(Invoke-SyntheticSql (ActorSql $member "SELECT public.oj_module_document_get('$org','exterior_estimate','$lead')")) | ConvertFrom-Json
  if ($read.revision -ne 1 -or $read.payload.current.leadId -cne $lead -or $read.payload.current.discount -ne 0) { throw 'Independent member read-back failed.' }
  $replay=(Invoke-SyntheticSql (ActorSql $owner $write)) | ConvertFrom-Json
  if (-not $replay.replayed -or $replay.revision -ne 1) { throw 'Lost-response retry was not idempotent.' }
  Write-Output 'PASS: owner save, independent member read-back and lost-response replay.'
  $changed=$payload.Replace('"discount":0','"discount":5')
  $update=(Invoke-SyntheticSql (ActorSql $member "SELECT public.oj_module_document_save('$org','exterior_estimate','$lead',1,'$second','$changed'::jsonb)")) | ConvertFrom-Json
  $stale=(Invoke-SyntheticSql (ActorSql $owner "SELECT public.oj_module_document_save('$org','exterior_estimate','$lead',1,'$third','$payload'::jsonb)")) | ConvertFrom-Json
  if ($update.revision -ne 2 -or -not $stale.conflict -or $stale.currentRevision -ne 2) { throw 'Two-founder conflict was not enforced.' }
  $count=Invoke-SyntheticSql 'SELECT count(*) FROM oj_private.oj_module_versions;'
  if ($count -cne '2') { throw 'Retry or stale write duplicated history.' }
  Invoke-SyntheticSql (ActorSql $owner "SELECT public.oj_module_document_save('$org','exterior_estimate','$lead',0,'$first','$changed'::jsonb)") -ExpectDenied
  Write-Output 'PASS: two-founder revision conflict, immutable history and altered replay refusal.'
  foreach ($actor in @($viewer,$outsider)) { Invoke-SyntheticSql (ActorSql $actor "SELECT public.oj_module_document_get('$org','exterior_estimate','$lead')") -ExpectDenied }
  Invoke-SyntheticSql (ActorSql $owner "SELECT public.oj_module_document_get('$org','exterior_estimate','$lead')" 'anon') -ExpectDenied
  Invoke-SyntheticSql (ActorSql $owner 'SELECT * FROM oj_private.oj_module_documents') -ExpectDenied
  Invoke-SyntheticSql 'UPDATE oj_private.oj_module_versions SET revision=revision;' -ExpectDenied
  $null=Invoke-SyntheticSql "DELETE FROM public.oj_memberships WHERE organization_id='$org' AND user_id='$member';"
  Invoke-SyntheticSql (ActorSql $member "SELECT public.oj_module_document_get('$org','exterior_estimate','$lead')") -ExpectDenied
  Write-Output 'PASS: viewer, outsider, anonymous, direct-table, history-edit and revoked-member denial.'
  Write-Output 'OJ_SYNTHETIC_SHARED_SAVE_PG17=PASS'
  Write-Output 'OJ_PRODUCTION_MODIFIED=FALSE'
} finally {
  $env:POSTGRES_PASSWORD=$priorPassword
  if ($created) { $null = & $docker rm --force --volumes $container }
}
