import { FIELD } from '../config/balance.js';
import { perFrame } from '../core/time.js';

// Avanzamento del campo: distanza percorsa verso l'eroe
export function createScroll() {
  return { distance: 0 };
}

export function updateScroll(scroll, deltaMs) {
  scroll.distance += perFrame(FIELD.scrollSpeed, deltaMs);
}
