import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';

// Lampo sul cancello a ogni colpo ricevuto e, quando il suo numero cambia, uno scatto dell'insegna che si
// ingrandisce e torna normale (bumps: millisecondi che mancano alla fine dello scatto)
export function createGateFx(bus) {
  const fx = { flashes: new Map(), bumps: new Map() };
  bus.on(EVENTS.GATE_HIT, ({ gate }) => {
    if (FX.enabled) fx.flashes.set(gate, FX.hitFlash.durationMs);
  });
  bus.on(EVENTS.GATE_VALUE_CHANGED, (gate) => {
    if (FX.enabled) fx.bumps.set(gate, FX.gateBump.durationMs);
  });
  bus.on(EVENTS.GATE_REMOVED, (gate) => {
    fx.flashes.delete(gate);
    fx.bumps.delete(gate);
  });
  return fx;
}

export function updateGateFx(fx, deltaMs) {
  countDown(fx.flashes, deltaMs);
  countDown(fx.bumps, deltaMs);
}

function countDown(timers, deltaMs) {
  timers.forEach((remainingMs, gate) => {
    if (remainingMs <= deltaMs) timers.delete(gate);
    else timers.set(gate, remainingMs - deltaMs);
  });
}

// Di quanto è ingrandita l'insegna adesso: 1 + FX.gateBump.scale all'inizio dello scatto, 1 alla fine
export function bumpScale(fx, gate) {
  const remainingMs = fx.bumps.get(gate);
  if (remainingMs === undefined) return 1;
  return 1 + (FX.gateBump.scale * remainingMs) / FX.gateBump.durationMs;
}
