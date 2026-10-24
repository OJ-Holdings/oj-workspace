# Offline synthetic P2 checks only: no production host, Auth sessions or backups.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\lib\exterior-p2-release-evidence.ps1')
$sha='abcdef0123456789abcdef0123456789abcdef01'
$other='123456789abcdef0123456789abcdef012345678'
function Assert([bool]$Pass,[string]$Why){if(-not $Pass){throw ('P2 offline evidence refusal failed: '+$Why)}}
$permitted=@('https://ojworkspace.netlify.app','https://ojworkspace.netlify.app/',
 'https://desktop-lbi2ein.tail3f006f.ts.net:10000')
foreach($uri in $permitted){
 $normalized=Assert-OjP2PublicOrigin $uri
 Assert ($normalized.StartsWith('https://')) 'only clean HTTPS'
}
$rejected=@(
 'http://ojworkspace.netlify.app','https://ojworkspace.netlify.app/api/deploy-health',
 'https://ojworkspace.netlify.app/?data=1','https://ojworkspace.netlify.app/#secret',
 'https://user:pw@ojworkspace.netlify.app','https://ojworkspace.netlify.app.evil.example',
 'https://localhost:10000','https://127.0.0.1:10000',
 'https://desktop-lbi2ein.tail3f006f.ts.net:9999',
 'https://desktop-lbi2ein.tail3f006f.ts.net.evil.example',
 'file:///etc/passwd','ftp://ojworkspace.netlify.app','',
 'https://other.netlify.app'
)
foreach($uri in $rejected){
 $blocked=$false
 try{$null=Assert-OjP2PublicOrigin $uri}catch{$blocked=$true}
 Assert $blocked 'unapproved or credential-bearing URL'
}
$matching=@{status='ok';release=$sha}
Assert ((ConvertTo-OjP2Probe $matching $sha) -eq 'matched') 'exact SHA'
Assert ((ConvertTo-OjP2Probe @{status='ok';release=$sha.ToUpperInvariant()} $sha) -eq 'matched') 'uppercase commit'
Assert ((ConvertTo-OjP2Probe @{status='ok';release=$other} $sha) -eq 'different') 'stale deployment'
Assert ((ConvertTo-OjP2Probe @{status='ok';release='unmanaged'} $sha) -eq 'unmanaged') 'Netlify missing release env'
foreach($bad in @($null,@{},@{status='bad';release=$sha},@{status='ok';release='short'},@{status='ok'},@{release=$sha})){
 Assert ((ConvertTo-OjP2Probe $bad $sha) -ne 'matched') 'malformed endpoint'
}
$proof=New-OjP2Evidence $sha $matching $matching
Assert ($proof.release_route_parity_only -eq $true) 'both current version'
foreach($key in @('real_signed_in_founder_A_tested','real_signed_in_founder_B_tested',
 'shared_booking_task_comment_roundtrip','encrypted_actual_production_backup',
 'independently_restored_production_data','storage_file_bytes_restored',
 'authenticated_rls_actor_matrix_passed','live_schema_migration_authorized')){
 Assert ($proof[$key] -eq $false) 'a release cannot establish actor/recovery acceptance'
}
Assert ((New-OjP2Evidence $sha @{status='ok';release=$other} $matching).release_route_parity_only -eq $false) 'local mismatch'
Assert ((New-OjP2Evidence $sha $matching $null).release_route_parity_only -eq $false) 'public route unavailable'
$withSecrets=@{status='ok';release=$sha;customer_address='DO-NOT-PRINT';auth_cookie='DO-NOT-PRINT';backup_path='DO-NOT-PRINT'}
$serialized=(New-OjP2Evidence $sha $withSecrets $withSecrets|ConvertTo-Json -Compress)
Assert (-not $serialized.Contains('DO-NOT-PRINT')) 'only allowlisted sanitized output'
Write-Output 'PASS: offline P2 host origin refusal and release evidence, never actor/recovery approval'
