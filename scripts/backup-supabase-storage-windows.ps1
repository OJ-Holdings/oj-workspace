# Owner-only private recovery utility, separate from customer-facing application.
[CmdletBinding()]
param([switch]$VerifyMirror)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows is required.' }
$python = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Install Python 3.12 for this Windows user first.' }
if ($VerifyMirror) {
    & $python (Join-Path $PSScriptRoot 'backup-supabase-storage-windows.py') --verify-mirror
} else {
    & $python (Join-Path $PSScriptRoot 'backup-supabase-storage-windows.py')
}
if ($LASTEXITCODE -ne 0) { throw 'Storage recovery did not pass. See the sanitized OJ_STORAGE_CODE above.' }
