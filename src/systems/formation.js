import { FORMATION, HERO, PLATOONS } from '../config/balance.js';
import { LIMITS } from '../data/waves.js';

// Posti della folla attorno agli eroi (heroes: dx e dz di ognuno), in ordine di arrivo: prima il nucleo stretto
// (al massimo coreSize posti larghi coreHalfWidth), poi i lati. Ogni posto ha dx di lato e dz in avanti rispetto
// al punto guidato dallo swipe, già spostati a caso di poco, e il suo plotone (gruppi di PLATOONS.size posti
// consecutivi). I posti sono tanti quanti i soldati del tetto del livello. Restituisce anche il numero di plotoni
export function createFormation(rng, heroes) {
  const { spacing, jitter, heroGap, coreHalfWidth, coreSize, core, wings, frontBias, rows, columns } = FORMATION;
  const rowStep = (spacing * Math.sqrt(3)) / 2;
  const keepOut = HERO.size / 2 + PLATOONS.soldierSize / 2 + heroGap;
  const points = [];
  for (let row = -rows; row <= rows; row++) {
    const shift = Math.abs(row) % 2 === 1 ? spacing / 2 : 0;
    for (let column = -columns; column <= columns; column++) {
      const x = column * spacing + shift;
      const z = row * rowStep;
      if (heroes.some((hero) => Math.abs(x - hero.dx) < keepOut && Math.abs(z - hero.dz) < keepOut)) continue;
      points.push({ x, z });
    }
  }

  // Distanza "a ovale" dal punto guidato: con az più grande di ax l'ovale è lungo, con ax più grande è largo
  const ovalDistance = ({ x, z }, { ax, az }) => Math.hypot(x / ax, (z - frontBias) / az);
  const byOval = (shape) => (a, b) => ovalDistance(a, shape) - ovalDistance(b, shape);
  const total = LIMITS.maxArmy - 1;
  const nucleus = points.filter((point) => Math.abs(point.x) <= coreHalfWidth - jitter).sort(byOval(core));
  const chosen = nucleus.slice(0, Math.min(coreSize, total));
  const taken = new Set(chosen);
  const others = points.filter((point) => !taken.has(point)).sort(byOval(wings));
  chosen.push(...others.slice(0, total - chosen.length));

  const slots = chosen.map(({ x, z }, index) => ({
    dx: x + (rng.float() * 2 - 1) * jitter,
    dz: z + (rng.float() * 2 - 1) * jitter,
    platoon: Math.floor(index / PLATOONS.size),
    soldier: null,
  }));
  return { slots, platoonCount: Math.ceil(slots.length / PLATOONS.size) };
}
