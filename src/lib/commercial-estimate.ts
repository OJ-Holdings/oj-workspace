/** Internal estimate only. Not a quote, invoice, contract, payment, or accounting result. */
export type Site = {
  id: string; name: string; location: string; levels: number;
  panes: number; crewHours: number; liftDays: number;
  access: 'review' | 'ground' | 'water-fed' | 'lift'; notes: string;
};
export type EstimateInput = {
  sites: Site[]; laborRate: number; liftDaily: number; materials: number;
  mobilization: number; other: number; contingency: number; margin: number; deposit: number;
};
export type EstimateResult = {
  sites: number; panes: number; floors: number; crewHours: number; liftDays: number;
  labor: number; equipment: number; materials: number; mobilization: number; other: number;
  baseCost: number; contingencyCost: number; totalCost: number;
  suggestedPrice: number; contribution: number; depositAmount: number; margin: number;
};
export const newSite = (id = 'building-1'): Site => ({
  id, name: 'Building 1', location: '', levels: 1, panes: 0,
  crewHours: 8, liftDays: 0, access: 'review', notes: '',
});
export const newEstimate = (): EstimateInput => ({
  sites: [newSite()], laborRate: 35, liftDaily: 350,
  materials: 0, mobilization: 0, other: 0,
  contingency: 15, margin: 30, deposit: 25,
});
const number = (n: number, cap = 1000000) => Number.isFinite(n) ? Math.min(cap, Math.max(0, n)) : 0;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function calculateEstimate(value: EstimateInput): EstimateResult {
  const sites = value.sites.slice(0, 12);
  const sum = (select: (s: Site) => number, cap: number) => sites.reduce((n,s) => n + number(select(s),cap),0);
  const crewHours = sum(s=>s.crewHours,10000);
  const liftDays = sum(s=>s.liftDays,365);
  const labor = round(crewHours * number(value.laborRate,10000));
  const equipment = round(liftDays * number(value.liftDaily,100000));
  const materials = round(number(value.materials));
  const mobilization = round(number(value.mobilization));
  const other = round(number(value.other));
  const baseCost = round(labor + equipment + materials + mobilization + other);
  const contingencyCost = round(baseCost * number(value.contingency,100)/100);
  const totalCost = round(baseCost + contingencyCost);
  const margin = number(value.margin,90);
  // Margin uses (price - cost) / price, not markup over cost.
  const suggestedPrice = round(totalCost / (1 - margin/100));
  return {
    sites:sites.length, panes:sum(s=>s.panes,100000), floors:sum(s=>s.levels,100),
    crewHours,liftDays,labor,equipment,materials,mobilization,other,
    baseCost,contingencyCost,totalCost,suggestedPrice,
    contribution:round(suggestedPrice-totalCost),
    depositAmount:round(suggestedPrice * number(value.deposit,100)/100),margin,
  };
}
export function brief(name: string, value: EstimateInput): string {
  const e=calculateEstimate(value);
  const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
  const lines=[
    'OJ EXTERIOR CARE / COMMERCIAL SCOPING',
    'Project: '+(name.trim()||'Untitled'),
    'STATUS: INTERNAL ESTIMATE ONLY. NOT A SENT QUOTE OR CONTRACT.',
    '',
    ...value.sites.slice(0,12).map((s,i)=>[
      String(i+1)+'. '+(s.name||'Building'),s.location||'Location unverified',
      String(s.levels)+' floors',String(s.panes)+' approximate panes',
      String(s.crewHours)+' combined paid crew-hours',
      s.access+' access',String(s.liftDays)+' lift-days',s.notes
    ].filter(Boolean).join(' | ')),
    '',
    'Direct labor: '+usd(e.labor),
    'Equipment: '+usd(e.equipment),
    'Materials: '+usd(e.materials),
    'Travel/mobilization: '+usd(e.mobilization),
    'Other: '+usd(e.other),
    'Contingency: '+usd(e.contingencyCost),
    'Cost including contingency: '+usd(e.totalCost),
    'Target contribution margin: '+String(e.margin)+'%',
    'INTERNAL SUGGESTED PRICE: '+usd(e.suggestedPrice),
    'Proposed deposit: '+usd(e.depositAmount),
    '',
    'Before proposal: verify scope and panes on site; insurance; lift training and access; surface conditions; hours, crew and rentals; weather; exclusions; sales tax; payment terms.',
    'Direct-cost contribution is not business net profit. Figures are estimates, not receivables or collected cash.',
  ];
  return lines.join('\n');
}
