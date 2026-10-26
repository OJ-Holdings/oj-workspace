# Private Storage byte recovery - October 25, 2026

Actual Windows execution, not a simulation. No production object was modified.

| Check | Result |
| --- | --- |
| Protected Windows Storage credential decrypted | PASS |
| Read-only catalog vs authenticated Storage API identity/size inventory | PASS |
| Raw authenticated file downloads | PASS: 2 objects, 38,670,441 bytes |
| Source inventory unchanged before/after download | PASS |
| Source plaintext SHA-256 and exact EOF byte counts | PASS |
| Existing age v1.3.2 identity; no key rotation | PASS |
| Encrypted object archives and encrypted private manifest | PASS |
| Ciphertext checksums on distinct physical disk | PASS |
| New private local readback from mirror; plaintext hashes and counts | PASS |
| Separate restore-only process, no HTTP/DB credentials loaded | PASS |
| Independently retained off-PC/offline media custody | UNVERIFIED |
| OS-enforced network-denied restore sandbox | UNVERIFIED; local readback performs no network operations |
| Current R40 archive checksum, mirror, authenticated decryption, PG17 readability | PASS |
| Fresh database restore/current source parity/full actor matrix | BLOCKED: existing administrator-only runner guard |
| U2/U2B production migrations / U2C release | NOT ACTIVATED |

Private object names, hashes, paths and identities are in the encrypted manifest,
outside Git. Sanitized receipts are beside the archives on both backup disks.
Partial batches are preserved without a success receipt. The script never uploads,
updates, deletes, or replaces a production object. Do not interpret the mechanical
R40 status field `storage_object_bytes_recovered=false` as an inspection of the
new Storage receipt: that older tool does not consume this independent evidence.

## Repeatable owner-host commands

From the repository, under the same Windows account holding the DPAPI identity:

```powershell
.\scripts\backup-supabase-storage-windows.ps1
.\scripts\backup-supabase-storage-windows.ps1 -VerifyMirror
```

The first command creates a new unique batch, never overwrites an existing batch,
and requires the current two-object inventory to remain stable. Changed inventory
stops the operation rather than silently certifying a new recovery scope. The
second reads the latest completed mirror and performs a new independent streamed
readback using only the encrypted manifest and existing recovery identity. No
plaintext customer file or plaintext manifest is written to disk.

Python 3.12 and the existing pinned age and PostgreSQL 17 clients are required.
The API key is read only from the owner-created `storage-key.dpapi` in the existing
private R40 settings directory. It is never passed as a process argument. Admin
Storage access is confined to this owner recovery tool, not application requests.

Fresh DB recovery still requires **Administrator Windows PowerShell**, preserving
the existing guard. Run commands in order, after reading the guarded runner:

```powershell
Set-Location C:\STRATHOS\oj-workspace-commercial-persist
$env:PSModulePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules'
.\scripts\restore-supabase-docker-drill.ps1 -UseR40 -RefreshBackup
```

The process-local module path avoids inherited PowerShell module-version conflicts;
it does not change machine configuration or weaken recovery checks. The runner
creates a new isolated database; it never targets production for restore. Preserve
that environment until current parity and the required actor matrix are verified.
Separately arrange offline/off-host custody of the verified encrypted mirror and
the separately stored recovery identity. Two connected disks do not certify this.

## Validation and release limits

- Nine focused synthetic tests PASS on Windows, including actual age round trip,
  tampering rejection, no overwrite, redirects, denied access and exact binary streams.
- Existing full application suite: 731 PASS; TypeScript PASS.
- Local application production build FAIL in the existing Google font loader
  (`next/font`); no application or font code was changed. No deployment attempted.
- Exact-head GitHub CI and review must pass before merge. U2 activation remains
  blocked independently by the recovery prerequisites above.
- Overall provisional engineering 49% (formal historical 42%); founder audit ~50%,
  strict two-founder acceptance 0/16. No score increase from this partial gate.
