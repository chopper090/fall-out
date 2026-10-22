import { FIELD, FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Effetti sui nemici: lampo e barra di vita quando vengono colpiti, numero del danno a ogni colpo,
// scoppio quando muoiono. FX.enabled li spegne tutti; barra e numeri hanno anche un interruttore proprio
export function createEnemyFx(bus) {
  const fx = {
    flashes: new Map(),
    healthBars: new Map(),
    pops: [],
    damageNumbers: [],
    popPool: createPool(() => ({ x: 0, z: 0, elapsedMs: 0 }), FX.poolSize),
    numberPool: createPool(() => ({ x: 0, z: 0, value: 0, elapsedMs: 0 }), FX.poolSize),
  };

  const forget = (enemy) => {
    fx.flashes.delete(enemy);
    fx.healthBars.delete(enemy);
  };

  bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
    if (!FX.enabled) return;
    if (FX.showDamageNumbers) startEffect(fx.damageNumbers, fx.numberPool, enemy).value = damage;
    if (enemy.hp <= 0) return;
    fx.flashes.set(enemy, FX.hitFlash.durationMs);
    if (FX.showHealthBars) fx.healthBars.set(enemy, FX.healthBar.visibleMs);
  });

  bus.on(EVENTS.ENEMY_KILLED, (enemy) => {
    forget(enemy);
    if (FX.enabled) startEffect(fx.pops, fx.popPool, enemy);
  });

  bus.on(EVENTS.ENEMY_BREACHED, forget);

  return fx;
}

export function updateEnemyFx(fx, deltaMs) {
  countDown(fx.flashes, deltaMs);
  countDown(fx.healthBars, deltaMs);
  // Lo scoppio scorre con il campo come il nemico; il numero resta nel punto del colpo e da lì sale
  advance(fx.pops, fx.popPool, perFrame(FIELD.scrollSpeed, deltaMs), deltaMs, FX.death.durationMs);
  advance(fx.damageNumbers, fx.numberPool, 0, deltaMs, FX.damageNumber.durationMs);
}

// Effetto a durata fissa nel punto in cui si trova il nemico
function startEffect(items, pool, enemy) {
  const item = pool.acquire();
  item.x = enemy.x;
  item.z = enemy.z;
  item.elapsedMs = 0;
  items.push(item);
  return item;
}

// Timer legati a un nemico: si consumano e spariscono a zero
function countDown(timers, deltaMs) {
  timers.forEach((remainingMs, enemy) => {
    if (remainingMs <= deltaMs) timers.delete(enemy);
    else timers.set(enemy, remainingMs - deltaMs);
  });
}

// Effetti a durata fissa, spostati in avanti di step a ogni frame; i più vecchi finiscono per primi
function advance(items, pool, step, deltaMs, durationMs) {
  for (const item of items) {
    item.elapsedMs += deltaMs;
    item.z -= step;
  }
  while (items.length > 0 && items[0].elapsedMs >= durationMs) pool.release(items.shift());
}
