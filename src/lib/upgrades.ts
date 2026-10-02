// The Exterior Care upgrade checklist: every real-world step the business can
// take, grouped by area, each unlocked by the steps it depends on. The list was
// written by the founders in the original Exterior Care app; what is ticked is
// stored in that system's settings, so both apps show the same progress.

export type Upgrade = { id: string; name: string; desc: string; cost: string | null; deps: string[] };
export type UpgradeGroup = { id: string; name: string; nodes: Upgrade[] };
export type Completed = Record<string, true>;

export const upgradeGroups: UpgradeGroup[] = [
  { id: 'equipment', name: "Pressure Washing Equipment", nodes: [
    { id: 'eq_safety', name: "Safety Gear", desc: "Gloves, goggles, rubber boots", cost: "$50-100", deps: [] },
    { id: 'eq_yamaha', name: "Yamaha 3200 PSI 3.4 GPM", desc: "Your main machine - gasser", cost: null, deps: ['eq_safety'] },
    { id: 'eq_hose100', name: "100ft Pressure Hose", desc: "Reaches any house on the block", cost: null, deps: ['eq_yamaha'] },
    { id: 'eq_ghose', name: "100ft Garden Hose", desc: "Water supply from any spigot", cost: null, deps: ['eq_safety'] },
    { id: 'eq_qc', name: "Quick Connects", desc: "Swap nozzles and hoses fast", cost: null, deps: ['eq_yamaha'] },
    { id: 'eq_ds', name: "Downstream Injector", desc: "Chem application via PW - your setup", cost: null, deps: ['eq_yamaha'] },
    { id: 'eq_nozzles', name: "Nozzle Set (5-pack)", desc: "0/15/25/40 degree + soap tip", cost: "$20-40", deps: ['eq_qc'] },
    { id: 'eq_sc12', name: "Surface Cleaner 12\"", desc: "Streak-free flat surface cleaning", cost: "$80-150", deps: ['eq_yamaha'] },
    { id: 'eq_turbo', name: "Turbo Nozzle", desc: "5x faster than standard 0 degree tip", cost: "$30-60", deps: ['eq_yamaha'] },
    { id: 'eq_gcwand', name: "Gutter Cleaning Wand", desc: "Curved wand - flush from ground", cost: "$40-80", deps: ['eq_yamaha'] },
    { id: 'eq_swpump', name: "12V Soft Wash Pump", desc: "Low-pressure chem application", cost: "$150-300", deps: ['eq_ds'] },
    { id: 'eq_sc20', name: "Surface Cleaner 20\"", desc: "Double coverage per pass", cost: "$200-400", deps: ['eq_sc12'] },
    { id: 'eq_xjet', name: "X-Jet / Proportioner", desc: "Apply chem from the ground safely", cost: "$80-130", deps: ['eq_ds'] },
    { id: 'eq_swtank', name: "Soft Wash Tank (65 gal)", desc: "Dedicated SH + surfactant mix tank", cost: "$200-350", deps: ['eq_swpump'] },
    { id: 'eq_buftank', name: "Buffer Tank (100 gal)", desc: "Never lose flow on weak spigots", cost: "$150-250", deps: ['eq_ghose'] },
    { id: 'eq_bv', name: "Ball Valve Kit", desc: "Control flow without killing pump", cost: "$30-60", deps: ['eq_qc'] },
    { id: 'eq_4k', name: "4000+ PSI Commercial", desc: "Handles the heaviest jobs", cost: "$800-2,000", deps: ['eq_sc20'] },
    { id: 'eq_hw', name: "Hot Water Unit", desc: "Grease, oil, heavy-duty commercial", cost: "$2,000-5,000", deps: ['eq_4k'] },
    { id: 'eq_skid', name: "Skid Mount System", desc: "PW mounted in truck bed - pro setup", cost: "$500-1,500", deps: ['eq_buftank', 'eq_4k'] },
    { id: 'eq_reel', name: "Hose Reel (motorized)", desc: "Auto-retract - saves 10 min/job", cost: "$200-500", deps: ['eq_hose100'] },
  ] },
  { id: 'windows', name: "Window Cleaning", nodes: [
    { id: 'win_basic', name: "Squeegee Starter Kit", desc: "Ettore/Unger - 12\" & 18\"", cost: "$40-80", deps: [] },
    { id: 'win_scrub', name: "Window Scrubber Set", desc: "Sleeve + handle combo", cost: "$30-60", deps: ['win_basic'] },
    { id: 'win_ladder', name: "Extension Ladder 24ft", desc: "Reach 2nd story safely", cost: "$200-350", deps: ['win_basic'] },
    { id: 'win_belt', name: "Tool Belt / Pouch", desc: "Squeegee, scraper, towels on hip", cost: "$40-80", deps: ['win_scrub'] },
    { id: 'win_pole30', name: "Telescoping Pole 30ft", desc: "Ground-level 3-story reach", cost: "$80-150", deps: ['win_scrub'] },
    { id: 'win_di', name: "DI Tank (Deionized Water)", desc: "Spot-free window rinse", cost: "$150-300", deps: ['win_belt'] },
    { id: 'win_wfp', name: "Water-Fed Pole System", desc: "Pure water, no streaks, no ladder", cost: "$400-900", deps: ['win_pole30', 'win_di'] },
    { id: 'win_rodi', name: "RO/DI System", desc: "Produce your own pure water", cost: "$300-600", deps: ['win_di'] },
    { id: 'win_backpack', name: "Backpack DI System", desc: "Mobile pure water - no hose needed", cost: "$500-1,000", deps: ['win_wfp', 'win_rodi'] },
  ] },
  { id: 'fleet', name: "Fleet & Transport", nodes: [
    { id: 'fl_civic', name: "Jacob's Honda Civic", desc: "The OG crew cab - she works", cost: null, deps: [] },
    { id: 'fl_rack', name: "Roof Rack / Cargo Carrier", desc: "Haul poles and ladders on top", cost: "$80-200", deps: ['fl_civic'] },
    { id: 'fl_hitch', name: "Hitch Receiver", desc: "Tow a trailer from any vehicle", cost: "$100-300", deps: ['fl_civic'] },
    { id: 'fl_trailer', name: "Open Utility Trailer", desc: "Haul all your gear at once", cost: "$1,000-2,500", deps: ['fl_hitch'] },
    { id: 'fl_truck', name: "Dedicated Work Truck", desc: "F-150 / Ram 1500 - go pro", cost: "$15,000-35,000", deps: ['fl_civic'] },
    { id: 'fl_magnets', name: "Magnetic Truck Decals", desc: "Brand it when working, remove it off", cost: "$80-150", deps: ['fl_truck'] },
    { id: 'fl_enc', name: "Enclosed Trailer", desc: "Weatherproof, lockable, brandable", cost: "$3,000-8,000", deps: ['fl_trailer'] },
    { id: 'fl_van', name: "Cargo Van", desc: "All gear loaded - mobile ops base", cost: "$20,000-40,000", deps: ['fl_truck'] },
    { id: 'fl_wrap', name: "Full Vehicle Wrap", desc: "Rolling billboard - free ads 24/7", cost: "$2,500-5,000", deps: ['fl_magnets'] },
    { id: 'fl_truck2', name: "Second Work Truck", desc: "Two crews running the same day", cost: "$15,000+", deps: ['fl_wrap', 'fl_enc'] },
  ] },
  { id: 'branding', name: "Branding & Identity", nodes: [
    { id: 'brand_name', name: "Business Name", desc: "OJ Exterior Care - locked in", cost: null, deps: [] },
    { id: 'brand_logo', name: "Logo Design", desc: "Professional mark - done right", cost: null, deps: ['brand_name'] },
    { id: 'brand_polo', name: "Embroidered Polos", desc: "Polyester - logo stitched in", cost: null, deps: ['brand_logo'] },
    { id: 'brand_shirts', name: "Orange Work Shirts", desc: "Daily driver - you have these", cost: null, deps: ['brand_logo'] },
    { id: 'brand_cards', name: "Business Cards", desc: "Leave one at every job", cost: "$30-80", deps: ['brand_logo'] },
    { id: 'brand_hats', name: "Branded Hats & Caps", desc: "Free walking ads on your heads", cost: "$80-150", deps: ['brand_shirts'] },
    { id: 'brand_jacket', name: "Winter Work Jackets", desc: "Branded - work year-round, look pro", cost: "$150-300", deps: ['brand_shirts'] },
    { id: 'brand_boots', name: "Work Boots (Steel Toe)", desc: "Safety + look professional on site", cost: "$100-200", deps: ['brand_shirts'] },
    { id: 'brand_decals', name: "Truck / Trailer Decals", desc: "Vinyl logo on every vehicle", cost: "$80-200", deps: ['brand_cards', 'fl_truck'] },
    { id: 'brand_guide', name: "Brand Style Guide", desc: "Colors, fonts, rules locked in", cost: "$200-500", deps: ['brand_logo', 'brand_cards'] },
    { id: 'brand_merch', name: "Customer Merch", desc: "Hats/shirts to gift loyal customers", cost: "$300-600", deps: ['brand_guide'] },
  ] },
  { id: 'business', name: "Business & Legal", nodes: [
    { id: 'biz_op', name: "Operating Business", desc: "OJ Exterior Care is live", cost: null, deps: [] },
    { id: 'biz_ein', name: "EIN (Tax ID)", desc: "Federal ID - file with IRS, free", cost: "Free", deps: ['biz_op'] },
    { id: 'biz_bank', name: "Business Bank Account", desc: "Separate biz $ from personal $", cost: "Free", deps: ['biz_op'] },
    { id: 'biz_llc', name: "LLC Formation", desc: "Legal protection + credibility", cost: "$150-500", deps: ['biz_ein'] },
    { id: 'biz_cc', name: "Business Credit Card", desc: "Build credit + earn on supplies", cost: "Free", deps: ['biz_bank'] },
    { id: 'biz_acct', name: "Accounting Software", desc: "QuickBooks or Wave - know your #s", cost: "$0-30/mo", deps: ['biz_bank'] },
    { id: 'biz_license', name: "Local Business License", desc: "City/county required in some areas", cost: "$50-300/yr", deps: ['biz_llc'] },
    { id: 'biz_ins', name: "General Liability Ins.", desc: "Required by most customers", cost: "$800-2,000/yr", deps: ['biz_llc'] },
    { id: 'biz_contract', name: "Service Contracts", desc: "Legal template - cover every job", cost: "$200-400", deps: ['biz_llc'] },
    { id: 'biz_invoice', name: "Online Invoicing", desc: "Stripe, Square, or HoneyBook", cost: "$0-40/mo", deps: ['biz_cc'] },
    { id: 'biz_cpa', name: "Hire a CPA", desc: "Tax pro - pays for itself every year", cost: "$500-2,000/yr", deps: ['biz_acct'] },
    { id: 'biz_wc', name: "Workers' Comp", desc: "Required once you hire help", cost: "$1,000-3,000/yr", deps: ['biz_ins'] },
    { id: 'biz_cauto', name: "Commercial Auto Ins.", desc: "Cover the truck for business use", cost: "$1,200-2,500/yr", deps: ['biz_ins'] },
    { id: 'biz_comm', name: "Commercial Ins. (High-Rise)", desc: "Multi-story & commercial work", cost: "$2,000-5,000/yr", deps: ['biz_ins'] },
    { id: 'biz_loc', name: "Business Line of Credit", desc: "Fund equipment without using cash", cost: "Setup only", deps: ['biz_cc', 'biz_ins'] },
  ] },
  { id: 'marketing', name: "Marketing & Growth", nodes: [
    { id: 'mkt_wom', name: "Word of Mouth", desc: "Your rep does the work", cost: null, deps: [] },
    { id: 'mkt_gbp', name: "Google Business Profile", desc: "Show up on Google Maps", cost: "Free", deps: ['mkt_wom'] },
    { id: 'mkt_social', name: "Social Media Profiles", desc: "FB + IG + Nextdoor set up", cost: "Free", deps: ['mkt_wom'] },
    { id: 'mkt_hangers', name: "Door Hangers (500)", desc: "Hit targeted neighborhoods hard", cost: "$100-250", deps: ['mkt_wom'] },
    { id: 'mkt_rev10', name: "10 Google Reviews", desc: "First milestone - builds trust fast", cost: "Time", deps: ['mkt_gbp'] },
    { id: 'mkt_ig', name: "Before/After Content", desc: "IG + FB - converts like crazy", cost: "Time", deps: ['mkt_social'] },
    { id: 'mkt_signs', name: "Yard Signs (50)", desc: "One at every single job site", cost: "$150-300", deps: ['mkt_hangers'] },
    { id: 'mkt_referral', name: "Referral Program", desc: "$20 off for sending us a customer", cost: "Margin", deps: ['mkt_wom'] },
    { id: 'mkt_rev25', name: "25 Google Reviews", desc: "Trust threshold - leads convert", cost: "Time", deps: ['mkt_rev10'] },
    { id: 'mkt_photos', name: "Pro Photos / Portfolio", desc: "Professional before/after shots", cost: "$200-500", deps: ['mkt_ig'] },
    { id: 'mkt_web', name: "Professional Website", desc: "Quote forms + full portfolio", cost: "$500-2,000", deps: ['mkt_signs'] },
    { id: 'mkt_email', name: "Email Newsletter", desc: "Keep past customers coming back", cost: "$0-20/mo", deps: ['mkt_referral'] },
    { id: 'mkt_rev100', name: "100 Google Reviews", desc: "Dominant local presence - locked", cost: "Time", deps: ['mkt_rev25'] },
    { id: 'mkt_tiktok', name: "TikTok / Reels Strategy", desc: "Viral before/after = free leads", cost: "Time", deps: ['mkt_photos'] },
    { id: 'mkt_ads', name: "Google / FB Ads", desc: "Pay-per-click lead machine", cost: "$500-2,000/mo", deps: ['mkt_web', 'mkt_rev25'] },
    { id: 'mkt_seo', name: "Local SEO", desc: "Rank #1 in Kenosha on Google", cost: "$300-800/mo", deps: ['mkt_web'] },
  ] },
  { id: 'services', name: "Services Offered", nodes: [
    { id: 'svc_pw', name: "Pressure Washing", desc: "Your bread and butter", cost: null, deps: [] },
    { id: 'svc_drive', name: "Driveway Cleaning", desc: "Most common residential job", cost: null, deps: ['svc_pw'] },
    { id: 'svc_house', name: "House Washing", desc: "Full exterior soft wash", cost: null, deps: ['svc_pw'] },
    { id: 'svc_deck', name: "Deck & Fence Washing", desc: "Wood, vinyl, composite surfaces", cost: null, deps: ['svc_pw'] },
    { id: 'svc_win', name: "Window Cleaning (Ext)", desc: "Exterior glass + screens", cost: null, deps: ['svc_pw', 'win_basic'] },
    { id: 'svc_pack', name: "Wash + Window Bundle", desc: "Upsell package - one trip, more $", cost: null, deps: ['svc_house', 'svc_win'] },
    { id: 'svc_gutter', name: "Gutter Cleaning", desc: "Flush, clear, bag - premium add-on", cost: null, deps: ['svc_house', 'eq_gcwand'] },
    { id: 'svc_roof', name: "Roof Washing", desc: "Soft wash - no-pressure, shingle safe", cost: null, deps: ['svc_house', 'eq_swpump'] },
    { id: 'svc_decks', name: "Deck Staining / Sealing", desc: "Add-on after deck wash - big ticket", cost: null, deps: ['svc_deck'] },
    { id: 'svc_seal', name: "Concrete Sealing", desc: "Upsell on every driveway job", cost: "$100-300 supplies", deps: ['svc_drive'] },
    { id: 'svc_winfull', name: "Full Window Cleaning", desc: "Inside & out - premium price", cost: null, deps: ['svc_gutter', 'win_di'] },
    { id: 'svc_gbright', name: "Gutter Brightening", desc: "Tiger stripes gone - huge upsell", cost: null, deps: ['svc_gutter', 'eq_ds'] },
    { id: 'svc_rust', name: "Rust / Stain Removal", desc: "Oxalic acid specialty - premium rate", cost: null, deps: ['svc_drive'] },
    { id: 'svc_lights', name: "Holiday Light Install", desc: "Seasonal off-season revenue", cost: null, deps: ['svc_house'] },
    { id: 'svc_gg', name: "Gutter Guard Install", desc: "Recurring revenue product", cost: null, deps: ['svc_winfull'] },
    { id: 'svc_comm', name: "Commercial Accounts", desc: "Recurring B2B contracts", cost: null, deps: ['svc_house', 'biz_ins'] },
    { id: 'svc_fleet', name: "Fleet Washing", desc: "Clean commercial vehicles - contracts", cost: null, deps: ['svc_comm'] },
    { id: 'svc_hoa', name: "HOA / Community Contracts", desc: "Whole neighborhood - one deal", cost: null, deps: ['svc_comm'] },
  ] },
  { id: 'team', name: "Team & People", nodes: [
    { id: 'team_oscar', name: "Oscar (Co-Owner / Op)", desc: "OG operator - day one", cost: null, deps: [] },
    { id: 'team_jacob', name: "Jacob (Co-Owner / Op)", desc: "OG operator - day one", cost: null, deps: [] },
    { id: 'team_uniforms', name: "Full Uniform Policy", desc: "Same look, every crew member", cost: "$300-600", deps: ['team_oscar'] },
    { id: 'team_comm', name: "Team Comms System", desc: "GroupMe or Voxer for the crew", cost: "Free", deps: ['team_jacob'] },
    { id: 'team_sops', name: "SOPs / Training Docs", desc: "How every job gets done, in writing", cost: "Time", deps: ['team_jacob'] },
    { id: 'team_pt1', name: "First Part-Time Hire", desc: "Occasional helper - doubles output", cost: "$15-18/hr", deps: ['team_uniforms', 'biz_wc'] },
    { id: 'team_sched', name: "Scheduling Software", desc: "Jobber or ServiceTitan - dispatch", cost: "$49-99/mo", deps: ['team_comm'] },
    { id: 'team_bg', name: "Background Check Process", desc: "Screen every hire - protect brand", cost: "$20-50/hire", deps: ['team_sops'] },
    { id: 'team_emp1', name: "First Full-Time Hire", desc: "Runs jobs without you", cost: "$15-22/hr", deps: ['team_pt1'] },
    { id: 'team_phone', name: "Business Phone Line", desc: "Dedicated number - forward to phone", cost: "$10-30/mo", deps: ['team_sched'] },
    { id: 'team_hand', name: "Employee Handbook", desc: "Rules, expectations, HR baseline", cost: "Time", deps: ['team_bg'] },
    { id: 'team_lead', name: "Crew Leader", desc: "Promoted from within - you step back", cost: "+$3-5/hr", deps: ['team_emp1', 'team_sops'] },
    { id: 'team_emp2', name: "Second Full-Time Hire", desc: "Two trucks running the same day", cost: "$15-22/hr", deps: ['team_lead'] },
    { id: 'team_admin', name: "Admin / Office Help", desc: "Handles calls, scheduling, billing", cost: "$16-22/hr", deps: ['team_lead'] },
  ] },
];

const all = upgradeGroups.flatMap(g => g.nodes);
export const upgradeCount = all.length;

/** Done, ready to do (everything it depends on is done), or locked. */
export function upgradeStatus(completed: Completed): Record<string, 'done' | 'ready' | 'locked'> {
  return Object.fromEntries(all.map(n => [n.id, completed[n.id] ? 'done' : n.deps.every(d => completed[d]) ? 'ready' : 'locked']));
}

/** Ticks an upgrade, or unticks it together with everything that depended on it. Returns the new list and how many were removed. */
export function toggleUpgrade(completed: Completed, id: string): { next: Completed; removed: string[] } {
  if (!completed[id]) return { next: { ...completed, [id]: true }, removed: [] };
  const next = { ...completed }, removed: string[] = [];
  const drop = (target: string) => {
    if (!next[target]) return;
    delete next[target]; removed.push(target);
    for (const n of all) if (n.deps.includes(target)) drop(n.id);
  };
  drop(id);
  return { next, removed };
}

export const tier = (done: number) => { const pct = (done / upgradeCount) * 100; return pct >= 90 ? 'Legendary' : pct >= 70 ? 'Elite' : pct >= 50 ? 'Advanced' : pct >= 25 ? 'Rising' : 'Rookie'; };
