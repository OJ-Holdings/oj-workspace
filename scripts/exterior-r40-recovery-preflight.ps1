# OJ Exterior R40 -- Founder-only private recovery gate.
# This runs exclusively on the trusted Windows host. It never uploads a dump,
# password, row, SHA256 or filesystem path to GitHub, chat, or remote CI.
# Status is READ-ONLY. Backup calls the existing source pg_dump helper only after
# encrypt-at-rest checks. Restore uses the pre-existing local-only R39 drill.
[CmdletBinding()]
param(
  [ValidateSet('Status','Backup','Restore','VerifyTarget')][string]$Action='Status',
  [string]$TargetDatabase='',
  [ValidateRange(1024,65535)][int]$TargetPort=15432,
  [string]$TargetConfirmation='',
  [switch]$EmitSanitizedJson
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ref='vgckpcktsfuithqggknd'
$scriptRoot=$PSScriptRoot
$backupScript=Join-Path $scriptRoot 'backup-supabase-windows.ps1'
$restoreScript=Join-Path $scriptRoot 'restore-supabase-isolated.ps1'
$requirements=@(
 'Real source backup encrypted before it is written to disk',
 'Independently verified encrypted second copy stored off-device',
 'Recovery identity stored separately from the backup devices',
 'Separate empty PostgreSQL 17 restore target',
 'Current source-to-restored data reconciliation',
 'Owner/member/viewer/revoked/outsider/anon RLS acceptance',
 'Supabase Storage object bytes verified',
 'Email/SMS/webhook producers disabled in recovery',
 'Both founders independently accepted recovered application'
)
function Block([string]$why) {
  throw ('RECOVERY GATE BLOCKED: '+$why)
}
if ($env:OS -ne 'Windows_NT') { Block 'This command must run locally on the trusted Windows computer.' }
if (-not $env:APPDATA -or -not $env:LOCALAPPDATA) { Block 'Windows application data paths are unavailable.' }
foreach($file in @($backupScript,$restoreScript)) {
 if(-not (Test-Path -LiteralPath $file -PathType Leaf)) {
  Block 'The trusted backup and restore scripts are missing from the checkout.'
 }
}
$conf=Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\settings.json'
$cred=Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\password.dpapi'
$ageIdentity=Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\age-identity.dpapi'
if(-not (Test-Path -LiteralPath $conf -PathType Leaf) -or
   -not (Test-Path -LiteralPath $cred -PathType Leaf) -or
   -not (Test-Path -LiteralPath $ageIdentity -PathType Leaf)) {
 Block 'Backup settings and Windows DPAPI credential are not configured. Run backup-supabase-windows.ps1 -Action Configure privately.'
}
try { $settings=Get-Content -LiteralPath $conf -Raw | ConvertFrom-Json }
catch { Block 'Private backup settings JSON could not be parsed.' }
if($settings.project_ref -cne $ref -or
   [string]$settings.host -notmatch '^[a-z0-9.-]+\.pooler\.supabase\.com$' -or
   [string]$settings.user -cne ('postgres.'+$ref) -or
   [int]$settings.port -ne 5432 -or
   [string]$settings.archive_encryption -cne 'age-v1' -or
   [string]$settings.age_recipient -notmatch '^age1[a-z0-9]+$') {
 Block 'Private backup configuration does not match the permitted OJ Supabase production source.'
}
function SafePrivatePath([string]$candidate) {
 if([string]::IsNullOrWhiteSpace($candidate) -or
    -not [IO.Path]::IsPathRooted($candidate)) {
    Block 'Primary and mirror backup locations must be configured as absolute paths.'
 }
 $full=[IO.Path]::GetFullPath($candidate)
 if($full -match '(?i)[\\/]oj-workspace(?:[\\/]|$)' -or
    $full -match '(?i)[\\/]oj-workspace-deploy-test(?:[\\/]|$)' -or
    $full -match '(?i)[\\/]oj-workspace-releases(?:[\\/]|$)') {
  Block 'A private archive location resolves inside an application repository or deployment.'
 }
 if(-not (Test-Path -LiteralPath $full -PathType Container)) {
  Block 'A configured private backup directory does not exist.'
 }
 $item=Get-Item -LiteralPath $full -Force
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  Block 'Symbolic links and reparse points cannot be backup roots.'
 }
 return $full
}
$primary=SafePrivatePath ([string]$settings.backup_directory)
$mirror=SafePrivatePath ([string]$settings.offsite_directory)
$primaryRoot=[IO.Path]::GetPathRoot([IO.Path]::GetFullPath($primary))
$mirrorRoot=[IO.Path]::GetPathRoot([IO.Path]::GetFullPath($mirror))
if(-not $primaryRoot -or -not $mirrorRoot) {
 Block 'Primary and mirror must resolve to separate local volumes for the independent-copy check.'
}
try {
 $primaryDisk=Get-Partition -DriveLetter $primaryRoot.Substring(0,1) -ErrorAction Stop
 $mirrorDisk=Get-Partition -DriveLetter $mirrorRoot.Substring(0,1) -ErrorAction Stop
} catch { Block 'The physical disk numbers for both encrypted archive destinations could not be verified.' }
if(-not $primaryDisk -or -not $mirrorDisk -or [int]$primaryDisk.DiskNumber -eq [int]$mirrorDisk.DiskNumber) {
 Block 'Primary and encrypted mirror must be on different physical disks.'
}
# Different physical disks attached to this PC are not proof of an off-device copy.
# A person must confirm the mirror disk is removed and stored separately.
function LatestAndMirror {
 $all=@(Get-ChildItem -LiteralPath $primary -Filter "supabase-$ref-*.dump.age" -File -ErrorAction SilentlyContinue |
   Sort-Object LastWriteTimeUtc -Descending)
 if($all.Count -eq 0) { Block 'No private source backup exists yet; use -Action Backup.' }
 $latest=$all[0]
 if($latest.Name -cnotmatch ('^supabase-'+$ref+'-\d{8}T\d{6}Z\.dump\.age$')) {
  Block 'Newest archive filename does not match the approved private project.'
 }
 $manifest=$latest.FullName+'.manifest.json'
 if(-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { Block 'Private manifest for newest archive is missing.' }
 try { $metadata=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json }
 catch { Block 'Newest private manifest cannot be parsed.' }
 $hash=(Get-FileHash -LiteralPath $latest.FullName -Algorithm SHA256).Hash
 if([string]$metadata.project_ref -cne $ref -or [string]$metadata.format -cne 'pg_dump-custom+age-v1' -or
    $metadata.encrypted -ne $true -or
    [int]$metadata.client_major -ne 17 -or [int64]$metadata.size_bytes -ne [int64]$latest.Length -or
    [string]$metadata.sha256 -cne $hash) {
  Block 'Private archive checksum, size, project or PostgreSQL client version does not match its manifest.'
 }
 $offsiteArchive=Join-Path $mirror $latest.Name
 $offsiteManifest=$offsiteArchive+'.manifest.json'
 if(-not (Test-Path -LiteralPath $offsiteArchive -PathType Leaf) -or
    -not (Test-Path -LiteralPath $offsiteManifest -PathType Leaf)) {
  Block 'The newest local archive lacks a matching second-copy archive and manifest.'
 }
 $offsiteHash=(Get-FileHash -LiteralPath $offsiteArchive -Algorithm SHA256).Hash
 $offsiteMeta=Get-Content -LiteralPath $offsiteManifest -Raw | ConvertFrom-Json
 if($offsiteHash -cne $hash -or [string]$offsiteMeta.sha256 -cne $hash -or
    [int64]$offsiteMeta.size_bytes -ne [int64]$latest.Length) {
  Block 'The latest encrypted mirror archive or its manifest failed independent checksum comparison.'
 }
 try {
   # The R39 validator ALSO checks archive TOC and PostgreSQL 17 restore version.
   & $restoreScript -Action Inspect -ArchivePath $latest.FullName *> $null
 } catch {
   Block 'PostgreSQL 17 archive inspection failed. See the private restore drill runbook.'
 }
 return @{file=$latest.FullName;hash=$hash;produced=$metadata.produced_utc}
}
$backupWasCreated=$false
$restoreWasRun=$false
if($Action -eq 'Backup') {
  try {
    # Original helper already owns DPAPI and session-pooler connection; no
    # password or database connection settings are printed by this wrapper.
    & $backupScript -Action Backup *> $null
    & $backupScript -Action Verify *> $null
  } catch { Block 'Source backup/verification failed; inspect locally without sharing archive contents or credentials.' }
  $backupWasCreated=$true
}
$latest=LatestAndMirror
if($Action -eq 'Restore' -or $Action -eq 'VerifyTarget') {
 if($TargetDatabase -cnotmatch '^oj_drill_[a-z0-9]{8,24}$' -or
    $TargetConfirmation -cne ('RESTORE ONLY INTO '+$TargetDatabase) -or
    $TargetPort -eq 5432) {
  Block 'A fresh, explicitly confirmed scratch database name/port is required. Never use production or the ordinary postgres database.'
 }
 $args=@{
  Action=$Action;ArchivePath=$latest.file;TargetHost='127.0.0.1';TargetPort=$TargetPort;
  TargetDatabase=$TargetDatabase;TargetUser='postgres';TargetConfirmation=$TargetConfirmation
 }
 try { & $restoreScript @args *> $null }
 catch {
   $diagnostic='OTHER_GUARDED_RESTORE_FAILURE'
   # The R39 helper emits only an allowlisted constant category; all private
   # PostgreSQL stderr, connection details and SQL remain hidden from this wrapper.
   $message=[string]$_.Exception.Message
   if($message -match 'OJ_RECOVERY_CODE:([A-Z_]+)') {
     $candidate=[string]$Matches[1]
     if($candidate -in @(
       'TARGET_UNREACHABLE','TARGET_AUTHENTICATION','MISSING_TARGET_ROLE',
       'MISSING_TARGET_EXTENSION','TARGET_PRIVILEGES',
       'TARGET_NOT_EMPTY_OR_DUPLICATE','MISSING_TARGET_DEPENDENCY',
       'OTHER_POSTGRES_RESTORE_FAILURE'
     )) { $diagnostic=$candidate }
   }
   Block ('Isolated restore blocked. Diagnostic code: '+$diagnostic+
     '. Review the underlying cause only on this private Windows host; create a fresh disposable database before retrying.')
 }
 if($Action -eq 'Restore') { $restoreWasRun=$true }
}
$report=[ordered]@{
 format='oj-exterior-r40-sanitized-recovery-preflight-v1'
 production_database_modified=$false
 primary_archive_encryption_verified=$true
 mirror_archive_encryption_verified=$true
 backup_archive_checksum_verified=$true
 mirrored_archive_checksum_verified=$true
 archive_readable_with_pg17=$true
 backup_created_this_run=$backupWasCreated
 scratch_restore_performed_this_run=$restoreWasRun
 physical_off_device_separation_operator_verified=$false
 source_to_restored_records_reconciled=$false
 authenticated_role_rls_tests_passed=$false
 storage_object_bytes_recovered=$false
 outbound_customer_notifications_proven_disabled=$false
 full_app_recovery_verified=$false
 migration_authorized=$false
 note='SAFE MECHANICAL CHECK ONLY. Never paste backup paths, archive bytes, credentials or customer data.'
}
if($EmitSanitizedJson) {
 $report | ConvertTo-Json -Compress
} else {
 Write-Output 'RECOVERY STATUS: age-encrypted primary and mirror archives confirmed; matching latest archive, manifest and PG17 TOC readable.'
 if($backupWasCreated) { Write-Output 'BACKUP: freshly created and mirrored by the existing private DPAPI backup utility.' }
 if($restoreWasRun) { Write-Output 'RESTORE: R39 verified a mechanical restore against an explicitly named local scratch database.' }
 Write-Output 'IMPORTANT: Different drive letters are NOT proof of physically off-device storage.'
 Write-Output 'NOT VERIFIED: source parity, real actor RLS, two Storage object bytes, SMS/email isolation or complete application recovery.'
 Write-Output 'MIGRATION AUTHORIZATION: NOT GRANTED.'
}
