import { FORMATION, HERO, LANES, PLATOONS } from '../config/balance.js';

// Posti della folla attorno agli eroi (heroes: dx e dz di ognuno), in ordine di arrivo: dal più vicino al centro degli
// eroi, spostato un po' in avanti di frontBias (a fargli da scudo), al più lontano, così la folla cresce in cerchi
// uguali da tutte le parti e resta compatta. I posti partono da una griglia a nido d'ape (spacing tra due vicini) e
// ognuno è spostato a caso di al massimo jitter di lato e lungo la strada, perché nessuno stia in riga; restano fuori
// quelli dentro gli eroi (con heroGap di spazio), quelli più di back dietro il punto guidato, che uscirebbero dallo
// schermo, e quelli che farebbero la folla più larga di FORMATION.maxLanes corsie. shape: quanto conta la distanza di
// lato (ax) e lungo la strada (az) nel dire chi è più vicino. Ogni posto ha il suo numero d'ordine (index), dx di lato
// e dz in avanti rispetto al punto guidato dallo swipe, il suo plotone (gruppi di PLATOONS.size posti consecutivi) e i
// posti accanto nella griglia (neighbors, fino a sei). Restano solo i posti legati tra loro da vicini: uno chiuso tra
// gli eroi, da solo, non lo raggiungerebbe nessuna catena della folla. I posti sono molti più dei soldati del tetto:
// contro il bordo della strada quelli che ne uscirebbero si chiudono (open) e la folla prende i successivi. searched e
// previous servono a chi cerca una catena di posti (systems/army.js). Restituisce anche il numero di plotoni
export function createFormation(rng, heroes) {
  const { spacing, jitter, heroGap, shape, frontBias, back, rows, columns } = FORMATION;
  const rowStep = (spacing * Math.sqrt(3)) / 2;
  const keepOut = HERO.size / 2 + PLATOONS.soldierSize / 2 + heroGap;
  const centerX = heroes.reduce((sum, hero) => sum + hero.dx, 0) / heroes.length;
  const centerZ = heroes.reduce((sum, hero) => sum + hero.dz, 0) / heroes.length + frontBias;
  const halfWidth = ((LANES.fieldWidth / LANES.count) * FORMATION.maxLanes) / 2 - PLATOONS.soldierSize / 2;
  const points = [];
  for (let row = -rows; row <= rows; row++) {
    const shift = Math.abs(row) % 2 === 1 ? spacing / 2 : 0;
    for (let column = -columns; column <= columns; column++) {
      const x = column * spacing + shift + (rng.float() * 2 - 1) * jitter;
      const z = row * rowStep + (rng.float() * 2 - 1) * jitter;
      if (z < -back || Math.abs(x - centerX) > halfWidth) continue;
      if (heroes.some((hero) => Math.abs(x - hero.dx) < keepOut && Math.abs(z - hero.dz) < keepOut)) continue;
      points.push({ x, z, row, column });
    }
  }
  const distance = ({ x, z }) => Math.hypot((x - centerX) / shape.ax, (z - centerZ) / shape.az);
  points.sort((a, b) => distance(a) - distance(b));
  const all = points.map(({ x, z }) => ({
    index: 0,
    dx: x,
    dz: z,
    platoon: 0,
    soldier: null,
    open: true,
    neighbors: [],
    searched: 0,
    previous: null,
  }));
  linkNeighbors(points, all);
  const slots = largestGroup(all);
  slots.forEach((slot, index) => {
    slot.index = index;
    slot.platoon = Math.floor(index / PLATOONS.size);
  });
  return { slots, platoonCount: Math.ceil(slots.length / PLATOONS.size) };
}

// Vicini nella griglia a nido d'ape: due nella stessa riga e due in ognuna delle righe accanto, spostate di mezzo
// passo (verso destra quelle dispari)
function linkNeighbors(points, slots) {
  const key = (row, column) => `${row},${column}`;
  const byCell = new Map(points.map(({ row, column }, index) => [key(row, column), slots[index]]));
  points.forEach(({ row, column }, index) => {
    const side = Math.abs(row) % 2 === 1 ? 0 : -1;
    const cells = [
      [row, column - 1],
      [row, column + 1],
      [row - 1, column + side],
      [row - 1, column + side + 1],
      [row + 1, column + side],
      [row + 1, column + side + 1],
    ];
    for (const [r, c] of cells) {
      const neighbor = byCell.get(key(r, c));
      if (neighbor !== undefined) slots[index].neighbors.push(neighbor);
    }
  });
}

// Il gruppo più grande di posti legati tra loro da vicini, nell'ordine di prima
function largestGroup(slots) {
  const groupOf = new Map();
  const sizes = [];
  for (const start of slots) {
    if (groupOf.has(start)) continue;
    const queue = [start];
    groupOf.set(start, sizes.length);
    for (let head = 0; head < queue.length; head++) {
      for (const neighbor of queue[head].neighbors) {
        if (groupOf.has(neighbor)) continue;
        groupOf.set(neighbor, sizes.length);
        queue.push(neighbor);
      }
    }
    sizes.push(queue.length);
  }
  const largest = sizes.indexOf(Math.max(...sizes));
  return slots.filter((slot) => groupOf.get(slot) === largest);
}
