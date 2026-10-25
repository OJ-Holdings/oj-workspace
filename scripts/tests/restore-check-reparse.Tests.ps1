[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$runner = Join-Path (Split-Path $PSScriptRoot -Parent) 'restore-supabase-docker-drill.ps1'
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($runner,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count) { throw 'Recovery runner has syntax errors.' }
$helper = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'New-CheckConstraintReparseSql' },$true)
if (-not $helper) { throw 'Check reparse helper is missing.' }
. ([scriptblock]::Create($helper.Extent.Text))
$docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
$image = 'supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00'
$container = 'oj-synthetic-check-' + [guid]::NewGuid().ToString('N')
$priorPassword = $env:POSTGRES_PASSWORD
$created = $false
function Invoke-FixturePsql([string]$Sql) {
  $prior = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $result = @($Sql | & $docker exec -i $container psql -X -q -A -t -U supabase_admin -d postgres -v ON_ERROR_STOP=1 2>&1)
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $prior }
  if ($code -ne 0) { throw ('Synthetic PostgreSQL check test failed: ' + (($result | ForEach-Object { [string]$_ }) -join ' ')) }
  return (($result | ForEach-Object { [string]$_ }) -join "`n").Trim()
}
try {
  $env:POSTGRES_PASSWORD = [guid]::NewGuid().ToString('N')
  $null = & $docker run --detach --network none --name $container --env POSTGRES_PASSWORD $image
  if ($LASTEXITCODE -ne 0) { throw 'Could not start network-isolated synthetic database.' }
  $created = $true
  $ready = $false
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    $health = & $docker inspect --format '{{.State.Health.Status}}' $container
    if ($LASTEXITCODE -eq 0 -and $health -eq 'healthy') { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Synthetic database was not ready within its deadline.' }
  $null = Invoke-FixturePsql 'CREATE TABLE public.oj_fixture_direction (direction varchar(20)); CREATE TABLE public.oj_fixture_slot (preferred_date date, preferred_time time);'
  $catalogAssignment = $ast.Find({ param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -ceq '$catalogSql' },$true)
  if (-not $catalogAssignment) { throw 'Recovery catalog query is missing.' }
  $catalog = (Invoke-FixturePsql $catalogAssignment.Right.Expression.Value) | ConvertFrom-Json
  if (-not $catalog.column_signatures.PSObject.Properties['oj_fixture_direction']) { throw 'Recovery catalog query did not return typed column signatures.' }
  $directionSource = @'
CHECK (((direction)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying])::text[])))
'@
  $directionTarget = @'
CHECK (((direction)::text = ANY (ARRAY[('inbound'::character varying)::text, ('outbound'::character varying)::text])))
'@
  $slotSource = @'
CHECK ((((EXTRACT(isodow FROM preferred_date) >= (1)::numeric) AND (EXTRACT(isodow FROM preferred_date) <= (5)::numeric)) AND (preferred_time >= '09:00:00'::time without time zone) AND (preferred_time <= '16:45:00'::time without time zone) AND (((EXTRACT(minute FROM preferred_time))::integer % 15) = 0) AND ((EXTRACT(second FROM preferred_time))::integer = 0)))
'@
  $slotTarget = @'
CHECK (((EXTRACT(isodow FROM preferred_date) >= (1)::numeric) AND (EXTRACT(isodow FROM preferred_date) <= (5)::numeric) AND (preferred_time >= '09:00:00'::time without time zone) AND (preferred_time <= '16:45:00'::time without time zone) AND (((EXTRACT(minute FROM preferred_time))::integer % 15) = 0) AND ((EXTRACT(second FROM preferred_time))::integer = 0)))
'@
  $directionCanonical = Invoke-FixturePsql (New-CheckConstraintReparseSql 'oj_fixture_direction' $directionSource)
  $directionRestored = Invoke-FixturePsql (New-CheckConstraintReparseSql 'oj_fixture_direction' $directionTarget)
  $directionChanged = Invoke-FixturePsql (New-CheckConstraintReparseSql 'oj_fixture_direction' ($directionSource.Replace("'outbound'","'internal'")))
  if ($directionCanonical -cne $directionRestored -or $directionCanonical -ceq $directionChanged) { throw 'Direction normalization accepted a changed allowed value or rejected an equivalent cast.' }
  Write-Output 'PASS: array cast rewrite matches; changed allowed value rejected.'
  $slotCanonical = Invoke-FixturePsql (New-CheckConstraintReparseSql 'oj_fixture_slot' $slotSource)
  $slotRestored = Invoke-FixturePsql (New-CheckConstraintReparseSql 'oj_fixture_slot' $slotTarget)
  $slotChanged = Invoke-FixturePsql (New-CheckConstraintReparseSql 'oj_fixture_slot' ($slotSource.Replace("'16:45:00'","'17:00:00'")))
  if ($slotCanonical -cne $slotRestored -or $slotCanonical -ceq $slotChanged) { throw 'Time-slot normalization accepted a changed limit or rejected equivalent AND nesting.' }
  Write-Output 'PASS: AND flattening matches; changed time limit rejected.'
  $refused = $false
  try { $null = New-CheckConstraintReparseSql 'oj_fixture_slot' 'CHECK (true); SELECT 1' } catch { $refused = $true }
  if (-not $refused) { throw 'Multiple SQL statements must be refused.' }
  $tempCount = Invoke-FixturePsql "SELECT count(*) FROM pg_class WHERE relname LIKE 'oj_check_parse_%';"
  if ($tempCount -cne '0') { throw 'Reparse left temporary relations behind.' }
  Write-Output 'PASS: statement injection refused; temporary checks rolled back; no production or archive accessed.'
} finally {
  $env:POSTGRES_PASSWORD = $priorPassword
  if ($created) { $null = & $docker rm --force --volumes $container }
}
