import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { isMalus } from '../systems/gates.js';

// Scritta del cancello appena passato, al centro dello schermo (la disegna l'interfaccia): il suo numero (value,
// negativo per i −N), se toglie soldati (malus) e da quanto è comparsa. Un cancello nuovo prende il posto del
// precedente; se l'esercito non passa sotto nessun cancello non compare niente. FX.enabled la spegne
export function createGateFx(bus) {
  const fx = { value: 0, malus: false, elapsedMs: Infinity };
  bus.on(EVENTS.GATE_PASSED, (gate) => {
    if (!FX.enabled) return;
    fx.value = gate.value;
    fx.malus = isMalus(gate);
    fx.elapsedMs = 0;
  });
  return fx;
}

export function updateGateFx(fx, deltaMs) {
  fx.elapsedMs += deltaMs;
}

// A che punto è la scritta, da 0 appena comparsa a 1 finita (o mai comparsa)
export function gatePassProgress(fx) {
  return Math.min(1, fx.elapsedMs / FX.gatePass.durationMs);
}
