import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Effetti delle armi dell'esercito: lo scoppio a terra di ogni granata, che sfuma e scorre con il campo.
// FX.enabled li spegne
export function createWeaponFx(bus) {
  const fx = {
    blasts: [],
    pool: createPool(() => ({ x: 0, z: 0, radius: 0, elapsedMs: 0 }), FX.poolSize),
  };
  bus.on(EVENTS.BLAST, ({ x, z, radius }) => {
    if (!FX.enabled) return;
    const blast = fx.pool.acquire();
    blast.x = x;
    blast.z = z;
    blast.radius = radius;
    blast.elapsedMs = 0;
    fx.blasts.push(blast);
  });
  return fx;
}

// scrollSpeed: velocità del campo, con cui scorrono gli scoppi; i più vecchi finiscono per primi
export function updateWeaponFx(fx, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const blast of fx.blasts) {
    blast.elapsedMs += deltaMs;
    blast.z -= step;
  }
  while (fx.blasts.length > 0 && fx.blasts[0].elapsedMs >= FX.blast.durationMs) fx.pool.release(fx.blasts.shift());
}
