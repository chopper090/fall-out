import { HERO, PLATOONS } from '../config/balance.js';

// Disposizione dei plotoni attorno all'eroe. Restituisce:
// slots, i posti dei soldati in ordine di arrivo (prima tutto il primo plotone, poi il secondo...),
// ognuno con dx di lato e dz in avanti rispetto all'eroe e l'indice del suo plotone;
// platoons, i blocchi con il loro lato (-1 sinistra, 1 destra, 0 al centro)
// e beside = true se stanno di fianco all'eroe, alla sua stessa altezza lungo la strada.
// Nel plotone si riempie prima la fila davanti, dal centro verso i lati
export function createFormation() {
  const { size, columns, maxPlatoons, spacing, soldierSize, gap, layout } = PLATOONS;
  const rows = Math.ceil(size / columns);
  const blockWidth = (columns - 1) * spacing + soldierSize;
  const blockDepth = (rows - 1) * spacing + soldierSize;
  const columnOrder = Array.from({ length: columns }, (_, column) => column - (columns - 1) / 2).sort(
    (a, b) => Math.abs(a) - Math.abs(b) || a - b,
  );

  const slots = [];
  const platoons = layout.slice(0, maxPlatoons).map(([column, row], platoon) => {
    const dx = row === 0 ? column * (HERO.size / 2 + gap + blockWidth / 2) : column * (blockWidth + gap);
    const dz = row * (HERO.size / 2 + gap + blockDepth / 2);
    for (let index = 0; index < size; index++) {
      const rowInBlock = Math.floor(index / columns);
      slots.push({
        dx: dx + columnOrder[index % columns] * spacing,
        dz: dz + ((rows - 1) / 2 - rowInBlock) * spacing,
        platoon,
        soldier: null,
      });
    }
    return { side: Math.sign(dx), beside: row === 0 };
  });
  return { slots, platoons };
}
