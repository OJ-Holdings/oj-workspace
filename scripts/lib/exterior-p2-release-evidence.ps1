# Pure offline P2 release-evidence validation. Dot-source on trusted Windows
# or in CI with synthetic responses. NEVER reads passwords, customer records,
# archive paths, Auth IDs, browser cookies, production DB or API keys.
function Assert-OjP2PublicOrigin([string]$Origin) {
 if ([string]::IsNullOrWhiteSpace($Origin)) { throw 'Provide an explicit OJ HTTPS public app origin.' }
 $url = $null
 if (-not [Uri]::TryCreate($Origin, [UriKind]::Absolute, [ref]$url)) {
  throw 'App origin is not a valid absolute HTTPS URL.'
 }
 if ($url.Scheme -cne 'https' -or $url.UserInfo -or $url.Query -or $url.Fragment -or
     $url.AbsolutePath -ne '/' -or $url.OriginalString -match '\\s' -or
     $url.OriginalString -match '@') {
  throw 'Only a clean HTTPS app origin without credentials, path, query or fragment is allowed.'
 }
 # Explicitly approved historic deployment origins; the app may now use either.
 # Do NOT turn this host-owned verifier into a generic intranet URL fetcher.
 $hostName = $url.Host.ToLowerInvariant()
 $allowed = (
  ($hostName -ceq 'ojworkspace.netlify.app' -and $url.Port -eq 443) -or
  ($hostName -ceq 'desktop-lbi2ein.tail3f006f.ts.net' -and $url.Port -in @(443,10000))
 )
 if (-not $allowed) { throw 'Only an explicitly documented OJ production app origin is allowed.' }
 return $url.GetLeftPart([UriPartial]::Authority)
}
function ConvertTo-OjP2Probe([object]$Response, [string]$ExpectedSha) {
 if ($ExpectedSha -cnotmatch '^[a-fA-F0-9]{40}$') {
  throw 'A verified complete 40-character GitHub main SHA is required.'
 }
 # Missing, unauthenticated, redirected, stale, malformed and unmanaged
 # endpoints must NEVER be reported as a successful remote deployment.
 $status = if ($null -eq $Response) { $null } else { $Response.status }
 $release = if ($null -eq $Response) { $null } else { $Response.release }
 if ($status -cne 'ok') { return 'unavailable' }
 if ($release -ceq 'unmanaged') { return 'unmanaged' }
 if (-not ($release -is [string]) -or $release -cnotmatch '^[a-fA-F0-9]{40}$') { return 'invalid' }
 if ($release.ToLowerInvariant() -cne $ExpectedSha.ToLowerInvariant()) { return 'different' }
 return 'matched'
}
function New-OjP2Evidence(
 [string]$ExpectedSha,
 [object]$LocalProbe,
 [object]$PublicProbe
) {
 $local = ConvertTo-OjP2Probe $LocalProbe $ExpectedSha
 $public = ConvertTo-OjP2Probe $PublicProbe $ExpectedSha
 return [ordered]@{
  check = 'OJ_EXTERIOR_P2_RELEASE_EVIDENCE_V1'
  expected_main_commit = $ExpectedSha.ToLowerInvariant()
  local_served_release = $local
  public_served_release = $public
  release_route_parity_only = ($local -eq 'matched' -and $public -eq 'matched')
  real_signed_in_founder_A_tested = $false
  real_signed_in_founder_B_tested = $false
  shared_booking_task_comment_roundtrip = $false
  encrypted_actual_production_backup = $false
  independently_restored_production_data = $false
  storage_file_bytes_restored = $false
  authenticated_rls_actor_matrix_passed = $false
  live_schema_migration_authorized = $false
 }
}
