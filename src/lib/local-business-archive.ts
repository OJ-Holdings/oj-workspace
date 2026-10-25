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
  const archiveSha256 = await sha256(JSON.stringify(manifest));
  return { ...manifest, archiveSha256 };
}
