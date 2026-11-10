// Fictional teams, cars and drivers.
export const TEAMS = [
  { code: 'CMT', name: 'Comet Racing', number: 7, livery: { base: '#d6202e', accent: '#ffffff', stripe: '#141414' }, helmet: '#f6d21c' },
  { code: 'VTX', name: 'Vortex GP', number: 22, livery: { base: '#0e2a47', accent: '#2ad4f0', stripe: '#0a0a0a' }, helmet: '#2ad4f0', tcam: 0x111111 },
  { code: 'TMP', name: 'Tempest F1', number: 1, livery: { base: '#121212', accent: '#e8b13c', stripe: '#e8b13c' }, helmet: '#e8b13c' },
  { code: 'NVA', name: 'Nova Motorsport', number: 63, livery: { base: '#c9ced3', accent: '#00a19b', stripe: '#1a1d21' }, helmet: '#ffffff' },
  { code: 'BLZ', name: 'Blaze Racing', number: 4, livery: { base: '#ff7a00', accent: '#1d4fd8', stripe: '#0d1a3a' }, helmet: '#ff7a00' },
  { code: 'EMR', name: 'Emerald Team', number: 14, livery: { base: '#05603f', accent: '#c7f400', stripe: '#033322' }, helmet: '#c7f400' },
  { code: 'VLT', name: 'Volt Speed', number: 31, livery: { base: '#f4f6fb', accent: '#1557ff', stripe: '#e3262e' }, helmet: '#1557ff' },
];

// Player cars (index into TEAMS for the livery).
export const CARS = [
  { name: 'Comet SF-1', team: 0, vmax: 87, grip: 1.0, price: 0, blurb: 'Balanced and friendly. Great for learning the lines.' },
  { name: 'Vortex V-22', team: 1, vmax: 89.5, grip: 1.03, price: 500, blurb: 'More downforce for faster corners.' },
  { name: 'Tempest T-1', team: 2, vmax: 92, grip: 1.06, price: 1200, blurb: 'Championship-winning pace on every track.' },
];

export const DRIVERS = [
  { name: 'Ava Blaze', code: 'AVA' }, { name: 'Leo Storm', code: 'STM' }, { name: 'Mia Volt', code: 'MIA' },
  { name: 'Kai Rocket', code: 'KAI' }, { name: 'Zara Turbo', code: 'ZAR' }, { name: 'Jonah Swift', code: 'JON' },
];

export const DIFFICULTY = {
  rookie: { label: 'Rookie', pace: 0.86, vmax: 82.5, desc: 'Gentle rivals' },
  pro: { label: 'Pro', pace: 0.93, vmax: 86.5, desc: 'A real fight' },
  champion: { label: 'Champion', pace: 0.985, vmax: 90.5, desc: 'Flat out' },
};

export const POINTS_FOR_POSITION = [500, 400, 320, 250, 200, 150];
