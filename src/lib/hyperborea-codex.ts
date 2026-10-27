import type { Camp } from './hyperborea';

/**
 * The Codex: the lore of Hyperborea. A chapter opens when the expedition reaches its camp.
 * Chapter VI is the founders' own sealed letter; it is never written here.
 */
export type Chapter = {
  id: string; numeral: string; title: string; unlock: Camp['id'] | 'beyond';
  sealed?: boolean; paragraphs: string[];
};

export const codex: readonly Chapter[] = [
  { id: 'prologue', numeral: 'Prologue', title: 'The North Wind', unlock: 'base', paragraphs: [
    'Below the mountain the wind never stops. It is the wind of ordinary life: wages, comfort, the slow drowning of men who never tried. Most are born in it and die in it and never learn there is anything above.',
    'The old Greeks said there was a land beyond it. Hyperborea, beyond the North Wind, where the sun does not set and Apollo spent his winters. Pindar wrote that neither ship nor road would ever bring you there. You had to climb.',
    'Two men stood at the foot of the mountain in October of 2026 with almost nothing. They had twenty years.',
  ] },
  { id: 'treeline', numeral: 'Chapter I', title: 'The Treeline', unlock: 'camp1', paragraphs: [
    'The first lesson of the mountain: no man carries everything himself. At the treeline the climbers learned to build others who could carry loads.',
    'The ones who refuse this lesson never leave the forest. They grow old among the trees, strong and busy and going nowhere.',
  ] },
  { id: 'gate', numeral: 'Chapter II', title: 'The Seven-Figure Gate', unlock: 'camp2', paragraphs: [
    'An old iron gate stands at four thousand metres. Carved above it: what you were is not what passes.',
    'The hustler stays below. Only the operator walks through. Behind the gate the air is thinner, and every mistake costs more than it did.',
  ] },
  { id: 'icewall', numeral: 'Chapter III', title: 'The Icewall', unlock: 'camp3', paragraphs: [
    'A sheer face of blue ice. Here the climbers stop climbing with their own hands and begin commanding the men above and below them.',
    'Founders who cannot let go of the rope freeze to the wall. Their bodies are still up there, and other expeditions climb past them.',
  ] },
  { id: 'col', numeral: 'Chapter IV', title: 'South Col', unlock: 'camp4', paragraphs: [
    'The last camp. Here the climbers stop only building and begin taking ground that others built.',
    'The wind at the Col can lift a man off his feet. Every expedition that reaches it asks the same question: is this enough? The ones who say yes go home. The ones who say no go higher.',
  ] },
  { id: 'deathzone', numeral: 'Chapter V', title: 'The Death Zone', unlock: 'deathzone', paragraphs: [
    'Above eight thousand metres the body begins to die. No one lives here. They only pass through.',
    'Partnerships break in the Death Zone. Men grow paranoid, greedy, exhausted. The mountain tests whether the bond between the two climbers is stronger than the mountain itself. Most ropes are cut here.',
  ] },
  { id: 'summit', numeral: 'Chapter VI', title: 'The Summit', unlock: 'summit', sealed: true, paragraphs: [
    'Written by Oscar and Jacob at base camp. Sealed until the summit, or until October 27, 2046, whichever comes first.',
  ] },
  { id: 'epilogue', numeral: 'Epilogue', title: 'Above the Sky', unlock: 'beyond', paragraphs: [
    'The sun of Hyperborea does not set. And from the summit the climbers finally see it: the sky goes higher than the mountain ever did.',
  ] },
];
