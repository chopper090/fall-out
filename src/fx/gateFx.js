import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';

// Lampo sul cancello a ogni colpo ricevuto: si vede che il colpo conta anche quando il valore non sale ancora
export function createGateFx(bus) {
  const fx = { flashes: new Map() };
  bus.on(EVENTS.GATE_HIT, ({ gate }) => {
    if (FX.enabled) fx.flashes.set(gate, FX.hitFlash.durationMs);
  });
  bus.on(EVENTS.GATE_REMOVED, (gate) => fx.flashes.delete(gate));
  return fx;
}

export function updateGateFx(fx, deltaMs) {
  fx.flashes.forEach((remainingMs, gate) => {
    if (remainingMs <= deltaMs) fx.flashes.delete(gate);
    else fx.flashes.set(gate, remainingMs - deltaMs);
  });
}
