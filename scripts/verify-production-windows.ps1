# OJ Workspace: verify the actual Windows production process (read-only except opt-in task trigger).
# Compatible with Windows PowerShell 5.1.
[CmdletBinding()]
param(
  [switch]$TriggerUpdater,
  [ValidateRange(5,600)][int]$TimeoutSeconds = 300
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$task = 'OJ Workspace - GitHub Auto Deploy'
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { throw 'Git is not installed / on PATH' }
$ref = @(& $git.Source ls-remote 'https://github.com/OJ-Holdings/oj-workspace.git' refs/heads/main 2>&1)
if ($LASTEXITCODE -ne 0 -or $ref.Count -ne 1 -or $ref[0] -notmatch '^([0-9a-f]{40})\s') {
  throw 'Could not verify GitHub main. Check GitHub connectivity/credentials.'
}
$expected = $Matches[1]
Write-Output ('Expected GitHub main: ' + $expected)
if ($TriggerUpdater) {
  Start-ScheduledTask -TaskName $task
  Write-Output 'Triggered the existing CI/schema-guarded deploy task. No application processes were stopped by this verifier.'
}

# A task trigger returns before npm ci, tests and the build complete. Poll
# boundedly to avoid false "not live" alarms on healthy in-progress releases.
$timer = [Diagnostics.Stopwatch]::StartNew()
$matches = $false
$lastStatus = 'No response'
$attempt = 0
do {
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:3011/api/deploy-health' -TimeoutSec 7
    $lastStatus = ('status=' + $health.status + '; release=' + $health.release)
    $matches = ($health.status -eq 'ok' -and $health.release -eq $expected)
  } catch {
    $lastStatus = 'localhost:3011 health endpoint did not respond'
  }

  if ($matches -or -not $TriggerUpdater -or $timer.Elapsed.TotalSeconds -ge $TimeoutSeconds) {
    break
  }
  $attempt++
  if (($attempt % 6) -eq 0) {
    Write-Output ('Still checking the live release; observed ' + $lastStatus)
  }
  Start-Sleep -Seconds 5
} while ($true)
$timer.Stop()
Write-Output ('Host health: ' + $lastStatus)
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
throw 'NOT VERIFIED: port 3011 is not serving current GitHub main. Inspect task status and deploy log; the previous live build may still be serving.'
