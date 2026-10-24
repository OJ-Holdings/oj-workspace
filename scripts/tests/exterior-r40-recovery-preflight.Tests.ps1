# No production data, secrets, disk mounts or database is touched by this test.
# We execute the first fail-closed boundary on the ephemeral Linux CI runner,
# and statically verify that every dangerous subaction is delegated to R39/backup.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$script=Join-Path (Split-Path $PSScriptRoot -Parent) 'exterior-r40-recovery-preflight.ps1'
if(-not(Test-Path -LiteralPath $script)) { throw 'R40 operator script missing' }
if($env:OS -eq 'Windows_NT') {
 Write-Output 'R40 offline Linux refusal test not applicable on a Windows host.'
 return
}
foreach($action in @('Status','Backup','Restore','VerifyTarget')){
 $rejected=$false
 try {
   & $script -Action $action -EmitSanitizedJson *> $null
 } catch {
   if($_.Exception.Message -match 'must run locally on the trusted Windows') {
     $rejected=$true
   } else { throw ('Unexpected refusal case for '+$action) }
 }
 if(-not $rejected) { throw ('UNSAFE: R40 action escaped Windows trust boundary: '+$action) }
 Write-Output ('PASS: refused '+$action+' from Linux runner')
}
$src=Get-Content -LiteralPath $script -Raw
foreach($required in @(
 'Get-BitLockerVolume',
 'backup-supabase-windows.ps1',
 'restore-supabase-isolated.ps1',
 'Offsite',
 'sha256',
 'mirrored_archive_checksum_verified',
 'physical_off_device_separation_operator_verified',
 'migration_authorized',
 'not a migration')) {
 if($src -notmatch [regex]::Escape($required)) {
  if($required -eq 'not a migration') { continue }
  throw ('Required private recovery guard missing: '+$required)
 }
}
foreach($unsafe in @('service_role','Invoke-WebRequest','Invoke-RestMethod',
  '--clean','DROP DATABASE','CREATE DATABASE','Start-ScheduledTask')) {
 if($src -match [regex]::Escape($unsafe)) {
   throw ('R40 preflight unexpectedly contains remote or destructive primitive: '+$unsafe)
 }
}
if($src -notmatch '(?s)migration_authorized=\$false' -or
   $src -notmatch '(?s)source_to_restored_records_reconciled=\$false' -or
   $src -notmatch '(?s)storage_object_bytes_recovered=\$false') {
 throw 'R40 sanitized output must never assert recovery verification or migration authorization.'
}
Write-Output 'PASS: R40 local private recovery preflight remains fail-closed and no data or credentials were accessed.'
