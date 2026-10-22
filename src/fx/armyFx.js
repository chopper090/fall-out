import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';

// Effetti quando l'esercito perde energia: bordo rosso dello schermo e scossa della telecamera.
// La scossa è un'oscillazione che si smorza, senza casualità
export function createArmyFx(bus) {
  const fx = { flashMs: 0, shakeMs: 0, shakeElapsedMs: 0 };
  bus.on(EVENTS.ARMY_DAMAGED, () => {
    if (!FX.enabled) return;
    fx.flashMs = FX.damage.flashMs;
    fx.shakeMs = FX.damage.shakeMs;
    fx.shakeElapsedMs = 0;
  });
  return fx;
}

export function updateArmyFx(fx, deltaMs) {
  fx.flashMs = Math.max(0, fx.flashMs - deltaMs);
  fx.shakeMs = Math.max(0, fx.shakeMs - deltaMs);
  fx.shakeElapsedMs += deltaMs;
}

// Spostamento della telecamera: oscilla in cerchio e si riduce fino a zero
export function shakeOffset(fx, out) {
  const strength = FX.damage.shakeAmplitude * (fx.shakeMs / FX.damage.shakeMs);
  const angle = fx.shakeElapsedMs * FX.damage.shakeFrequency;
  out.x = strength * Math.sin(angle);
  out.y = strength * Math.cos(angle);
  return out;
}

// Opacità del bordo rosso: piena nel momento del danno, poi sfuma
export function flashAlpha(fx) {
  return FX.damage.maxAlpha * (fx.flashMs / FX.damage.flashMs);
}
