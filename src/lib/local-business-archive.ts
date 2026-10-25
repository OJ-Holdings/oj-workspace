export const localBusinessArchiveFormat = 'oj-local-business-archive-v1' as const;

export type LocalBusinessArchiveRecord = {
  key: string;
  bytes: number;
  sha256: string;
  value: string;
};

export type LocalBusinessArchive = {
  format: typeof localBusinessArchiveFormat;
  organizationId: string;
  exportedAt: string;
  sourceOrigin: string;
  storage: 'current-origin-localStorage';
  records: LocalBusinessArchiveRecord[];
  archiveSha256: string;
};

export const localBusinessArchiveMaxBytes = 20 * 1024 * 1024;
const localBusinessArchiveMaxRecords = 1000;

/** Only business records with an explicit organization-key segment are exported.
 * Preview fixtures and unrelated localStorage keys are deliberately excluded.
 * This reads one authorized browser origin; it cannot see another origin/profile/device.
 */
export const localBusinessPrefixes = (organizationId: string): string[] => [
  `oj-commercial-estimate-v2:${organizationId}`,
  `oj-commercial-project-portfolio-v1:${organizationId}`,
  `oj-fleet-command-v1:${organizationId}`,
  `oj-exterior-estimate-v1:${organizationId}:`,
  `oj-exterior-crew-handoff-v1:${organizationId}:`,
  `oj-exterior-field-v1:${organizationId}:`,
  `oj-exterior-field-equipment-v1:${organizationId}:`,
  `oj-work-rules:live:${organizationId}`,
];

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)]
  .map(value => value.toString(16).padStart(2, '0')).join('');

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return hex(digest);
}

function archiveManifest(archive: Omit<LocalBusinessArchive, 'archiveSha256'>) {
  return {
    format: archive.format,
    organizationId: archive.organizationId,
    exportedAt: archive.exportedAt,
    sourceOrigin: archive.sourceOrigin,
    storage: archive.storage,
    records: archive.records.map(({ key, bytes, sha256: digest, value }) => ({ key, bytes, sha256: digest, value })),
  };
}

/** Validate an exported recovery file before showing a restore confirmation.
 * Hashes protect against accidental corruption; they are not a signature or proof of origin.
 */
export async function validateLocalBusinessArchive(
  serialized: string,
  expectedOrganizationId: string,
): Promise<LocalBusinessArchive> {
  if (new TextEncoder().encode(serialized).byteLength > localBusinessArchiveMaxBytes) {
    throw new Error('Recovery archive exceeds the 20 MiB limit. Keep the original file unchanged.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(expectedOrganizationId)) throw new Error('A valid workspace organization is required.');
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('Recovery archive is not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Recovery archive has an invalid structure.');
  const archive = value as Partial<LocalBusinessArchive>;
  if (archive.format !== localBusinessArchiveFormat || archive.storage !== 'current-origin-localStorage' ||
      archive.organizationId !== expectedOrganizationId || typeof archive.exportedAt !== 'string' ||
      typeof archive.sourceOrigin !== 'string' || archive.sourceOrigin.length > 500 ||
      typeof archive.archiveSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(archive.archiveSha256) ||
      !Array.isArray(archive.records) || archive.records.length > localBusinessArchiveMaxRecords) {
    throw new Error('Recovery archive is not a supported, organization-matched OJ archive. No browser data changed.');
  }
  if (!Number.isFinite(Date.parse(archive.exportedAt)) ||
      !/^https?:\/\//i.test(archive.sourceOrigin)) throw new Error('Recovery archive metadata is invalid.');

  const prefixes = localBusinessPrefixes(expectedOrganizationId);
  const seen = new Set<string>();
  let recordBytes = 0;
  for (const candidate of archive.records) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Recovery archive contains a malformed record.');
    const record = candidate as Partial<LocalBusinessArchiveRecord>;
    if (typeof record.key !== 'string') throw new Error('Recovery archive contains an unsupported or malformed record key.');
    const recordKey = record.key;
    const allowedKey = prefixes.some(prefix =>
      recordKey === prefix || (prefix.endsWith(':') && recordKey.startsWith(prefix)));
    if (!allowedKey || typeof record.value !== 'string' || !Number.isSafeInteger(record.bytes) ||
        (record.bytes as number) < 0 || typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(record.sha256) ||
        seen.has(recordKey)) throw new Error('Recovery archive contains an unsupported, duplicate or malformed record.');
    const bytes = new TextEncoder().encode(record.value).byteLength;
    if (bytes !== record.bytes) throw new Error('Recovery archive record size does not match; no browser data changed.');
    if (await sha256(record.value) !== record.sha256.toLowerCase()) throw new Error('Recovery archive record checksum failed; no browser data changed.');
    recordBytes += bytes;
    if (recordBytes > localBusinessArchiveMaxBytes) throw new Error('Recovery archive records exceed the safe import limit.');
    seen.add(recordKey);
  }

  const manifest = archiveManifest(archive as Omit<LocalBusinessArchive, 'archiveSha256'>);
  if (await sha256(JSON.stringify(manifest)) !== archive.archiveSha256.toLowerCase()) {
    throw new Error('Recovery archive checksum failed; no browser data changed.');
  }
  return archive as LocalBusinessArchive;
}

export type LocalBusinessRestoreResult = { restoredKeys: string[]; skippedExistingKeys: string[] };

/** Restore only missing keys. Existing local drafts are never overwritten. */
export async function restoreMissingLocalBusinessArchive(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  archive: LocalBusinessArchive,
  organizationId: string,
): Promise<LocalBusinessRestoreResult> {
  const verified = await validateLocalBusinessArchive(JSON.stringify(archive), organizationId);
  const missing = verified.records.filter(record => storage.getItem(record.key) === null);
  const skippedExistingKeys = verified.records.filter(record => storage.getItem(record.key) !== null).map(record => record.key);
  const restoredKeys: string[] = [];
  try {
    for (const record of missing) {
      storage.setItem(record.key, record.value);
      restoredKeys.push(record.key);
    }
  } catch {
    // Undo only keys this import just created. Never touch an existing record.
    for (const key of restoredKeys) {
      try { storage.removeItem(key); } catch { /* caller receives a failure; originals remain untouched */ }
    }
    throw new Error('Restore stopped because browser storage rejected a write. Newly added archive records were rolled back where possible; existing records were left unchanged.');
  }
  return { restoredKeys, skippedExistingKeys };
}

export async function exportLocalBusinessArchive(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
  organizationId: string,
  sourceOrigin: string,
  exportedAt = new Date().toISOString(),
): Promise<LocalBusinessArchive> {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) throw new Error('A valid workspace organization is required.');
  if (typeof sourceOrigin !== 'string' || sourceOrigin.length > 500) throw new Error('Invalid source origin.');
  const prefixes = localBusinessPrefixes(organizationId);
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && prefixes.some(prefix => key === prefix || (prefix.endsWith(':') && key.startsWith(prefix)))) keys.push(key);
  }
  keys.sort((a, b) => a.localeCompare(b));

  const records: LocalBusinessArchiveRecord[] = [];
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value === null) continue;
    records.push({
      key,
      bytes: new TextEncoder().encode(value).byteLength,
      sha256: await sha256(value),
      value,
    });
  }
  const manifest = {
    format: localBusinessArchiveFormat,
    organizationId,
    exportedAt: new Date(exportedAt).toISOString(),
    sourceOrigin,
    storage: 'current-origin-localStorage' as const,
    records,
  };
  const archiveSha256 = await sha256(JSON.stringify(archiveManifest(manifest)));
  return { ...manifest, archiveSha256 };
}
