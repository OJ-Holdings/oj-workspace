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
    -not $source.Contains('-Action Status -EmitSanitizedJson') -or
    -not $source.Contains('-Action VerifyTarget -TargetDatabase $database') -or
    -not $source.Contains('OJ_RECOVERY_CODE=')) {
  throw 'The optional R40 path must preflight and verify through guarded actions and report only a sanitized recovery code.'
}
if (-not $source.Contains('TargetConfirmation (''RESTORE ONLY INTO '' + $database)')) {
  throw 'The R40 path must preserve the exact target database confirmation.'
}
Write-Output 'PASS: elevated-only, pinned Supabase PG17, localhost-only, no-egress-before-restore and disposable cleanup guards.'
