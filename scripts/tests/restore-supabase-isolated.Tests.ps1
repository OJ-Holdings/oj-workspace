# Safe, offline refusal tests: intentionally NEVER connect to a database,
# use real archives or use any Supabase credential.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script = Join-Path (Split-Path $PSScriptRoot -Parent) 'restore-supabase-isolated.ps1'
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Restore-drill script missing' }
$checks = 0
function ExpectRefused([string]$label,[hashtable]$arguments,[string]$expected) {
  $script:checks++
  $blocked = $false
  try {
    & $script @arguments *> $null
  } catch {
    $blocked = $_.Exception.Message -match $expected
    if (-not $blocked) {
      throw ('Unexpected rejection for ' + $label + ': ' + $_.Exception.Message)
    }
  }
  if (-not $blocked) { throw ('UNSAFE ACCEPTANCE: ' + $label) }
  Write-Output ('PASS (rejected): ' + $label)
}
$base = @{
 Action = 'Restore'
 ArchivePath = (Join-Path ([IO.Path]::GetTempPath()) 'this-archive-does-not-exist.dump')
 TargetHost = '127.0.0.1'
 TargetPort = 15432
 TargetDatabase = 'oj_drill_a1b2c3d4'
 TargetUser = 'postgres'
 TargetConfirmation = 'RESTORE ONLY INTO oj_drill_a1b2c3d4'
}
$remote = $base.Clone()
$remote.TargetHost = 'db.vgckpcktsfuithqggknd.supabase.co'
ExpectRefused 'production remote hostname' $remote 'loopback'
$pooler = $base.Clone()
$pooler.TargetHost = 'aws-0-us-west-2.pooler.supabase.com'
ExpectRefused 'pooler remote hostname' $pooler 'loopback'
$ordinary = $base.Clone()
$ordinary.TargetDatabase = 'postgres'
$ordinary.TargetConfirmation = 'RESTORE ONLY INTO postgres'
ExpectRefused 'ordinary production database' $ordinary 'oj_drill_'
$nonstandard = $base.Clone()
$nonstandard.TargetPort = 5432
ExpectRefused 'default PostgreSQL port' $nonstandard 'non-default'
$unconfirmed = $base.Clone()
$unconfirmed.TargetConfirmation = ''
ExpectRefused 'missing operator confirmation phrase' $unconfirmed 'TargetConfirmation'
$wrong = $base.Clone()
$wrong.TargetConfirmation = 'RESTORE ONLY INTO oj_drill_deadbeef'
ExpectRefused 'wrong target confirmation phrase' $wrong 'TargetConfirmation'
$badUser = $base.Clone()
$badUser.TargetUser = 'postgres;DROP'
ExpectRefused 'SQL-looking database user' $badUser 'invalid local database user'
$missing = $base.Clone()
ExpectRefused 'absent archive, valid scratch target' $missing 'Archive was not found'
$missingInspect = @{Action='Inspect';ArchivePath=$base.ArchivePath}
ExpectRefused 'absent archive inspection' $missingInspect 'Archive was not found'
$badVerify = $base.Clone()
$badVerify.Action = 'VerifyTarget'
$badVerify.TargetHost = 'www.example.com'
ExpectRefused 'remote verification target' $badVerify 'loopback'
$source=Get-Content -LiteralPath $script -Raw
if ($source -match '(?i)--clean(?:\s|''|"|,)' -or $source -match '(?i)\bDROP\s+(DATABASE|SCHEMA)\b' -or
    $source -match '(?i)\bservice_role\b' -or
    $source -match '(?i)\bpowershell\s+-enc\b') {
 throw 'A dangerous source operation was introduced into the isolated restore helper.'
}
Write-Output ('SAFE REFUSAL TESTS PASSED: ' + $checks + ' independent cases; no DB or archive was accessed.')
