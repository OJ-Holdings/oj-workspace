'use client';

import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { updateOutreachStatus } from '@/app/workspace/outreach-actions';
import { effectiveOutreachStatus, outreachNextStep, outreachStatuses, safeOutreachUrl, type OutreachProspect, type OutreachStatus } from '@/lib/outreach';
import { socialUrl } from '@/lib/dm-quests';
import { SolutionsConsultations } from '../SolutionsConsultations';
import { Gate } from './parts';
import type { GrowthStore } from './useGrowth';

const warm: OutreachStatus[] = ['Replied', 'Demo Booked'];
const script: [string, string][] = [
  ['Open', 'Hey, it\'s [your name] with OJ Solutions. You wrote back to my note (or tried our AI line). Do you have two minutes?'],
  ['Find the pain', 'When you\'re on a job and the phone rings, what happens to that call today? How many do you think go to voicemail?'],
  ['Show, don\'t tell', 'Offer the demo line or a 15-minute walkthrough. Let them hear the AI take a call for their kind of business.'],
  ['Next step', 'Agree on one thing: a walkthrough time, or the setup. Then send the confirmation the same hour.'],
];

/** People who answered, plus website requests: the only people worth a phone call. */
export function WarmLeads({ g }: { g: GrowthStore }) {
  return <Gate g={g}>{data => <Warm g={g} prospects={data.prospects} />}</Gate>;
}

function Warm({ g, prospects }: { g: GrowthStore; prospects: OutreachProspect[] }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const leads = prospects.filter(p => warm.includes(effectiveOutreachStatus(p)))
    .sort((a, b) => Number(effectiveOutreachStatus(a) === 'Demo Booked') - Number(effectiveOutreachStatus(b) === 'Demo Booked') || (b.status_updated_at ?? '').localeCompare(a.status_updated_at ?? ''));
  async function change(p: OutreachProspect, next: OutreachStatus) {
    if (g.readOnly || g.mode === 'preview' || saving) return;
    setSaving(p.id); setNotice('');
    try { await updateOutreachStatus(g.org, p.id, next); setNotice(`${p.business_name}: ${next} recorded.`); g.reload(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSaving(null); }
  }
  return <div className="gx-page">
    <header className="page-head gx-head"><div><h1>Warm leads</h1><p>Everyone who replied or booked a demo. This is the only list worth a phone call: they already said yes to a conversation.</p></div></header>
    <p role="status" className="gx-notice">{notice}</p>
    <section className="panel" aria-labelledby="gx-warm-list">
      <header className="panel-head"><h2 id="gx-warm-list">From outreach</h2><span className="quiet">{leads.length} {leads.length === 1 ? 'person' : 'people'}</span></header>
      {leads.length ? <ul className="gx-leads">{leads.map(p => {
        const status = effectiveOutreachStatus(p), site = safeOutreachUrl(p.website_url);
        const ig = socialUrl(p.instagram, 'instagram'), fb = socialUrl(p.facebook, 'facebook');
        return <li key={p.id}>
          <div><h3>{p.business_name}</h3><p className="quiet">{[p.decision_maker, p.industry, p.city_state].filter(Boolean).join(' · ') || 'Details not recorded'}</p>
            <p className="gx-next"><b>Next:</b> {outreachNextStep(status)}</p></div>
          <div className="gx-lead-links">
            {p.phone_number && <a className="primary" href={`tel:${p.phone_number.replace(/[^\d+]/g, '')}`}><Phone size={14} aria-hidden="true" />{p.phone_number}</a>}
            {p.email && <a className="secondary" href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(p.email)}`} target="_blank" rel="noreferrer noopener"><Mail size={14} aria-hidden="true" />Open thread</a>}
            {ig && <a className="secondary" href={ig} target="_blank" rel="noreferrer noopener">Instagram</a>}
            {fb && <a className="secondary" href={fb} target="_blank" rel="noreferrer noopener">Facebook</a>}
            {site && <a className="secondary" href={site} target="_blank" rel="noreferrer noopener">Website</a>}
          </div>
          <label>Status<select value={status} disabled={g.readOnly || g.mode === 'preview' || saving === p.id} onChange={e => void change(p, e.target.value as OutreachStatus)}>{outreachStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
        </li>;
      })}</ul> : <div className="empty"><p><b>No replies yet.</b> When someone answers an email, the engine marks them Replied and they appear here. Move them to Demo Booked once a time is set.</p></div>}
    </section>
    <SolutionsConsultations org={g.org} mode={g.mode} />
    <details className="panel gx-script"><summary><h2>Warm-call script (four steps)</h2></summary>
      <ol>{script.map(([title, line]) => <li key={title}><b>{title}.</b> {line}</li>)}</ol>
      <p className="quiet">Only call people who replied, booked, or asked for a consultation. Never cold-call from this list.</p></details>
  </div>;
}
