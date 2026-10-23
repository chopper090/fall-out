import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';

// Effetti sull'esercito: bordo rosso dello schermo e scossa della telecamera quando l'eroe è colpito
// o un nemico supera l'esercito (per uno sciame basta la prima pedina), solo la scossa quando il boss schiaccia;
// scoppio dove muore un soldato, con la pedina della sua arma. La scossa è un'oscillazione che si smorza, senza casualità
export function createArmyFx(bus) {
  const fx = {
    flashMs: 0,
    shakeMs: 0,
    shakeElapsedMs: 0,
    pops: [],
    popPool: createPool(() => ({ x: 0, z: 0, weapon: null, elapsedMs: 0 }), FX.poolSize),
  };
  const alarmOn = () => FX.enabled && FX.screenAlarm;
  const shake = () => {
    fx.shakeMs = FX.damage.shakeMs;
    fx.shakeElapsedMs = 0;
  };
  const alarm = () => {
    if (!alarmOn()) return;
    fx.flashMs = FX.damage.flashMs;
    shake();
  };
  bus.on(EVENTS.HERO_DAMAGED, alarm);
  bus.on(EVENTS.BOSS_SMASHED, () => {
    if (alarmOn()) shake();
  });
  bus.on(EVENTS.ENEMY_ESCAPED, ({ counted }) => {
    if (counted) alarm();
  });
  bus.on(EVENTS.SOLDIER_KILLED, ({ soldier, x, z }) => {
    if (!FX.enabled) return;
    const pop = fx.popPool.acquire();
    pop.x = x;
    pop.z = z;
    pop.weapon = soldier.weapon;
    pop.elapsedMs = 0;
    fx.pops.push(pop);
  });
  return fx;
}

// Lo scoppio resta dove è morto il soldato: l'esercito non scorre con il campo
export function updateArmyFx(fx, deltaMs) {
  fx.flashMs = Math.max(0, fx.flashMs - deltaMs);
  fx.shakeMs = Math.max(0, fx.shakeMs - deltaMs);
  fx.shakeElapsedMs += deltaMs;
  for (const pop of fx.pops) pop.elapsedMs += deltaMs;
  while (fx.pops.length > 0 && fx.pops[0].elapsedMs >= FX.death.durationMs) fx.popPool.release(fx.pops.shift());
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
