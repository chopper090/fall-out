import { EVENTS } from '../core/events.js';

// Posizione orizzontale dell'eroe: segue lo swipe, entro i limiti dati
export function createArmy(bus, { startX, minX, maxX }) {
  const army = { x: startX };
  bus.on(EVENTS.STEER, (dx) => {
    army.x = Math.min(maxX, Math.max(minX, army.x + dx));
  });
  return army;
}
