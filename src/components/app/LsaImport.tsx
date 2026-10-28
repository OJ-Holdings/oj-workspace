'use client';

import { useMemo, useState } from 'react';
import { importLsaLeads } from '@/app/workspace/exterior-actions';
import type { ExtLead } from '@/lib/exterior';
import { lsaSummary, MAX_LSA_ROWS, parseLsaExport, planLsaImport } from '@/lib/lsa-import';
import { Modal, type Act } from './ExteriorManage';

type Props = { open: boolean; close: () => void; leads: ExtLead[]; today: string; act: Act; busy: boolean; org: string };

const monthName = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/**
 * Brings the Google Local Services Ads lead export into the customer list: leads we already have are tagged as LSA, the rest (Aug and Sep were never logged)
 * are added with the date Google received them. Pasting the same export again changes nothing. The preview is computed here; the server reads the text again when applying.
 */
export function LsaImport({ open, close, leads, today, act, busy, org }: Props) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseLsaExport(text), [text]);
  const steps = useMemo(() => planLsaImport(parsed.rows, leads), [parsed.rows, leads]);
  const summary = useMemo(() => lsaSummary(steps, today), [steps, today]);
  const count = (a: string) => steps.filter(s => s.action === a).length;
  const [create, tag] = [count('create'), count('tag')];
  const work = create + tag + steps.filter(s => s.action === 'same').length;

  return (
    <Modal title="Import Local Services Ads leads" open={open} onClose={close}>
      <p className="quiet">On the Local Services Ads Leads page select the whole table, header row included, copy it and paste it here. Leads you already have are tagged as LSA, missing ones are added. Pasting the same list twice changes nothing.</p>
      <label>Lead export<textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={'Customer\tJob type\tSearch Intent\tLocation\tLead type\tCharge status\tLead received\tLast activity\tLead id'} /></label>
      {text.trim() !== '' && (
        <>
          <p role="status">
            {parsed.rows.length} lead{parsed.rows.length === 1 ? '' : 's'} read: {create} new, {tag} to tag as LSA, {count('same')} already tagged, {count('already')} imported before.
            {parsed.skipped > 0 && ` ${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} could not be read and will be skipped.`}
            {parsed.rows.length > MAX_LSA_ROWS && ` Import up to ${MAX_LSA_ROWS} at a time.`}
          </p>
          {summary.months.length > 0 && (
            <div className="tablewrap">
              <table className="table">
                <caption className="sr-only">LSA leads by month</caption>
                <thead><tr><th scope="col">Month</th><th scope="col">Leads</th><th scope="col">Charged</th><th scope="col">Credited</th><th scope="col">Not charged</th></tr></thead>
                <tbody>{summary.months.map(m => <tr key={m.month}><th scope="row">{monthName(m.month)}</th><td>{m.leads}</td><td>{m.charged}</td><td>{m.credited}</td><td>{m.notCharged}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {summary.disputes.length > 0 && (
            <p className="quiet">
              {summary.disputes.length} charged lead{summary.disputes.length === 1 ? ' is' : 's are'} still inside the roughly 30-day dispute window. Soonest: lead {summary.disputes[0].row.leadId} ({summary.disputes[0].row.location || 'no location'}), {summary.disputes[0].daysLeft} day{summary.disputes[0].daysLeft === 1 ? '' : 's'} left. Check the wrong-service, out-of-area and spam ones in your LSA account.
            </p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <span>{work === 0 && text.trim() !== '' ? 'Nothing to change.' : ''}</span>
        <button className="primary" disabled={busy || work === 0 || parsed.rows.length > MAX_LSA_ROWS}
          onClick={() => act(() => importLsaLeads(org, text), r => `LSA import done: ${r.created} added, ${r.tagged} tagged${r.skipped ? `, ${r.skipped} unreadable skipped` : ''}.`).then(ok => { if (ok) { setText(''); close(); } })}>
          {busy ? 'Importing' : `Import ${create + tag}`}
        </button>
      </div>
    </Modal>
  );
}
