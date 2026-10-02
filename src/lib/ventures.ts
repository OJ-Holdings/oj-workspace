// The three OJ businesses: names, copy, and which brand assets and theme each one uses.
// Colours live in src/styles/tokens.css under [data-venture]; nothing here invents data.
export const ventureIds = ['exterior', 'solutions', 'essentials'] as const;
export type VentureId = typeof ventureIds[number];

export type Venture = {
  id: VentureId;
  name: string;
  short: string;
  tagline: string;
  description: string;
  chips: string[];
  /** Square mark on a transparent background, for the rail, cards and headers. */
  mark: string;
  /** What has to be connected before this business shows live figures. */
  source: string;
};

export const ventures: Record<VentureId, Venture> = {
  exterior: {
    id: 'exterior', name: 'OJ Exterior Care', short: 'Exterior Care',
    tagline: 'Cleaner spaces. Brighter places.',
    description: 'Pressure washing for homes and businesses in Kenosha.',
    chips: ['Driveways', 'House wash', 'Commercial'],
    mark: '/brand/exterior-mark.png',
    source: 'the Exterior Care leads system',
  },
  solutions: {
    id: 'solutions', name: 'OJ Solutions', short: 'Solutions',
    tagline: 'AI receptionists that answer every call.',
    description: 'AI receptionists and automation for local businesses.',
    chips: ['AI receptionist', 'Automation', 'Setup and support'],
    mark: '/brand/solutions-mark.png',
    source: 'GoHighLevel',
  },
  essentials: {
    id: 'essentials', name: 'OJ Essentials', short: 'Essentials',
    tagline: 'Wellness, tested before listed.',
    description: 'A small, tested catalogue at ojessentials.store.',
    chips: ['Beauty', 'Wellness', 'Tech', 'Car and travel'],
    mark: '/brand/essentials-mark.png',
    source: 'Shopify',
  },
};

export const ventureList = ventureIds.map(id => ventures[id]);
export const isVenture = (value: string): value is VentureId => (ventureIds as readonly string[]).includes(value);
