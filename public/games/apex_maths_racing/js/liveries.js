// Unlockable liveries and paint finishes for the player's car.
import { TEAMS, CARS } from './data.js';

// unlock: { points } to buy, or an achievement { stat, n, text }
export const LIVERIES = [
  { id: 'factory', name: 'Factory', pattern: 'classic', colours: null, unlock: null, blurb: 'Your team\'s own colours.' },
  { id: 'twotone', name: 'Two-Tone', pattern: 'split', colours: ['#1d1d1f', '#ff2d55', '#ffffff'], unlock: { points: 200 }, blurb: 'Sharp diagonal split.' },
  { id: 'inferno', name: 'Inferno', pattern: 'flames', colours: ['#141414', '#ff5a00', '#ffd400'], unlock: { points: 350 }, blurb: 'Flames licking down the sidepods.' },
  { id: 'thunder', name: 'Thunderbolt', pattern: 'lightning', colours: ['#0b1d4a', '#ffe600', '#29c5ff'], unlock: { points: 450 }, blurb: 'Lightning bolts from nose to tail.' },
  { id: 'galaxy', name: 'Galaxy', pattern: 'galaxy', colours: ['#12052e', '#b44dff', '#33e1ff'], unlock: { points: 650 }, blurb: 'Stars, nebulas and deep space.' },
  { id: 'rainbow', name: 'Rainbow Rocket', pattern: 'rainbow', colours: ['#ffffff', '#ff3b3b', '#111111'], unlock: { points: 900 }, blurb: 'Every colour at 300 km/h.' },
  { id: 'chequered', name: 'Chequered', pattern: 'checker', colours: ['#f5f5f5', '#111111', '#e10600'], unlock: { stat: 'podiums', n: 1, text: 'Finish on the podium' }, blurb: 'Chequered flag fade.' },
  { id: 'camo', name: 'Stealth Camo', pattern: 'camo', colours: ['#3d4a3a', '#1e2420', '#6b7a5c'], unlock: { stat: 'races', n: 3, text: 'Finish 3 races' }, blurb: 'Hard to spot in your mirrors.' },
  { id: 'pixel', name: 'Pixel Pro', pattern: 'pixel', colours: ['#101828', '#22e07a', '#00b3ff'], unlock: { stat: 'correct', n: 5, text: 'Answer 5 pit questions right first time' }, blurb: 'Retro video-game blocks.' },
  { id: 'tiger', name: 'Tiger Claw', pattern: 'tiger', colours: ['#ff8a00', '#111111', '#ffffff'], unlock: { stat: 'wins', n: 1, text: 'Win a race' }, blurb: 'Fierce stripes for race winners.' },
  { id: 'neon', name: 'Neon Night', pattern: 'neon', colours: ['#07070c', '#00fff0', '#ff2bd6'], unlock: { stat: 'correct', n: 12, text: 'Answer 12 pit questions right first time' }, blurb: 'Glowing lines. Best in night races!' },
  { id: 'riviera', name: 'Riviera', pattern: 'riviera', colours: ['#d6202e', '#ffffff', '#c9a227'], unlock: { stat: 'monacoWin', n: 1, text: 'Win at Monaco' }, blurb: 'Monaco red and white with gold trim.' },
  { id: 'golden', name: 'Golden Champion', pattern: 'classic', colours: ['#c9a227', '#111111', '#fff1b3'], finish: 'chrome', unlock: { stat: 'championWin', n: 1, text: 'Win on Champion difficulty' }, blurb: 'Solid gold. Only for champions.' },
];

export const FINISHES = {
  gloss: { name: 'Gloss', price: 0 },
  matte: { name: 'Matte', price: 0 },
  satin: { name: 'Satin', price: 150 },
  pearl: { name: 'Pearl', price: 500 },
  chrome: { name: 'Chrome', price: 700 },
};

export function statValue(save, stat) {
  const v = save[stat];
  return typeof v === 'boolean' ? (v ? 1 : 0) : (v || 0);
}
export function isUnlocked(l, save) {
  if (!l.unlock) return true;
  if (save.liveries?.includes(l.id)) return true;
  if (l.unlock.stat) return statValue(save, l.unlock.stat) >= l.unlock.n;
  return false;
}
export function requirement(l, save) {
  if (!l.unlock) return 'Free';
  if (l.unlock.points) return `${l.unlock.points} PTS`;
  return `${l.unlock.text} (${Math.min(statValue(save, l.unlock.stat), l.unlock.n)}/${l.unlock.n})`;
}

// Default design state stored in the save.
export function defaultDesign() { return { id: 'factory', colours: null, finish: 'gloss', number: null }; }

// Build the team object used for the player's car from the save.
export function playerTeam(save) {
  const base = TEAMS[CARS[save.car].team];
  const d = save.design || defaultDesign();
  const l = LIVERIES.find((x) => x.id === d.id) || LIVERIES[0];
  const cols = d.colours || l.colours || [base.livery.base, base.livery.accent, base.livery.stripe];
  const finish = d.finish || l.finish || 'gloss';
  return {
    ...base,
    code: base.code,
    number: d.number || base.number,
    helmet: cols[1],
    livery: { base: cols[0], accent: cols[1], stripe: cols[2], pattern: l.pattern, finish },
  };
}
export function designColours(save) {
  const base = TEAMS[CARS[save.car].team];
  const d = save.design || defaultDesign();
  const l = LIVERIES.find((x) => x.id === d.id) || LIVERIES[0];
  return d.colours || l.colours || [base.livery.base, base.livery.accent, base.livery.stripe];
}
