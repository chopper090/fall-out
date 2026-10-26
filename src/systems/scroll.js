import { EVENTS } from '../core/events.js';

// Velocità con cui la strada scende verso l'esercito, che resta fermo (il campo disegnato non si muove): la decide
// l'ondata annunciata, e porta con sé porte, scrigni, bottino e nemici. All'arrivo del boss si ferma: boss e scorta
// camminano da soli
export function createScroll(bus) {
  const scroll = { speed: 0 };
  bus.on(EVENTS.WAVE_ANNOUNCED, ({ wave }) => {
    scroll.speed = wave.scrollSpeed;
  });
  bus.on(EVENTS.BOSS_STARTED, () => {
    scroll.speed = 0;
  });
  return scroll;
}
