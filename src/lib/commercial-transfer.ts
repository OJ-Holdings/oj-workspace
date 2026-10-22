import type { EstimateInput, Site } from './commercial-estimate';

/**
 * Portable internal estimate interchange format.
 * No customer contacts, emails, booking, billing or outside communications
 * are created by importing a file. The export can contain sensitive addresses
 * and planning costs: store or transmit it privately.
 */
export const commercialTransferFormat = 'oj-exterior-commercial-estimate';
export const commercialTransferVersion = 1;
export const commercialTransferMaxChars = 262144;

export type CommercialTransfer = {
  format: typeof commercialTransferFormat;
  version: typeof commercialTransferVersion;
  organization_id: string;
  exported_at: string;
  name: string;
  input: EstimateInput;
  review: boolean[];
};

const object = (v: unknown, label: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(label + ' must be an object.');
  return v as Record<string, unknown>;
};
const string = (v: unknown, label: string, max: number, required = false): string => {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) {
    throw new Error(label + ' must be a valid text value (maximum ' + max + ' characters).');
  }
  return v;
};
const number = (v: unknown, label: string, max: number, whole = false): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max ||
    (whole && !Number.isInteger(v))) {
    throw new Error(label + ' must be a ' + (whole ? 'whole ' : '') + 'number between 0 and ' + max + '.');
  }
  return v;
};
const accesses = ['review', 'ground', 'water-fed', 'lift'] as const;

function siteFromRecord(v: unknown, index: number): Site {
  const s = object(v, 'Building ' + (index + 1));
  if (typeof s.access !== 'string' || !(accesses as readonly string[]).includes(s.access)) {
    throw new Error('Building ' + (index + 1) + ' has an invalid access method.');
  }
  return {
    id: string(s.id, 'Building identifier', 90, true),
    name: string(s.name, 'Building name', 140),
    location: string(s.location, 'Building location', 300),
    levels: number(s.levels, 'Floors', 100, true),
    panes: number(s.panes, 'Window panes', 100000, true),
    crewHours: number(s.crewHours, 'Crew-hours', 10000),
    liftDays: number(s.liftDays, 'Lift-days', 365),
    access: s.access as Site['access'],
    notes: string(s.notes, 'Building notes', 5000),
  };
}
function inputFromRecord(v: unknown): EstimateInput {
  const data = object(v, 'Estimate');
  if (!Array.isArray(data.sites) || data.sites.length < 1 || data.sites.length > 12) {
    throw new Error('The estimate must contain between 1 and 12 buildings.');
  }
  const sites = data.sites.map((row, index) => siteFromRecord(row, index));
  if (new Set(sites.map(s => s.id)).size !== sites.length) {
    throw new Error('The imported buildings contain duplicate identifiers.');
  }
  return {
    sites,
    laborRate: number(data.laborRate, 'Hourly labor rate', 10000),
    liftDaily: number(data.liftDaily, 'Daily lift rental', 100000),
    materials: number(data.materials, 'Materials cost', 1000000),
    mobilization: number(data.mobilization, 'Travel and mobilization cost', 1000000),
    other: number(data.other, 'Other costs', 1000000),
    contingency: number(data.contingency, 'Contingency percent', 100),
    margin: number(data.margin, 'Target contribution margin', 90),
    deposit: number(data.deposit, 'Proposed deposit percent', 100),
  };
}

function transferFromRecord(value: unknown, expectedOrganization: string): CommercialTransfer {
  const d = object(value, 'Shared estimate');
  if (!expectedOrganization || typeof expectedOrganization !== 'string' || expectedOrganization.length > 128) {
    throw new Error('Invalid destination organization.');
  }
  if (d.format !== commercialTransferFormat || d.version !== commercialTransferVersion) {
    throw new Error('Unsupported estimate file format or version.');
  }
  if (d.organization_id !== expectedOrganization) {
    throw new Error('This estimate file belongs to a different OJ workspace organization.');
  }
  const exportedAt = string(d.exported_at, 'Export timestamp', 40, true);
  if (!Number.isFinite(Date.parse(exportedAt)) || !/^\d{4}-\d\d-\d\dT/.test(exportedAt)) {
    throw new Error('Invalid export timestamp.');
  }
  if (!Array.isArray(d.review) || d.review.length !== 5 || d.review.some(v => typeof v !== 'boolean')) {
    throw new Error('Estimate review checklist is invalid.');
  }
  return {
    format: commercialTransferFormat,
    version: commercialTransferVersion,
    organization_id: expectedOrganization,
    exported_at: exportedAt,
    name: string(d.name, 'Project reference', 140, true),
    input: inputFromRecord(d.input),
    review: [...d.review],
  };
}

/** Exports a fully validated snapshot; never saves or transmits it. */
export function exportCommercialEstimate(
  organization: string, name: string, input: EstimateInput, review: boolean[],
  exportedAt = new Date(),
): string {
  const candidate = {
    format: commercialTransferFormat, version: commercialTransferVersion,
    organization_id: organization, exported_at: exportedAt.toISOString(),
    name, input, review,
  };
  const validated = transferFromRecord(candidate, organization);
  const json = JSON.stringify(validated, null, 2);
  if (json.length > commercialTransferMaxChars) throw new Error('The estimate file is too large.');
  return json;
}

/** Parses only the whitelisted fields. Never blindly spreads untrusted JSON. */
export function importCommercialEstimate(json: string, organization: string): CommercialTransfer {
  if (typeof json !== 'string' || json.length < 10 || json.length > commercialTransferMaxChars) {
    throw new Error('The estimate file is empty or larger than the 256 KB limit.');
  }
  let data: unknown;
  try { data = JSON.parse(json); }
  catch { throw new Error('The estimate file is not valid JSON.'); }
  return transferFromRecord(data, organization);
}
