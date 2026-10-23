'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, ClipboardCopy, RefreshCw, ShieldCheck } from 'lucide-react';
import type { FleetWorkbook } from '@/lib/fleet-command';
import {
  fieldBridgeReport, internalFieldBrief, parseLocalCommercialDraft, parseLocalFleetDraft,
  type CommercialPlan,
} from '@/lib/atlas-field-bridge';

type Source<T> = { state: 'loading'|'missing'|'loaded'|'invalid'; data: T | null; error: string };
type Props = {
  base: string; organizationId: string; mode: 'live'|'preview';
  view: 'commercial'|'fleet'; commercial?: CommercialPlan; fleet?: FleetWorkbook;
  disabled?: boolean;
};
const blank = <T,>(): Source<T> => ({ state: 'loading', data: null, error: '' });
function chicagoDay(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (part: string) => parts.find(p => p.type === part)?.value ?? '';
  return value('year') + '-' + value('month') + '-' + value('day');
}

/**
 * Cross-module field context. Reads ONLY another module's org-keyed, existing
 * localStorage draft. Does not synchronize across devices or write either source.
 */
export function AtlasFieldBridge({
  base, organizationId, mode, view, commercial, fleet, disabled = false,
}: Props) {
  const [source, setSource] = useState<Source<CommercialPlan | FleetWorkbook>>(blank);
  const [day, setDay] = useState('');
  const [receipt, setReceipt] = useState('');

  useEffect(() => {
    setReceipt('');
    if (mode === 'preview' || disabled) {
      setSource({ state: 'missing', data: null, error: '' });
      return;
    }
    const key = view === 'commercial'
      ? 'oj-fleet-command-v1:' + organizationId
      : 'oj-commercial-estimate-v2:' + organizationId;
    const refresh = () => {
      setDay(chicagoDay());
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) { setSource({ state: 'missing', data: null, error: '' }); return; }
        const loaded = view === 'commercial'
          ? parseLocalFleetDraft(raw, organizationId)
          : parseLocalCommercialDraft(raw, organizationId);
        setSource({ state: 'loaded', data: loaded, error: '' });
      } catch (error) {
        setSource({
          state: 'invalid', data: null,
          error: error instanceof Error ? error.message : 'Local workbook could not be read.',
        });
      }
    };
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, [organizationId, mode, view, disabled]);

  const otherFleet = view === 'commercial' && source.state === 'loaded'
    ? source.data as FleetWorkbook : null;
  const otherCommercial = view === 'fleet' && source.state === 'loaded'
    ? source.data as CommercialPlan : null;
  const report = useMemo(() => fieldBridgeReport(
    view === 'commercial' ? (commercial ?? null) : otherCommercial,
    view === 'fleet' ? (fleet ?? null) : otherFleet,
    day,
  ), [view, commercial, fleet, otherCommercial, otherFleet, day]);
  const destination = view === 'commercial' ? base + '/tools/fleet' : base + '/b/exterior/commercial';
  const destinationLabel = view === 'commercial' ? 'Open Fleet Command' : 'Open Commercial Desk';
  const canCopy = mode === 'live' && !disabled && day !== '';

  async function copyBrief() {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(internalFieldBrief(report, day));
      setReceipt('Internal field brief copied. No customer, provider or teammate was contacted.');
    } catch {
      setReceipt('Clipboard unavailable. Review the source workbooks directly.');
    }
  }

  return <section className="atlas-field-bridge" aria-label="Commercial and fleet coordination">
    <header className="atlas-field-bridge-head">
      <div>
        <p>ATLAS / CROSS-DIVISION FIELD OPERATIONS</p>
        <h3>Commercial ↔ Fleet coordination</h3>
        <span>Read-only comparison of workbooks on this device. No background sync, assignments or automatic approvals.</span>
      </div>
      <Link href={destination}>{destinationLabel}<ArrowUpRight size={15}/></Link>
    </header>
    {mode === 'preview' || disabled
      ? <p className="atlas-field-bridge-note">{mode === 'preview'
        ? 'Preview does not inspect your private local workbooks.'
        : 'Cross-workbook inspection is unavailable for read-only Fleet Command roles.'}</p>
      : <>
        <div className="atlas-field-bridge-grid">
          <article><small>COMMERCIAL PROJECT</small>
            <strong>{report.commercial?.name ?? 'No verified local draft'}</strong>
            <p>{report.commercial
              ? report.commercial.buildings + ' buildings • ' + report.commercial.crewHours + ' paid crew-hours • ' + report.commercial.liftDays + ' planned lift-days'
              : 'Save a commercial draft in this browser to display its scope here.'}</p>
            <span>{view === 'commercial' ? 'Current editor state; may have unsaved changes' : 'Most recently saved local Commercial Desk draft'}</span>
          </article>
          <article><small>FLEET CONDITION</small>
            <strong>{report.fleet ? report.fleet.assets + ' entered assets' : 'No verified local inventory'}</strong>
            <p>{report.fleet
              ? report.fleet.attention + ' require attention • ' + report.fleet.approaching + ' approaching service • ' + report.fleet.unverified + ' uncertain'
              : 'Create or import a Fleet Command workbook on this device.'}</p>
            <span>{report.fleet
              ? report.fleet.checklistChecked + '/' + report.fleet.checklistTotal + ' departure items checked today; payload ' +
                (report.fleet.payloadRemainingLb === null ? 'unknown' : report.fleet.payloadRemainingLb + ' entered lb remaining')
              : 'Readiness has not been verified'}</span>
          </article>
        </div>
        {source.state === 'invalid' && <p className="atlas-field-bridge-error" role="alert"><AlertTriangle size={16}/> The other local workbook was rejected: {source.error}. Its original data was not modified.</p>}
        {source.state === 'loading' && <p className="atlas-field-bridge-note">Checking this device’s saved local workbook…</p>}
        <div className="atlas-field-bridge-findings">
          <h4><ShieldCheck size={16}/> Pre-dispatch exceptions <span>{report.findings.length} checks</span></h4>
          {report.findings.map(f => <p key={f.id} data-severity={f.severity}>
            <span>{f.severity === 'attention' ? 'Attention' : f.severity === 'unknown' ? 'Unknown' : 'Review'}</span>{f.text}
          </p>)}
          {report.findings.length === 0 && <p>No automated exceptions detected. Independent job-site, equipment, licensing and insurance checks remain required.</p>}
        </div>
        <footer>
          <span>Local-only evidence • not synchronized with Jacob • not authorization to quote or dispatch</span>
          <button type="button" onClick={() => void copyBrief()} disabled={!canCopy}><ClipboardCopy size={15}/> Copy internal field brief</button>
        </footer>
        {receipt && <p className="atlas-field-bridge-note" role="status">{receipt}</p>}
      </>}
  </section>;
}
