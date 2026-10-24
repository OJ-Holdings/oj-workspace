# P2 founder-run release provenance: READ ONLY. Run on the OJ trusted Windows
# host. Compares GitHub's current SHA to BOTH the loopback served app and the
# explicitly selected OJ HTTPS public app origin (Netlify or Tailscale Funnel).
# This does NOT test sign-in, backup recovery, RLS or two-founder collaboration.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$PublicOrigin,
 [switch]$EmitSanitizedJson
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT') {
 throw 'P2 release evidence must run on the trusted Windows deployment host.'
}
. (Join-Path $PSScriptRoot 'lib\exterior-p2-release-evidence.ps1')
$base=Assert-OjP2PublicOrigin $PublicOrigin
$git=Get-Command git -ErrorAction SilentlyContinue
if(-not $git) { throw 'Git is required to verify GitHub main.' }
$ref=@(& $git.Source ls-remote 'https://github.com/OJ-Holdings/oj-workspace.git' refs/heads/main 2>&1)
if($LASTEXITCODE -ne 0 -or $ref.Count -ne 1 -or $ref[0] -notmatch '^([a-f0-9]{40})\s') {
 throw 'Could not independently verify current GitHub main.'
}
$expected=$Matches[1]
function Read-Release([string]$url) {
 try {
  # Never follow app login redirects: they could otherwise look like health.
  # No cookies, authorization headers, secrets, database or user data are sent.
  return Invoke-RestMethod -Method GET -Uri $url -TimeoutSec 8 -MaximumRedirection 0 -Headers @{'Accept'='application/json';'Cache-Control'='no-cache'}
 } catch { return $null }
}
$local=Read-Release 'http://127.0.0.1:3011/api/deploy-health'
$public=Read-Release ($base+'/api/deploy-health')
$proof=New-OjP2Evidence $expected $local $public
if($EmitSanitizedJson) {
 $proof | ConvertTo-Json -Depth 4 -Compress
}else{
 Write-Output ('GitHub main identity: '+$proof.expected_main_commit)
 Write-Output ('Local 3011 source: '+$proof.local_served_release)
 Write-Output ('Selected OJ public source: '+$proof.public_served_release)
 Write-Output ('Exact version parity only: '+$proof.release_route_parity_only)
 Write-Output 'All data recovery, RLS actor and two-founder acceptance flags: FALSE (not evaluated).'
}
if(-not $proof.release_route_parity_only) {
 throw 'NOT VERIFIED: both app routes do not report the exact current GitHub main commit. No acceptance or migration approval can be inferred.'
}
Write-Output 'PASS: local and selected public app report GitHub main SHA. This is RELEASE IDENTITY ONLY, not a database or account health check.'
