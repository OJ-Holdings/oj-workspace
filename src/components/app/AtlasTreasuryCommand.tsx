'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, ArrowRight, Banknote, ClipboardCheck, FileWarning, Plus, TrendingUp } from 'lucide-react';
import type { Dashboard } from '@/lib/dashboard';
import type { VentureId } from '@/lib/ventures';
import { ventures } from '@/lib/ventures';
import { treasurySnapshot } from '@/lib/atlas-treasury';

type Props = {
  data: Pick<Dashboard, 'finance' | 'reporting' | 'mercury'>;
  month: string;
  scope: readonly VentureId[];
  owner: boolean;
  readOnly: boolean;
  base: string;
  onExpense: () => void;
  onIncome: () => void;
};
const cash = (n: number | null) => n === null ? 'Not verified' :
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const change = (now: number | null, before: number | null) =>
  now === null || before === null ? null : Math.round((now - before) * 100) / 100;
export function AtlasTreasuryCommand({data, month, scope, owner, readOnly, base, onExpense, onIncome}: Props) {
  const [pane, setPane] = useState<'spend'|'venture'>('spend');
  const view = useMemo(() => treasurySnapshot(data, month, scope, owner), [data,month,scope,owner]);
  const inflowChange = change(view.inflow,view.priorInflow);
  const outflowChange = change(view.outflow,view.priorOutflow);
  const label = month.replace('-', ' / ');
  const expenses = view.expenseGroups.slice(0,6);
  const income = view.revenueGroups.slice(0,4);
  const bankLabel = view.bank.state === 'restricted' ? 'Restricted' : view.bank.amount === null ? 'Unverified' : cash(view.bank.amount);

  return <section className="atlas-treasury" aria-label="ATLAS Treasury Command">
    <header className="atlas-treasury-top">
      <div>
        <h2>This month: {label}</h2>
        <p>Recorded entries only.</p>
      </div>
      {!readOnly && <div className="atlas-treasury-actions">
        <button type="button" className="primary" onClick={onExpense}><Plus size={15} aria-hidden="true"/> Record expense</button>
        <button type="button" className="secondary" onClick={onIncome}><Plus size={15} aria-hidden="true"/> Record income</button>
      </div>}
    </header>
    <div className="atlas-treasury-values" aria-label="Recorded financial amounts">
      <div className="atlas-treasury-value">
        <span><ArrowDownRight size={16} aria-hidden="true"/> Recorded money in</span>
        <strong>{view.inflow === null ? 'Not recorded' : cash(view.inflow)}</strong>
        <small>{inflowChange === null ? 'No prior month to compare' : `${inflowChange >= 0 ? '+' : ''}${cash(inflowChange)} vs prior month`}</small>
      </div>
      <div className="atlas-treasury-value">
        <span><ArrowUpRight size={16} aria-hidden="true"/> Recorded money out</span>
        <strong>{view.outflow === null ? 'Not recorded' : cash(view.outflow)}</strong>
        <small>{outflowChange === null ? 'Prior-period comparison unavailable' : `${outflowChange >= 0 ? '+' : ''}${cash(outflowChange)} vs prior month`}</small>
      </div>
      <div className="atlas-treasury-value">
        <span><TrendingUp size={16} aria-hidden="true"/> Recorded difference</span>
        <strong>{view.difference === null ? 'Incomplete' : cash(view.difference)}</strong>
        <small>Recorded in minus recorded out</small>
      </div>
      <div className="atlas-treasury-value" data-bank-state={view.bank.state}>
        <span><Banknote size={16} aria-hidden="true"/> Linked Mercury cash</span>
        <strong>{bankLabel}</strong>
        <small>{view.bank.state==='restricted' ? 'Available only to an authorized owner' : view.bank.detail}</small>
      </div>
    </div>
    <div className="atlas-treasury-deck">
      <section className="atlas-treasury-panel atlas-treasury-analysis">
        <header className="atlas-treasury-panel-title">
          <div><small>FINANCIAL STRUCTURE</small><h2>Where the money goes</h2></div>
          <div role="group" className="atlas-treasury-tabs" aria-label="Financial breakdown">
            <button type="button" aria-pressed={pane==='spend'} onClick={()=>setPane('spend')}>Expense drivers</button>
            <button type="button" aria-pressed={pane==='venture'} onClick={()=>setPane('venture')}>By venture</button>
          </div>
        </header>
        {pane === 'spend' ? <>
          {expenses.length ? <div className="atlas-treasury-expense-bars">
            {expenses.map(item=><div className="atlas-treasury-breakdown" key={item.label}>
              <div><span>{item.label}</span><strong>{cash(item.amount)}</strong></div>
              <div className="atlas-treasury-bar" aria-label={`${item.label}: ${cash(item.amount)}, ${Math.round(item.share*100)} percent of recorded category spending`} role="img">
                <span style={{width: `${item.share*100}%`}} />
              </div>
            </div>)}
          </div> : <div className="atlas-treasury-empty"><p><b>No expenses recorded for this month.</b> Record one to see where the money goes.</p></div>}
          {!!income.length && <details className="atlas-treasury-details"><summary>See sources of recorded inflows</summary><ul>{income.map(item=><li key={item.label}><span>{item.label}</span><strong>{cash(item.amount)}</strong></li>)}</ul></details>}
        </> : <div className="atlas-treasury-ventures">
          {view.ventures.map(venture=><div key={venture.id}>
            <b>{ventures[venture.id].name}</b>
            <span>In {venture.inflow===null?'—':cash(venture.inflow)} · Out {venture.outflow===null?'—':cash(venture.outflow)}</span>
            <strong>{venture.difference===null?'Incomplete':`Difference ${cash(venture.difference)}`}</strong>
          </div>)}
          <p>These are operating-brand breakdowns. They are not separate legal-entity financial statements or consolidated accounting.</p>
        </div>}
      </section>
      <section className="atlas-treasury-panel atlas-treasury-alerts">
        <header className="atlas-treasury-panel-title">
          <div><small>BOOKKEEPING EXCEPTIONS</small><h2>What needs attention</h2></div>
          <ClipboardCheck size={22} aria-hidden="true"/>
        </header>
        {view.attention.length ? <ol>
          {view.attention.slice(0,5).map(issue=><li key={issue.id}>
            <FileWarning size={16} aria-hidden="true"/>
            <div><b>{issue.title}</b><p>{issue.detail}</p>
              {(issue.id==='job-costs'||issue.id==='job-payments') && <Link href={`${base}/b/exterior/jobs`}>Review completed jobs <ArrowRight size={13}/></Link>}
            </div>
          </li>)}
        </ol> : <p className="atlas-treasury-empty">No exceptions detected in loaded sources. This is not proof that the books are closed or reconciled.</p>}
        <p className="atlas-treasury-caption">Actual AR/AP, tax obligations, invoice aging and period close remain unavailable until the accounting records exist.</p>
      </section>
    </div>
    <p className="atlas-treasury-truth" role="note">{view.coverageNote} {view.bank.checkedAt && owner ? `Bank snapshot checked ${new Date(view.bank.checkedAt).toLocaleString('en-US')}.` : ''}</p>
  </section>;
}
