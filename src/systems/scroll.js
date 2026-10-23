import { EVENTS } from '../core/events.js';
import { perFrame } from '../core/time.js';

// Avanzamento del campo: velocità decisa dall'ondata o dal boss annunciati, distanza percorsa verso l'eroe
export function createScroll(bus) {
  const scroll = { speed: 0, distance: 0 };
  bus.on(EVENTS.WAVE_ANNOUNCED, ({ wave }) => {
    scroll.speed = wave.scrollSpeed;
  });
  bus.on(EVENTS.BOSS_ANNOUNCED, ({ boss }) => {
    scroll.speed = boss.scrollSpeed;
  });
  return scroll;
}

export function updateScroll(scroll, deltaMs) {
  scroll.distance += perFrame(scroll.speed, deltaMs);
}
