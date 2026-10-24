import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';

// Effetti sull'esercito: bordo rosso dello schermo e scossa della telecamera quando un eroe è colpito
// o un nemico supera l'esercito (per uno sciame basta la prima pedina), solo la scossa quando il boss schiaccia;
// scoppio dove muore un soldato, con la pedina della sua arma, o un eroe, con la sua; lampo sull'élite colpita che
// resta in piedi (hits). La scossa è un'oscillazione che si smorza, senza casualità
export function createArmyFx(bus) {
  const fx = {
    flashMs: 0,
    shakeMs: 0,
    shakeElapsedMs: 0,
    pops: [],
    hits: new Map(),
    popPool: createPool(() => ({ x: 0, z: 0, weapon: null, hero: null, elapsedMs: 0 }), FX.poolSize),
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
  const pop = (x, z, weapon, hero) => {
    if (!FX.enabled) return;
    const item = fx.popPool.acquire();
    item.x = x;
    item.z = z;
    item.weapon = weapon;
    item.hero = hero;
    item.elapsedMs = 0;
    fx.pops.push(item);
  };
  bus.on(EVENTS.SOLDIER_KILLED, ({ soldier, x, z }) => {
    fx.hits.delete(soldier);
    pop(x, z, soldier.weapon, null);
  });
  // L'esercito ha già tolto la vita: un'élite ancora nel suo posto è rimasta in piedi (chi muore può tornare subito
  // dalla pool come riserva, ma non è un'élite)
  bus.on(EVENTS.SOLDIER_HIT, ({ soldier }) => {
    if (FX.enabled && soldier.elite && soldier.slot !== null) fx.hits.set(soldier, FX.hitFlash.durationMs);
  });
  bus.on(EVENTS.HERO_KILLED, (hero) => pop(hero.x, hero.z, null, hero));
  return fx;
}

// Lo scoppio resta dove è morto il soldato: l'esercito non scorre con il campo
export function updateArmyFx(fx, deltaMs) {
  fx.flashMs = Math.max(0, fx.flashMs - deltaMs);
  fx.shakeMs = Math.max(0, fx.shakeMs - deltaMs);
  fx.hits.forEach((remainingMs, soldier) => {
    if (remainingMs <= deltaMs) fx.hits.delete(soldier);
    else fx.hits.set(soldier, remainingMs - deltaMs);
  });
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
