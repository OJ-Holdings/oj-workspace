# OJ Workspace: verify actual Windows/Tailscale production (no data changes).
[CmdletBinding()]
param([switch]$TriggerUpdater)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$task = 'OJ Workspace - GitHub Auto Deploy'
$expected = ''
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { throw 'Git is not installed / on PATH' }
$ref = @(& $git.Source ls-remote 'https://github.com/OJ-Holdings/oj-workspace.git' refs/heads/main 2>&1)
if ($LASTEXITCODE -ne 0 -or $ref.Count -ne 1 -or $ref[0] -notmatch '^([0-9a-f]{40})\s') {
  throw 'Could not verify GitHub main. Check GitHub connectivity/credentials.'
}
$expected = $Matches[1]
if ($TriggerUpdater) {
  Start-ScheduledTask -TaskName $task
  Write-Output 'Triggered existing GitHub Auto Deploy task. This script does not stop or restart production.'
}
Write-Output ('Expected GitHub main: ' + $expected)
try {
  $health = Invoke-RestMethod 'http://127.0.0.1:3011/api/deploy-health' -TimeoutSec 7
  Write-Output ('Host health: status=' + $health.status + '; release=' + $health.release)
  $matches = $health.status -eq 'ok' -and $health.release -eq $expected
} catch {
  Write-Warning 'Cannot query localhost:3011 health endpoint from this host.'
  $matches = $false
}
try {
  $taskInfo = Get-ScheduledTaskInfo -TaskName $task
  Write-Output ('Updater last run: ' + $taskInfo.LastRunTime + '; result=' + $taskInfo.LastTaskResult)
} catch {
  Write-Warning 'Could not read auto-deployer Scheduled Task state.'
}
$logs = Join-Path (Join-Path $PSScriptRoot '..\..\oj-workspace-releases') 'logs\deploy.log'
$logs = [IO.Path]::GetFullPath($logs)
if (Test-Path -LiteralPath $logs) {
  Write-Output 'Last ten deployment log entries:'
  Get-Content -LiteralPath $logs -Tail 10
} else {
  Write-Warning 'No deploy.log found at expected releases sibling folder.'
}
if ($matches) {
  Write-Output 'PASS: this Windows host is serving exactly GitHub main on port 3011.'
  return
}
throw 'NOT VERIFIED: port 3011 is not confirmed to serve the latest GitHub main. Review the task and log.'
