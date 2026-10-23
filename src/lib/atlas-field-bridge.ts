import { calculateEstimate, type EstimateInput } from './commercial-estimate';
import {
  commercialTransferFormat, commercialTransferMaxChars, commercialTransferVersion,
  importCommercialEstimate, type CommercialTransfer,
} from './commercial-transfer';
import {
  assetHealth, calculateRigLoad, decodeFleet, readinessItems, validDay,
  type FleetWorkbook,
} from './fleet-command';

/**
 * ATLAS Field Bridge v1. Read-only projection of TWO existing per-browser
 * workbooks. Nothing here writes storage, creates provider records, certifies
 * equipment, or makes a quote/booking/dispatch decision.
 */
export type CommercialPlan = Pick<CommercialTransfer, 'name'|'input'|'review'>;
export type FieldFinding = { id: string; severity: 'attention'|'review'|'unknown'; text: string };
export type FieldBridgeReport = {
  commercial: {
    name: string; buildings: number; crewHours: number; liftDays: number;
    accessToSurvey: number; rentalScopeMissing: number;
    reviewChecked: number; reviewTotal: number;
  } | null;
  fleet: {
    assets: number; attention: number; approaching: number; unverified: number;
    checklistChecked: number; checklistTotal: number; checklistDate: string | null;
    checklistFresh: boolean; payloadRemainingLb: number | null;
    enteredPayloadExceeded: boolean;
  } | null;
  findings: FieldFinding[];
};

/** Legacy Commercial Desk persists {name,input,review} without a format tag.
 * Revalidate its exact approved fields through the canonical transfer parser.
 * The organization-scoped browser storage key is the isolation boundary; this
 * parser also refuses an explicitly conflicting organization field.
 */
export function parseLocalCommercialDraft(json: string, org: string): CommercialPlan {
  if (!json || json.length > commercialTransferMaxChars) throw new Error('Commercial draft is empty or too large.');
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Commercial draft is not valid JSON.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Commercial draft must be an object.');
  const obj = raw as Record<string, unknown>;
  if (obj.organization_id !== undefined && obj.organization_id !== org) {
    throw new Error('Commercial draft belongs to another organization.');
  }
  const validated = importCommercialEstimate(JSON.stringify({
    format: commercialTransferFormat, version: commercialTransferVersion,
    organization_id: org, exported_at: '2026-01-01T00:00:00.000Z',
    name: obj.name, input: obj.input, review: obj.review,
  }), org);
  return { name: validated.name, input: validated.input, review: validated.review };
}

/** Use the original Fleet Command validator; never trust arbitrary local JSON. */
export function parseLocalFleetDraft(json: string, org: string): FleetWorkbook {
  return decodeFleet(json, org);
}

export function fieldBridgeReport(
  commercial: CommercialPlan | null,
  fleet: FleetWorkbook | null,
  day: string,
): FieldBridgeReport {
  const findings: FieldFinding[] = [];
  const validToday = validDay(day);
  const estimate = commercial ? calculateEstimate(commercial.input) : null;
  const commercialSummary = commercial && estimate ? {
    name: commercial.name,
    buildings: estimate.sites,
    crewHours: estimate.crewHours,
    liftDays: estimate.liftDays,
    accessToSurvey: commercial.input.sites.filter(s => s.access === 'review').length,
    rentalScopeMissing: commercial.input.sites.filter(s => s.access === 'lift' && s.liftDays === 0).length,
    reviewChecked: commercial.review.filter(Boolean).length,
    reviewTotal: commercial.review.length,
  } : null;
  if (!commercialSummary) {
    findings.push({ id: 'no-project', severity: 'unknown', text: 'No validated commercial draft is available on this device.' });
  } else {
    if (commercialSummary.accessToSurvey) findings.push({
      id: 'site-access', severity: 'attention',
      text: commercialSummary.accessToSurvey + ' building(s) still have access marked for site assessment.',
    });
    if (commercialSummary.rentalScopeMissing) findings.push({
      id: 'rental-days', severity: 'attention',
      text: commercialSummary.rentalScopeMissing + ' lift-access building(s) have zero entered rental days.',
    });
    if (commercialSummary.liftDays > 0) findings.push({
      id: 'lift-vendor', severity: 'review',
      text: 'Lift rental days are planning assumptions. Fleet inventory does not confirm a rental, operator qualification, insurance, or site permit.',
    });
    if (commercialSummary.reviewChecked < commercialSummary.reviewTotal) findings.push({
      id: 'bid-review', severity: 'review',
      text: 'Internal pre-proposal review is incomplete; checklist completion would not constitute founder approval.',
    });
  }
  let fleetSummary: FieldBridgeReport['fleet'] = null;
  if (!fleet) {
    findings.push({ id: 'no-fleet', severity: 'unknown', text: 'No validated Fleet Command workbook is available on this device.' });
  } else {
    const conditions = fleet.assets.map(asset => assetHealth(asset, validToday ? day : ''));
    const load = calculateRigLoad(fleet.rig);
    const checklistDate = fleet.readiness.updatedAt?.slice(0, 10) ?? null;
    const checklistFresh = validToday && checklistDate === day;
    fleetSummary = {
      assets: fleet.assets.length,
      attention: conditions.filter(x => x === 'due' || x === 'needs-service' || x === 'out-of-service').length,
      approaching: conditions.filter(x => x === 'due-soon').length,
      unverified: conditions.filter(x => x === 'monitor').length,
      checklistChecked: checklistFresh ? fleet.readiness.checked.length : 0,
      checklistTotal: readinessItems.length,
      checklistDate, checklistFresh,
      payloadRemainingLb: load.remainingLb,
      enteredPayloadExceeded: load.exceedsEnteredPayload,
    };
    if (fleetSummary.attention) findings.push({
      id: 'service', severity: 'attention',
      text: fleetSummary.attention + ' recorded equipment asset(s) require service attention; review individual records before assigning equipment.',
    });
    if (fleetSummary.unverified) findings.push({
      id: 'unverified', severity: 'review',
      text: fleetSummary.unverified + ' asset(s) have insufficient service/status evidence to establish readiness.',
    });
    if (!checklistFresh) findings.push({
      id: 'old-checklist', severity: 'attention',
      text: 'The pre-departure checklist has not been checked today. A previous job’s checks do not carry over.',
    });
    else if (fleetSummary.checklistChecked < fleetSummary.checklistTotal) findings.push({
      id: 'checklist', severity: 'review',
      text: 'Today’s locally recorded pre-departure checklist is incomplete.',
    });
    if (load.exceedsEnteredPayload) findings.push({
      id: 'payload', severity: 'attention',
      text: 'Entered rig load exceeds the entered vehicle payload capacity.',
    });
    else if (!load.hasVehicleCapacity) findings.push({
      id: 'capacity-unknown', severity: 'unknown',
      text: 'Vehicle payload capacity was not supplied. The rig load cannot be cleared.',
    });
  }
  return { commercial: commercialSummary, fleet: fleetSummary, findings };
}
