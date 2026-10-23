// The four OJ operating brands: names, assets and theme metadata.
// Colours live in src/styles/tokens.css under [data-venture]; nothing here invents data.
export const ventureIds = ['exterior', 'solutions', 'essentials', 'content'] as const;
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
  content: {
    id: 'content', name: 'Oscar Jacob', short: 'Oscar Jacob',
    tagline: 'Make something worth watching.',
    description: 'Original video, editorial production, and audience building.',
    chips: ['Ideas', 'Filming', 'Editing', 'Publishing'],
    mark: '/brand/content-mark.svg',
    source: 'the Oscar Jacob production records',
  },
};

/** Release gate: the live DB has no 'content' schema yet. Flip only in a post-migration release. */
export const contentPersistenceEnabled = false;

/** Discover all four brands without changing which ventures server actions
 * accept for writes. The fourth brand links to a labeled fictional preview
 * until its shared persistence is independently enabled. */
export const discoverableVentures=ventureIds.map(id=>ventures[id]);

/** Visible and writable operating brands while the fourth business is a preview. */
export const ventureList = ventureIds.filter(id => id !== 'content' || contentPersistenceEnabled).map(id => ventures[id]);
export const isVenture = (value: string): value is VentureId =>
  (ventureIds as readonly string[]).includes(value) && (value !== 'content' || contentPersistenceEnabled);
