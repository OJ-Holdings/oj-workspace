'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Camera, Trash2 } from 'lucide-react';
import { ojConnection } from '@/lib/oj-connection';

type Photo = { id: string; storage_path: string; kind: 'before' | 'after' | 'other'; caption: string; taken_on: string; url: string | null };
const BUCKET = 'oj-job-photos';
const kinds: [Photo['kind'], string][] = [['before', 'Before'], ['after', 'After'], ['other', 'Other']];
const MAX_EDGE = 1600;

/** Shrinks a phone photo (often 4 to 8 MB) to about 1600 px on its long side as a JPEG, so uploads are quick on a job site and storage stays small. Falls back to the original file. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch { return file; }
}

/**
 * Before and after photos for a job, taken on the phone and kept privately (master plan 6.1). Needs docs/db-change-proposals/RUN-ME-2026-10-28-job-photos.sql;
 * until that has been run the section does not appear. Pictures are shown through short-lived signed links; there is never a public address.
 */
export function JobPhotos({ org, leadId, live, readOnly }: { org: string; leadId: string; live: boolean; readOnly: boolean }) {
  const client = useMemo(() => createBrowserClient(ojConnection.url, ojConnection.publishableKey), []);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [kind, setKind] = useState<Photo['kind']>('before');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const load = useCallback(async () => {
    if (!live) return;
    const { data, error } = await client.from('oj_job_photos').select('id,storage_path,kind,caption,taken_on').eq('organization_id', org).eq('lead_id', leadId).order('created_at', { ascending: false });
    if (error) { setPhotos(null); return; }
    const rows = (data ?? []) as Omit<Photo, 'url'>[];
    const signed = rows.length ? await client.storage.from(BUCKET).createSignedUrls(rows.map(r => r.storage_path), 900) : { data: [] as { signedUrl: string }[] };
    setPhotos(rows.map((r, i) => ({ ...r, url: signed.data?.[i]?.signedUrl ?? null })));
  }, [client, org, leadId, live]);
  useEffect(() => { void load(); }, [load]);

  if (!live || photos === null) return null;

  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setProblem('');
    try {
      const blob = await shrink(file);
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${org}/${leadId}/${crypto.randomUUID()}.${ext}`;
      const up = await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (up.error) throw new Error('upload');
      const row = await client.from('oj_job_photos').insert({ organization_id: org, lead_id: leadId, storage_path: path, kind });
      if (row.error) { await client.storage.from(BUCKET).remove([path]); throw new Error('record'); }
      await load();
    } catch { setProblem('That photo did not save. Check your connection and try again.'); } finally { setBusy(false); }
  };
  const remove = async (p: Photo) => {
    if (!window.confirm('Delete this photo?')) return;
    setBusy(true); setProblem('');
    const rowGone = await client.from('oj_job_photos').delete().eq('id', p.id);
    if (rowGone.error) setProblem('That photo could not be deleted.'); else { await client.storage.from(BUCKET).remove([p.storage_path]); await load(); }
    setBusy(false);
  };

  return (
    <section className="jobphotos" aria-label="Photos">
      <div className="jobphotos-head"><span>Photos</span><b>{photos.length || 'None yet'}</b></div>
      {!readOnly && <div className="jobphotos-add">
        <select aria-label="Photo type" value={kind} onChange={e => setKind(e.target.value as Photo['kind'])}>{kinds.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <label className="secondary small jobphotos-take"><Camera size={15} aria-hidden="true" /> {busy ? 'Saving' : 'Take or add photo'}
          <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => { void add(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>}
      {problem && <p className="quiet" role="alert">{problem}</p>}
      {photos.length > 0 && <ul className="jobphotos-grid">
        {photos.map(p => <li key={p.id}>
          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={`${p.kind} photo from ${p.taken_on}`} loading="lazy" /></a> : <span className="quiet">Unavailable</span>}
          <span className={`jobphotos-kind is-${p.kind}`}>{kinds.find(([id]) => id === p.kind)?.[1]}</span>
          {!readOnly && <button type="button" className="icon-button" aria-label="Delete photo" disabled={busy} onClick={() => void remove(p)}><Trash2 size={13} aria-hidden="true" /></button>}
        </li>)}
      </ul>}
    </section>
  );
}
