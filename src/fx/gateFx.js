import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { isMalus } from '../systems/gates.js';
import { countDown } from './effects.js';

// Scritta del cancello appena passato, al centro dello schermo (la disegna l'interfaccia): il suo numero (value,
// negativo per i −N), se toglie soldati (malus) e da quanto è comparsa. Un cancello nuovo prende il posto del
// precedente; se l'esercito non passa sotto nessun cancello non compare niente. A ogni colpo che lo alza il numero sul
// cancello fa uno scatto (bumps: millisecondi che mancano alla fine). FX.enabled li spegne
export function createGateFx(bus) {
  const fx = { value: 0, malus: false, elapsedMs: Infinity, bumps: new Map() };
  bus.on(EVENTS.GATE_PASSED, (gate) => {
    fx.bumps.delete(gate);
    if (!FX.enabled) return;
    fx.value = gate.value;
    fx.malus = isMalus(gate);
    fx.elapsedMs = 0;
  });
  bus.on(EVENTS.GATE_HIT, ({ gate }) => {
    if (FX.enabled) fx.bumps.set(gate, FX.gateBump.durationMs);
  });
  return fx;
}

export function updateGateFx(fx, deltaMs) {
  fx.elapsedMs += deltaMs;
  countDown(fx.bumps, deltaMs);
}

// Di quanto è ingrandito il numero del cancello adesso: 1 + FX.gateBump.scale all'inizio dello scatto, 1 alla fine
export function gateBumpScale(fx, gate) {
  const remainingMs = fx.bumps.get(gate);
  if (remainingMs === undefined) return 1;
  return 1 + (FX.gateBump.scale * remainingMs) / FX.gateBump.durationMs;
}

// A che punto è la scritta, da 0 appena comparsa a 1 finita (o mai comparsa)
export function gatePassProgress(fx) {
  return Math.min(1, fx.elapsedMs / FX.gatePass.durationMs);
}
