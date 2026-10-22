import { ARMY, CONTROLS, ENEMIES } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { perFrame } from '../core/time.js';

// Esercito: posizione orizzontale guidata dallo swipe tra le corsie esterne (al rilascio, se è vicino
// al centro di una corsia, ci scivola) ed energia, che cala ogni volta che un nemico lo supera
export function createArmy(bus, { startX, laneCenters }) {
  const minX = laneCenters[0];
  const maxX = laneCenters[laneCenters.length - 1];
  const army = { x: startX, snapTarget: null, hp: ARMY.maxHp, maxHp: ARMY.maxHp };

  bus.on(EVENTS.STEER, (dx) => {
    army.snapTarget = null;
    army.x = Math.min(maxX, Math.max(minX, army.x + dx * CONTROLS.sensitivity));
  });

  bus.on(EVENTS.STEER_END, () => {
    if (!CONTROLS.snapEnabled) return;
    const nearest = findNearest(laneCenters, army.x);
    if (Math.abs(nearest - army.x) <= CONTROLS.snapRadius) army.snapTarget = nearest;
  });

  bus.on(EVENTS.ENEMY_BREACHED, () => {
    if (army.hp === 0) return;
    army.hp = Math.max(0, army.hp - ENEMIES.breachDamage);
    bus.emit(EVENTS.ARMY_DAMAGED, army);
    if (army.hp === 0) bus.emit(EVENTS.ARMY_DEFEATED, army);
  });

  return army;
}

// Porta l'eroe verso il centro corsia scelto al rilascio, a velocità costante
export function updateArmy(army, deltaMs) {
  if (army.snapTarget === null) return;
  const step = perFrame(CONTROLS.snapSpeed, deltaMs);
  const distance = army.snapTarget - army.x;
  if (Math.abs(distance) <= step) {
    army.x = army.snapTarget;
    army.snapTarget = null;
  } else {
    army.x += Math.sign(distance) * step;
  }
}

function findNearest(values, x) {
  return values.reduce((best, value) => (Math.abs(value - x) < Math.abs(best - x) ? value : best));
}
