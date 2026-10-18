'use client';

import { useState } from 'react';
import { createStrathosLink } from '@/app/workspace/strathos-link-action';

export function StrathosLinkForm({ org }: { org: string }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function make() {
    setBusy(true); setError(''); setCopied(false);
    try {
      const path = await createStrathosLink(org);
      setLink(`${window.location.origin}${path}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="button" disabled={busy} onClick={make}>{link ? 'Make a new link' : 'Create the STRATHOS link'}</button>
      {error && <p role="alert">{error}</p>}
      {link && (
        <>
          <p className="quiet">Shown once. Paste it into STRATHOS, then close this page. Making a new link cancels this one.</p>
          <input readOnly value={link} aria-label="STRATHOS link" onFocus={(e) => e.currentTarget.select()} style={{ width: '100%' }} />
          <button type="button" className="text-link" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* select and copy by hand */ } }}>{copied ? 'Copied' : 'Copy link'}</button>
        </>
      )}
    </div>
  );
}
