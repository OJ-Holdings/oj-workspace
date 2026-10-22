/**
 * Fleet Command v1: intentionally browser-local until the reviewed Supabase
 * migration/backup gate is cleared. NO VINs, license plates, contact details
 * or payment credentials are stored or requested by this schema.
 */
export const FLEET_FORMAT = 'oj-fleet-local-v1';
export const FLEET_VERSION = 1;
export const FLEET_MAX_FILE_BYTES = 256 * 1024;

export const fleetKinds = ['vehicle','pressure-washer','water-system','rig-component','tool','other'] as const;
export type FleetKind = (typeof fleetKinds)[number];
export const fleetStatuses = ['ready','needs-service','out-of-service'] as const;
export type FleetStatus = (typeof fleetStatuses)[number];
export const readingUnits = ['none','miles','hours'] as const;
export type ReadingUnit = (typeof readingUnits)[number];

export type FleetAsset = {
  id: string; name: string; kind: FleetKind; model: string;
  status: FleetStatus; unit: ReadingUnit; reading: number | null;
  nextServiceReading: number | null; nextServiceDate: string | null;
  notes: string; createdAt: string;
};
export type FleetMaintenance = {
  id: string; assetId: string; date: string;
  summary: string; cost: number | null; reading: number | null;
};
export const readinessItems = [
  { id: 'engine', label: 'Engine, pump and connections inspected' },
  { id: 'hose', label: 'Pressure and water hoses, couplers and reels checked' },
  { id: 'water', label: 'Water supply and access plan confirmed' },
  { id: 'chem', label: 'Chemicals secured and labelled; SDS available' },
  { id: 'ppe', label: 'PPE and eye/respiratory protection assessed' },
  { id: 'contain', label: 'Runoff, nearby plants and property protection planned' },
  { id: 'ladders', label: 'Access equipment and fall hazards reviewed' },
  { id: 'traffic', label: 'Traffic, parking and work-area controls reviewed' },
  { id: 'contact', label: 'Job instructions and customer access checked' },
  { id: 'photos', label: 'Camera, documentation and before photos ready' },
] as const;
export type ReadinessKey = (typeof readinessItems)[number]['id'];

export type RigLoadout = {
  vehiclePayloadLb: number | null;
  emptyRigLb: number;
  waterGallons: number;
  otherCargoLb: number;
  peopleLb: number;
};
export type FleetWorkbook = {
  format: typeof FLEET_FORMAT;
  version: typeof FLEET_VERSION;
  organizationId: string;
  assets: FleetAsset[];
  maintenance: FleetMaintenance[];
  readiness: { checked: ReadinessKey[]; updatedAt: string | null };
  rig: RigLoadout;
};
export type AssetHealth = 'out-of-service'|'needs-service'|'due'|'due-soon'|'monitor'|'ready';

export const freshRig = (): RigLoadout => ({
  vehiclePayloadLb: null, emptyRigLb: 0, waterGallons: 0, otherCargoLb: 0, peopleLb: 0,
});
export function emptyFleet(org: string): FleetWorkbook {
  return {
    format: FLEET_FORMAT, version: FLEET_VERSION, organizationId: org,
    assets: [], maintenance: [], readiness: { checked: [], updatedAt: null }, rig: freshRig(),
  };
}

const requireRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(field + ' must be an object.');
  return value as Record<string, unknown>;
};
function textField(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(field + ' must be text (max ' + max + ' characters).');
  }
  return value;
}
function finite(value: unknown, field: string, max: number, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(field + ' must be a valid nonnegative number.');
  }
  return value;
}
const enumField = <T extends string>(value: unknown, allowed: readonly T[], field: string): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error('Invalid ' + field + '.');
  return value as T;
};
export function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
}
function optionalDay(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (!validDay(value)) throw new Error('Invalid ' + field + '.');
  return value;
}
function utcTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length > 40 ||
      !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid ' + field + '.');
  }
  return new Date(value).toISOString();
}
const validId = (value: unknown, field: string): string => {
  const id = textField(value, field, 80, true);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid ' + field + '.');
  return id;
};
function assetFrom(raw: unknown): FleetAsset {
  const x = requireRecord(raw, 'Asset');
  const unit = enumField(x.unit, readingUnits, 'meter unit');
  const reading = finite(x.reading, 'meter reading', 10_000_000, true);
  const serviceReading = finite(x.nextServiceReading, 'service meter threshold', 10_000_000, true);
  if (unit === 'none' && (reading !== null || serviceReading !== null)) {
    throw new Error('Meter values require miles or hours.');
  }
  return {
    id: validId(x.id, 'asset ID'),
    name: textField(x.name, 'Asset name', 120, true),
    kind: enumField(x.kind, fleetKinds, 'asset category'),
    model: textField(x.model, 'Model', 150),
    status: enumField(x.status, fleetStatuses, 'asset status'),
    unit, reading, nextServiceReading: serviceReading,
    nextServiceDate: optionalDay(x.nextServiceDate, 'service date'),
    notes: textField(x.notes, 'Asset notes', 2000),
    createdAt: utcTime(x.createdAt, 'asset timestamp'),
  };
}
function serviceFrom(raw: unknown): FleetMaintenance {
  const x = requireRecord(raw, 'Maintenance event');
  if (!validDay(x.date)) throw new Error('Invalid maintenance date.');
  return {
    id: validId(x.id, 'maintenance ID'),
    assetId: validId(x.assetId, 'maintenance asset'),
    date: x.date,
    summary: textField(x.summary, 'Service summary', 350, true),
    cost: finite(x.cost, 'Service cost', 1_000_000, true),
    reading: finite(x.reading, 'Service reading', 10_000_000, true),
  };
}
function rigFrom(raw: unknown): RigLoadout {
  const x = requireRecord(raw, 'Rig plan');
  return {
    vehiclePayloadLb: finite(x.vehiclePayloadLb, 'Vehicle payload capacity', 100_000, true),
    emptyRigLb: finite(x.emptyRigLb, 'Rig dry weight', 100_000) as number,
    waterGallons: finite(x.waterGallons, 'Water gallons', 10_000) as number,
    otherCargoLb: finite(x.otherCargoLb, 'Other cargo weight', 100_000) as number,
    peopleLb: finite(x.peopleLb, 'People weight', 100_000) as number,
  };
}
function validateOrg(org: string): string {
  if (typeof org !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(org)) throw new Error('Invalid company context.');
  return org;
}

/** Whitelist every field and refuse oversized or cross-company data. */
export function validateFleet(raw: unknown, org: string): FleetWorkbook {
  validateOrg(org);
  const x = requireRecord(raw, 'Fleet workbook');
  if (x.format !== FLEET_FORMAT || x.version !== FLEET_VERSION) {
    throw new Error('Unsupported Fleet Command file version.');
  }
  if (x.organizationId !== org) throw new Error('This fleet file belongs to another company workspace.');
  if (!Array.isArray(x.assets) || x.assets.length > 100) throw new Error('Too many asset records.');
  if (!Array.isArray(x.maintenance) || x.maintenance.length > 500) throw new Error('Too many maintenance records.');
  const assets = x.assets.map(assetFrom);
  const maintenance = x.maintenance.map(serviceFrom);
  const ids = new Set(assets.map(a => a.id));
  if (ids.size !== assets.length) throw new Error('Duplicate fleet asset IDs.');
  if (new Set(maintenance.map(e => e.id)).size !== maintenance.length) throw new Error('Duplicate maintenance IDs.');
  if (maintenance.some(e => !ids.has(e.assetId))) throw new Error('Maintenance refers to an unknown asset.');
  const readiness = requireRecord(x.readiness, 'Readiness list');
  if (!Array.isArray(readiness.checked) || readiness.checked.length > readinessItems.length ||
      readiness.checked.some(k => !readinessItems.some(item => item.id === k)) ||
      new Set(readiness.checked).size !== readiness.checked.length) {
    throw new Error('Invalid readiness checklist.');
  }
  const updatedAt = readiness.updatedAt === null ? null : utcTime(readiness.updatedAt, 'checklist date');
  return {
    format: FLEET_FORMAT, version: FLEET_VERSION, organizationId: org,
    assets, maintenance,
    readiness: { checked: [...readiness.checked] as ReadinessKey[], updatedAt },
    rig: rigFrom(x.rig),
  };
}
export function encodeFleet(data: FleetWorkbook, org: string): string {
  const validated = validateFleet(data, org);
  const json = JSON.stringify(validated, null, 2);
  if (new TextEncoder().encode(json).byteLength > FLEET_MAX_FILE_BYTES) throw new Error('Fleet file exceeds 256 KB.');
  return json;
}
export function decodeFleet(json: string, org: string): FleetWorkbook {
  if (typeof json !== 'string' || json.length > FLEET_MAX_FILE_BYTES || !json.trim()) {
    throw new Error('Fleet file empty or exceeds the 256 KB limit.');
  }
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Not a valid Fleet Command JSON file.'); }
  return validateFleet(raw, org);
}

/** Approximation only: water = 8.34 lb/US gallon, before container weights. */
export function calculateRigLoad(data: RigLoadout) {
  const rig = rigFrom(data);
  const waterLb = Math.round(rig.waterGallons * 8.34 * 100) / 100;
  const totalLb = Math.round((rig.emptyRigLb + waterLb + rig.otherCargoLb + rig.peopleLb) * 100) / 100;
  const remainingLb = rig.vehiclePayloadLb === null ? null :
    Math.round((rig.vehiclePayloadLb - totalLb) * 100) / 100;
  return {
    waterLb, totalLb, remainingLb,
    exceedsEnteredPayload: remainingLb !== null && remainingLb < 0,
    hasVehicleCapacity: rig.vehiclePayloadLb !== null,
  };
}

export function assetHealth(asset: FleetAsset, today: string): AssetHealth {
  if (asset.status === 'out-of-service') return 'out-of-service';
  if (asset.status === 'needs-service') return 'needs-service';
  if (!validDay(today)) return 'monitor';
  if ((asset.nextServiceDate && asset.nextServiceDate <= today) ||
      (asset.reading !== null && asset.nextServiceReading !== null &&
       asset.reading >= asset.nextServiceReading)) return 'due';
  const next14 = new Date(today + 'T00:00:00Z');
  next14.setUTCDate(next14.getUTCDate() + 14);
  if ((asset.nextServiceDate && asset.nextServiceDate <= next14.toISOString().slice(0,10)) ||
      (asset.reading !== null && asset.nextServiceReading !== null &&
       asset.nextServiceReading - asset.reading <= (asset.unit === 'miles' ? 500 : 10))) {
    return 'due-soon';
  }
  if (!asset.nextServiceDate && asset.nextServiceReading === null) return 'monitor';
  return 'ready';
}
