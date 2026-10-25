# Optional daily Supabase logical backup task for the Windows OJ host.
# The password is stored using Windows DPAPI by backup-supabase-windows.ps1.
# Requires this Windows user to remain signed in (interactive task).
[CmdletBinding()]
param(
  [string]$At = '03:00',
  [string]$TaskName = 'OJ Workspace - Supabase Backup'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($At -notmatch '^(?:[01]\d|2[0-3]):[0-5]\d$') { throw 'At must be HH:mm in local Windows time (e.g. 03:00)' }
$script = Join-Path $PSScriptRoot 'backup-supabase-windows.ps1'
if (-not (Test-Path -LiteralPath $script)) { throw "Cannot find $script" }
$secret = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\password.dpapi'
$identity = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\age-identity.dpapi'
if (-not (Test-Path -LiteralPath $secret) -or -not (Test-Path -LiteralPath $identity)) {
  throw 'Run backup-supabase-windows.ps1 -Action Configure and -Action Backup successfully first'
}
$principalName = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$check = Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue
if (-not $check) { throw 'Windows ScheduledTasks module is unavailable' }
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  throw "A task with this name already exists; refusing to overwrite it: $TaskName"
}
$engine = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $engine)) { throw 'Windows PowerShell was not found' }
$args = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $script + '" -Action Backup'
$action = New-ScheduledTaskAction -Execute $engine -Argument $args
$parts = $At.Split(':')
$clock = (Get-Date).Date.AddHours([int]$parts[0]).AddMinutes([int]$parts[1])
$trigger = New-ScheduledTaskTrigger -Daily -At $clock
$principal = New-ScheduledTaskPrincipal -UserId $principalName -LogonType Interactive -RunLevel LeastPrivilege
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'OJ Holdings age-encrypted Supabase pg_dump snapshot using DPAPI credentials; logged-in user only' | Out-Null
Write-Output "Task installed: $TaskName"
Write-Output "Scheduled: daily $At (Windows local time), only while user $principalName is logged in."
Write-Output 'IMPORTANT: The PC must be awake; this is not a cloud backup service.'
Write-Output 'Inspect: Get-ScheduledTaskInfo -TaskName "OJ Workspace - Supabase Backup"'
Write-Output 'Run now: Start-ScheduledTask -TaskName "OJ Workspace - Supabase Backup"'
Write-Output 'The configured mirror is a second-disk copy while attached. Disconnect and store it separately for off-device protection; verify a restore independently.'
