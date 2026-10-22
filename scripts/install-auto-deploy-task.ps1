# One-time opt-in installer. Creates a per-user Windows Task Scheduler polling job.
[CmdletBinding()]
param([switch]$Install,[switch]$Disable)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$name = 'OJ Workspace - GitHub Auto Deploy'
$watcher = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'auto-deploy-local.ps1'))
if($Disable){
  $task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if($task){Disable-ScheduledTask -TaskName $name | Out-Null;Write-Output "Disabled $name"}
  else{Write-Output 'No automatic OJ deployment task is installed.'}
  return
}
if(-not $Install){
  Write-Output 'Nothing installed. Run with -Install only after reviewing docs/AUTO_DEPLOY_WINDOWS.md.'
  return
}
if(-not(Test-Path -LiteralPath $watcher)){throw 'Auto deploy script not found.'}
$watchdogs=@(Get-CimInstance Win32_Process -Filter "name='powershell.exe' or name='pwsh.exe'" |
  Where-Object { $_.CommandLine -match '[\\/]host-loop\.ps1\b' })
if($watchdogs.Count -gt 0){
  throw 'A host-loop.ps1 watcher is running. Inspect/disable that watchdog first to prevent two supervisors fighting over port 3011.'
}
if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){
  throw 'Task already exists. Inspect the task before changing it or disable it explicitly.'
}
$quotes=[char]34
$command='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' + $quotes + $watcher + $quotes + ' -Apply'
$action=New-ScheduledTaskAction -Execute (Get-Command 'powershell.exe').Source -Argument $command
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Deploy green OJ Workspace main commits to localhost:3011 with staged build and rollback' | Out-Null
Write-Output "Installed $name: checks every 5 minutes while this Windows user is logged in."
Write-Output 'The task never changes Tailscale, STRATHOS or SQL tables.'
Write-Output ('Inspect status: Get-ScheduledTask -TaskName ' + $quotes + $name + $quotes)
