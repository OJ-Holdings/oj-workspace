'use client';

import { useEffect, useMemo, useState } from 'react';
import { draftKindLabel, groupDrafts, type Draft } from '@/lib/message-drafts';
import { isRealPhone } from '@/lib/exterior-ops';

const KEY = 'oj-os-drafts-done-v1';
const readDone = (): string[] => { try { const v = JSON.parse(window.localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-500) : []; } catch { return []; } };

/**
 * Messages ready to send: each one is written from the record and waits for a person. Copy it, send it from your own phone, then tap Done.
 * Nothing is sent from here. Done hides a draft on this device; for new leads and quotes it also moves the lead along so it leaves the queue everywhere.
 */
export function MessageDrafts({ drafts, readOnly, onDone }: { drafts: Draft[]; readOnly: boolean; onDone: (d: Draft) => void }) {
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState('');
  useEffect(() => { setDone(readDone()); }, []);
  const left = useMemo(() => drafts.filter(d => !done.includes(d.id)), [drafts, done]);
  const groups = useMemo(() => groupDrafts(left), [left]);

  const copy = async (d: Draft) => {
    try { await navigator.clipboard.writeText(d.body); setCopied(d.id); }
    catch { setCopied(''); window.prompt('Copy this message:', d.body); }
  };
  const finish = (d: Draft) => {
    const next = [...done, d.id];
    setDone(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next.slice(-500))); } catch { /* storage unavailable: it just comes back next visit */ }
    if (!readOnly) onDone(d);
  };

  return (
    <section className="panel drafts">
      <header className="panel-head"><h2>Messages ready to send</h2><span className="quiet">{left.length} waiting</span></header>
      {groups.length === 0 ? <div className="empty"><p><b>Nothing to send right now.</b></p></div> : groups.map(g => <div key={g.kind}>
        <h3 className="stop-group">{draftKindLabel[g.kind]}</h3>
        <ul className="draft-list">
          {g.items.map(d => <li key={d.id}>
            <div><b>{d.lead.name || 'Customer'}</b><span>{d.why}</span></div>
            <p>{d.body}</p>
            <div className="draft-actions">
              <button type="button" className="primary small" onClick={() => void copy(d)}>{copied === d.id ? 'Copied' : 'Copy message'}</button>
              {isRealPhone(d.lead.phone) ? <a className="secondary small" href={`tel:${d.lead.phone}`}>Call</a> : <span className="quiet">No phone number</span>}
              <button type="button" className="secondary small" onClick={() => finish(d)}>Done</button>
            </div>
          </li>)}
        </ul>
      </div>)}
    </section>
  );
}
