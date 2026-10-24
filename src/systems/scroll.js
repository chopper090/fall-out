import { EVENTS } from '../core/events.js';
import { perFrame } from '../core/time.js';

// Avanzamento del campo: velocità decisa dall'ondata annunciata, distanza percorsa verso l'eroe. All'arrivo del
// boss il campo si ferma: boss e scorta camminano da soli
export function createScroll(bus) {
  const scroll = { speed: 0, distance: 0 };
  bus.on(EVENTS.WAVE_ANNOUNCED, ({ wave }) => {
    scroll.speed = wave.scrollSpeed;
  });
  bus.on(EVENTS.BOSS_STARTED, () => {
    scroll.speed = 0;
  });
  return scroll;
}

export function updateScroll(scroll, deltaMs) {
  scroll.distance += perFrame(scroll.speed, deltaMs);
}
