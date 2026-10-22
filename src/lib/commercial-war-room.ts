import {
  calculateEstimate, type EstimateInput, type EstimateResult,
} from './commercial-estimate';

export const warRoomChecks = [
  'Scope, pane counts and conditions verified at every building',
  'Access strategy assessed by qualified personnel',
  'Operator training, rental, permits and insurance confirmed',
  'Crew-hours and all direct costs reviewed',
  'Exclusions, schedule, site permission and client terms documented',
] as const;
export type BidFinding = {
  id: string;
  severity: 'critical' | 'review';
  subject: string;
  issue: string;
  nextAction: string;
};
export type PricingCase = {
  key: 'competitive' | 'target' | 'protected';
  label: string;
  targetMargin: number;
  estimatedDirectCost: number;
  price: number;
  estimatedContribution: number;
  description: string;
};
export type SiteExposure = {
  id: string; name: string; panes: number;
  crewHours: number; labor: number; equipment: number;
  directSubtotal: number;
};
export type BidWarRoom = {
  baseline: EstimateResult;
  pricing: PricingCase[];
  stress: {
    laborMultiplier: number;
    materialsMultiplier: number;
    mobilizationMultiplier: number;
    extraLiftDaysPerLiftSite: number;
    stressedCost: number;
    priceToHoldTargetMargin: number;
    contributionAtCurrentPrice: number;
    marginAtCurrentPrice: number | null;
    costIncrease: number;
    requiresHigherPrice: boolean;
  };
  siteExposure: SiteExposure[];
  findings: BidFinding[];
  reviewedCount: number;
  reviewCount: number;
  status: 'scope-incomplete' | 'awaiting-founder-review';
};

const money = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const boundedMargin = (x: number) => Math.max(0, Math.min(90, Number.isFinite(x) ? x : 0));
const dollars = (x: number) => x.toLocaleString('en-US', {
  style: 'currency', currency: 'USD',
});

export function buildBidWarRoom(name: string, input: EstimateInput, review: boolean[]): BidWarRoom {
  const baseline = calculateEstimate(input);
  const margin = boundedMargin(input.margin);
  const pricing: PricingCase[] = [
    {key:'competitive', label:'Competitive', targetMargin:boundedMargin(margin-7),description:'Lower contribution-margin scenario, not a market-rate recommendation.'},
    {key:'target', label:'Target', targetMargin:margin,description:'Current entered target contribution margin.'},
    {key:'protected', label:'Protected', targetMargin:boundedMargin(margin+7),description:'Higher contribution-margin scenario to compare price sensitivity.'},
  ].map(candidate => {
    const price = money(baseline.totalCost / (1-candidate.targetMargin/100));
    return {...candidate, estimatedDirectCost:baseline.totalCost, price,
      estimatedContribution:money(price-baseline.totalCost)};
  });

  const extraLiftDaysPerLiftSite = 1;
  const laborMultiplier = 1.25;
  const materialsMultiplier = 1.15;
  const mobilizationMultiplier = 1.20;
  // Stress test: +25% entered paid crew-hours, +1 lift day per lift-access
  // building, +15% materials, +20% mobilization. Remaining cost inputs fixed.
  const stressedLabor = baseline.labor * laborMultiplier;
  const liftSites = input.sites.filter(s=>s.access==='lift').length;
  const stressedEquipment = baseline.equipment + liftSites * extraLiftDaysPerLiftSite * input.liftDaily;
  const stressedBase = money(stressedLabor + stressedEquipment +
    baseline.materials*materialsMultiplier + baseline.mobilization*mobilizationMultiplier + baseline.other);
  const contingency = Number.isFinite(input.contingency) ? Math.max(0,Math.min(100,input.contingency)) : 0;
  const stressedCost = money(stressedBase * (1+contingency/100));
  const contributionAtCurrentPrice = money(baseline.suggestedPrice-stressedCost);
  const marginAtCurrentPrice = baseline.suggestedPrice > 0 ?
    money(contributionAtCurrentPrice / baseline.suggestedPrice * 100) : null;
  const priceToHoldTargetMargin = money(stressedCost / (1-margin/100));

  const siteExposure = input.sites.slice(0,12).map(s=>{
    const labor = money(s.crewHours*input.laborRate);
    const equipment = money(s.liftDays*input.liftDaily);
    return {
      id:s.id, name:s.name||'Unnamed building',
      panes:s.panes, crewHours:s.crewHours, labor, equipment,
      directSubtotal:money(labor+equipment),
    };
  });

  const findings: BidFinding[]=[];
  const flag=(id:string,severity:BidFinding['severity'],subject:string,issue:string,nextAction:string)=>{
    findings.push({id,severity,subject,issue,nextAction});
  };
  if(!name.trim()||name.trim()==='New commercial opportunity') {
    flag('project-reference','review','Project identity','Project reference is still a generic working title.',
      'Enter a specific internal property or portfolio reference.');
  }
  input.sites.slice(0,12).forEach((s,i)=>{
    const subject=s.name.trim()||'Building '+(i+1);
    if(!s.location.trim())flag('location:'+s.id,'review',subject,'Site location has not been recorded.',
      'Confirm location and access logistics during the survey.');
    if(!Number.isFinite(s.panes)||s.panes<=0)flag('panes:'+s.id,'critical',subject,
      'No positive pane count recorded.','Count glass units and verify the scope.');
    if(!Number.isFinite(s.crewHours)||s.crewHours<=0)flag('labor:'+s.id,'critical',subject,
      'Paid crew-hours are missing or zero.','Estimate paid person-hours, not only elapsed clock hours.');
    if(s.access==='review')flag('access:'+s.id,'critical',subject,'Access method remains unassessed.',
      'Obtain a qualified access assessment before proposing high-access work.');
    if(s.access==='lift'&&s.liftDays<=0)flag('lift:'+s.id,'critical',subject,
      'Lift access selected but zero rental days entered.',
      'Confirm rental duration, operator qualification and lift access costs.');
    if(!s.notes.trim())flag('notes:'+s.id,'review',subject,'No scope or site-condition notes documented.',
      'Record surfaces, exclusions, obstacles, water source and scheduling constraints.');
  });
  if(baseline.totalCost<=0)flag('cost-base','critical','Cost model','Estimated total direct cost is zero.',
    'Reconcile labor, equipment, travel, materials and other direct costs.');
  const safeReview = warRoomChecks.map((_,i)=>review[i]===true);
  safeReview.forEach((done,i)=>{
    if(!done)flag('review:'+i,'review','Pre-proposal review',warRoomChecks[i]+' is not checked.',
      'Complete and document this check; a checkbox alone is not an approval or safety certification.');
  });
  // We cannot prove insurance validity, permits or actual customer acceptance.
  const status=findings.length?'scope-incomplete':'awaiting-founder-review';

  return {
    baseline, pricing,
    stress: {
      laborMultiplier,materialsMultiplier,mobilizationMultiplier,extraLiftDaysPerLiftSite,
      stressedCost,priceToHoldTargetMargin,contributionAtCurrentPrice,marginAtCurrentPrice,
      costIncrease:money(stressedCost-baseline.totalCost),
      requiresHigherPrice:priceToHoldTargetMargin>baseline.suggestedPrice,
    },
    siteExposure,findings,reviewedCount:safeReview.filter(Boolean).length,
    reviewCount:warRoomChecks.length,status,
  };
}

/** Explicitly INTERNAL file. Not suitable as a customer-facing offer. */
export function warRoomBrief(name: string, input: EstimateInput, review: boolean[]): string {
  const result=buildBidWarRoom(name,input,review);
  return [
    'OJ EXTERIOR CARE / COMMERCIAL BID WAR ROOM',
    'INTERNAL REVIEW ONLY — NOT A CUSTOMER QUOTE, AGREEMENT, APPROVAL, OR INVOICE',
    'Opportunity: '+(name||'Unnamed project'),
    'Scope: '+result.baseline.sites+' buildings, '+result.baseline.panes+' entered panes, '+result.baseline.crewHours+' paid crew-hours',
    '',
    'PRICING CASES (ESTIMATED COSTS, NO MARKET-RATE CLAIM)',
    ...result.pricing.map(p=>p.label+': '+dollars(p.price)+' | target contribution margin '+p.targetMargin+'% | estimated contribution '+dollars(p.estimatedContribution)),
    '',
    'COST-STRESS TEST',
    'Assumptions: +25% paid crew-hours, +1 rental day per lift-access building, +15% materials, +20% travel/mobilization.',
    'Baseline direct cost incl. contingency: '+dollars(result.baseline.totalCost),
    'Stressed direct cost incl. contingency: '+dollars(result.stress.stressedCost),
    'Estimated contribution at original suggested price: '+dollars(result.stress.contributionAtCurrentPrice),
    'Estimated margin at original suggested price: '+(result.stress.marginAtCurrentPrice===null?'undefined (price zero)':result.stress.marginAtCurrentPrice+'%'),
    'Estimated price to hold the same target contribution margin: '+dollars(result.stress.priceToHoldTargetMargin),
    '',
    'SITE LABOR AND EQUIPMENT ONLY — NO SHARED COST ALLOCATION',
    ...result.siteExposure.map(s=>s.name+': '+s.panes+' panes | '+s.crewHours+' paid crew-hours | labor '+dollars(s.labor)+' | rental '+dollars(s.equipment)),
    '',
    'INSPECTION AND PRE-PROPOSAL EXCEPTIONS',
    ...(result.findings.length?result.findings.map(f=>'['+f.severity.toUpperCase()+'] '+f.subject+': '+f.issue+' NEXT: '+f.nextAction):['No incomplete scope fields detected by these limited checks. Requires independent founder and qualified safety review.']),
    '',
    'This is scenario analysis, not actual cash, an external offer, booked work or verified profit.',
    'Costs depend entirely on entered assumptions. No approval, signature or customer delivery has occurred.',
  ].join('\n');
}
