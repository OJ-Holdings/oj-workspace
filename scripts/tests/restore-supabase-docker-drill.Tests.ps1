[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script = Join-Path (Split-Path $PSScriptRoot -Parent) 'restore-supabase-docker-drill.ps1'
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $script).Path,[ref]$tokens,[ref]$errors) | Out-Null
if ($errors.Count) { throw 'Docker restore-drill helper has PowerShell syntax errors.' }
$source = Get-Content -LiteralPath $script -Raw
$functionAst = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $script).Path,[ref]$tokens,[ref]$errors)
$catalogDiffFunction = $functionAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-CatalogSetDifference' },$true)
if (-not $catalogDiffFunction) { throw 'Catalog comparison helper is missing.' }
. ([scriptblock]::Create($catalogDiffFunction.Extent.Text))
$identicalRows = @(Get-CatalogSetDifference -Left @('schema_item') -Right @('schema_item'))
$differentRows = @(Get-CatalogSetDifference -Left @('source_item') -Right @('target_item'))
if ($identicalRows.Count -ne 0 -or $differentRows.Count -ne 1 -or $differentRows[0] -cne 'source_item') {
  throw 'Catalog comparison helper must return flat, exact set differences.'
}
$definitionKey = 'public.conversations.conversations_direction_check' -replace '^public\.', ''
if ($definitionKey -cne 'conversations.conversations_direction_check') {
  throw 'Catalog constraint diagnostics must resolve schema-qualified diff labels to the definition map.'
}
$admin = $source.IndexOf('IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)')
$docker = $source.IndexOf('$dockerInfo = @(& $docker info')
$egress = $source.IndexOf("'ip','route','del','default'")
$restore = $source.IndexOf('-Action Restore')
$loopback = $source.Contains("'--publish','127.0.0.1:15432:5432'")
$cleanup = $source.Contains("'rm','--force'") -and
  $source.Contains("'volume','rm'")
if ($admin -lt 0 -or $docker -lt 0 -or $admin -gt $docker) {
  throw 'The helper must require an elevated owner session before contacting Docker.'
}
if (-not $loopback -or $egress -lt 0 -or $restore -lt 0 -or $egress -gt $restore) {
  throw 'The helper must bind only to loopback and disable outbound routing before restoring.'
}
if (-not $cleanup) { throw 'The helper must remove its disposable database container and plaintext volume.' }
if ($source -notmatch 'supabase/postgres:17\.6\.1\.136@sha256:[0-9a-f]{64}') {
  throw 'The helper must use a version-17 Supabase database image pinned by digest.'
}
if (-not $source.Contains('[switch]$UseR40') -or
    -not $source.Contains('[switch]$RefreshBackup') -or
    -not $source.Contains('-Action Backup -EmitSanitizedJson') -or
    -not $source.Contains('-Action Status -EmitSanitizedJson') -or
    -not $source.Contains('-Action VerifyTarget -TargetDatabase $database') -or
    -not $source.Contains('OJ_RECOVERY_CODE=') -or
    -not $source.Contains('OJ_SOURCE_TABLES_MISSING_FROM_ARCHIVE=') -or
    -not $source.Contains('OJ_RLS_POLICY_CONSTRAINT_SIGNATURE_PARITY=') -or
    -not $source.Contains('OJ_ALL_PUBLIC_ROW_COUNT_PARITY=') -or
    -not $source.Contains('OJ_AUTHORIZED_MEMBER_RLS=') -or
    -not $source.Contains('OJ_OUTSIDER_RLS_DENIED=') -or
    -not $source.Contains('OJ_ANON_RLS_DENIED=') -or
    -not $source.Contains('OJ_AUTHENTICATED_SOURCE_GRANTS_REPLICATED_IN_SCRATCH=') -or
    -not $source.Contains('OJ_PUBLIC_ROW_COUNT_DELTAS=') -or
    -not $source.Contains('OJ_CONSTRAINT_SOURCE_DEFINITION=')) {
  throw 'The optional R40 path must preflight and verify through guarded actions and report only a sanitized recovery code.'
}
if (-not $source.Contains('OJ_ARCHIVE_AFTER_LATEST_SCHEMA_MIGRATION=') -or
    -not $source.Contains('OJ_ARCHIVE_PUBLIC_TABLE_COUNT=') -or
    -not $source.Contains('OJ_ARCHIVE_TOC_CREATED=') -or
    -not $source.Contains('SET search_path = pg_catalog;')) {
  throw 'The R40 path must compare archive timestamp and exact archive TOC table names with read-only source catalogs.'
}
if (-not $source.Contains('TargetConfirmation (''RESTORE ONLY INTO '' + $database)')) {
  throw 'The R40 path must preserve the exact target database confirmation.'
}
Write-Output 'PASS: elevated-only, pinned Supabase PG17, localhost-only, no-egress-before-restore and disposable cleanup guards.'
