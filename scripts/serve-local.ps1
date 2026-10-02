$ErrorActionPreference = 'Stop'
$taskApp = Split-Path -Parent $PSScriptRoot
$taskReports = 'C:\STRATHOS\reports'
$taskExisting = Get-NetTCPConnection -State Listen -LocalPort 3011 -ErrorAction SilentlyContinue
if ($taskExisting) { throw 'Port 3011 is already in use. Inspect its owner before starting another server.' }
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList @('node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3011') -WorkingDirectory $taskApp -WindowStyle Hidden -RedirectStandardOutput "$taskReports\oj-workspace-server.stdout.log" -RedirectStandardError "$taskReports\oj-workspace-server.stderr.log" -PassThru
Write-Output "OJ server process: $($taskProcess.Id)"
