[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ExpectedCommit)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules'
Import-Module ScheduledTasks
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($repo -ne 'C:\STRATHOS\apps\oj-workspace-deploy-test') { throw 'Install only from the active OJ deployment checkout.' }
if ($ExpectedCommit -notmatch '^[a-f0-9]{40}$' -or (& git -C $repo rev-parse HEAD).Trim() -ne $ExpectedCommit) { throw 'The deployment checkout does not match the expected release.' }
foreach ($file in @('scripts/outreach-auto-sync.mjs','scripts/outreach-auto-sync.ps1','scripts/install-outreach-auto-sync.ps1')) {
  & git -C $repo diff --quiet --exit-code HEAD -- $file
  if ($LASTEXITCODE -ne 0) { throw 'A scheduled-sync script has local changes; refusing installation.' }
}
$taskName = 'OJ Workspace - Outreach Sheet Sync'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'The outreach sync task already exists; refusing to replace it.' }
if (!(Test-Path -LiteralPath (Join-Path $repo '.env.local'))) { throw 'The deployer environment is missing.' }
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'outreach-auto-sync.ps1') + '"') -WorkingDirectory $repo
$repeat = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($repeat, $logon) -Principal $principal -Settings $settings -Description 'Refresh the OJ outreach sheet through the existing authorized importer; does not send email.' | Out-Null
Write-Output 'Registered the OJ outreach sheet sync for logon and every 10 minutes.'
