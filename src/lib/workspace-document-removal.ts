/** The caller authenticates membership; every operation stays on its scoped
 * client. Storage failure must never discard the only database file reference.
 * Storage and PostgreSQL are separate services: this is not an atomic delete.
 */
export async function removeWorkspaceDocument(
  organizationId: string,
  documentId: string,
  operations: {
    lookup: () => Promise<{ storagePath: string } | null>;
    removeObject: (path: string) => Promise<boolean>;
    removeMetadata: (path: string) => Promise<void>;
  },
): Promise<void> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(organizationId) || !uuid.test(documentId)) throw new Error('Invalid document reference.');
  let row: { storagePath: string } | null;
  try { row = await operations.lookup(); }
  catch { throw new Error('Could not check the document. Nothing was removed.'); }
  if (!row) throw new Error('The document is no longer available to this account.');
  if (!row.storagePath.startsWith(organizationId + '/') || row.storagePath.includes('..')) {
    throw new Error('The document location could not be verified. Nothing was removed.');
  }
  try {
    if (!await operations.removeObject(row.storagePath)) throw new Error('No exact removal receipt.');
  }
  catch { throw new Error('The file could not be removed. Its company record was kept; retry after checking your connection and access.'); }
  try { await operations.removeMetadata(row.storagePath); }
  catch { throw new Error('File removal completed, but the company record could not be removed. Refresh and reconcile the remaining record before claiming deletion is complete.'); }
}
