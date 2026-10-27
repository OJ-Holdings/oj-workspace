'use client';

import { useMemo, useState } from 'react';
import { jobDate, type ExtLead } from '@/lib/exterior';
import { rebookCandidates } from '@/lib/exterior-rebook';
import { isRealPhone } from '@/lib/exterior-ops';
import { dollars } from '@/lib/metrics';

type Props = { leads: ExtLead[]; now: Date };

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Past customers worth calling or emailing again: one row per customer (newest completed job wins), oldest service first, with a Copy
 * button for a spreadsheet or a mail merge. This is the cheapest revenue next spring, so it lives where the customers are.
 */
export function RebookList({ leads, now }: Props) {
  const [months, setMonths] = useState(5);
  const [copied, setCopied] = useState('');
  const rows = useMemo(() => rebookCandidates(leads, now, months), [leads, months, now]);

  const copy = async () => {
    const lines = ['Name\tPhone\tAddress\tLast service\tLast job date\tLast job revenue', ...rows.map(l => [l.name ?? '', isRealPhone(l.phone) ? l.phone : '', l.address ?? '', l.service_requested ?? '', jobDate(l).slice(0, 10), l.job_revenue ?? ''].join('\t'))];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(`Copied ${rows.length} customers.`); }
    catch { setCopied('Copy was blocked by the browser. Select the table and copy it instead.'); }
  };

  return (
    <details className="panel rebook-list">
      <summary><b>Rebooking list</b> <span className="quiet">{rows.length} past customers not served in {months}+ months</span></summary>
      <div className="lead-tools">
        <label>Not served in the last
          <select value={months} onChange={e => { setMonths(Number(e.target.value)); setCopied(''); }}>
            {[3, 5, 8, 11].map(m => <option key={m} value={m}>{m} months</option>)}
          </select>
        </label>
        <button type="button" className="secondary small" onClick={copy} disabled={rows.length === 0}>Copy list</button>
        {copied && <span role="status" className="quiet">{copied}</span>}
      </div>
      {rows.length === 0 ? <p className="quiet">No completed customers match.</p> : (
        <div className="tablewrap" style={{ maxHeight: '45vh', overflow: 'auto' }}>
          <table className="table">
            <caption className="sr-only">Past customers to contact again</caption>
            <thead><tr><th scope="col">Customer</th><th scope="col">Last service</th><th scope="col">Last job</th><th scope="col" className="num">Revenue</th><th scope="col">Phone</th></tr></thead>
            <tbody>{rows.map(l => (
              <tr key={l.id}><th scope="row">{l.name || 'Unnamed'}</th><td>{l.service_requested || '-'}</td><td>{shortDay(jobDate(l))}</td>
                <td className="num">{typeof l.job_revenue === 'number' ? dollars(l.job_revenue) : '-'}</td><td>{isRealPhone(l.phone) ? l.phone : '-'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </details>
  );
}
