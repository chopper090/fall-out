import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Effetti sui nemici: lampo e barra di vita quando vengono colpiti, numero del danno a ogni colpo,
// scoppio con la pedina del nemico quando muore o si scontra con l'esercito. Ogni tipo dice quali vuole
// (data/enemies.js): le pedine dello sciame sono troppe e troppo piccole per barra e numeri.
// Il boss lampeggia quando si rompe uno strato della sua vita, e intanto il numero degli strati sulla barra
// in alto pulsa (layerPulseMs); dove schiaccia resta per poco il segno del colpo (smash, con ms che manca).
// FX.enabled li spegne tutti; barra e numeri hanno anche un interruttore proprio
export function createEnemyFx(bus) {
  const fx = {
    flashes: new Map(),
    healthBars: new Map(),
    layerPulseMs: 0,
    smash: { x: 0, z: 0, radius: 0, ms: 0 },
    pops: [],
    damageNumbers: [],
    popPool: createPool(() => ({ x: 0, z: 0, type: null, elapsedMs: 0 }), FX.poolSize),
    numberPool: createPool(() => ({ x: 0, z: 0, type: null, value: 0, elapsedMs: 0, enemy: null }), FX.poolSize),
  };

  const forget = (enemy) => {
    fx.flashes.delete(enemy);
    fx.healthBars.delete(enemy);
  };

  bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
    if (!FX.enabled) return;
    const { healthBar, damageNumbers, hitFlash } = enemy.type;
    if (damageNumbers && FX.showDamageNumbers) addDamageNumber(fx, enemy, damage);
    if (enemy.hp <= 0) return;
    if (hitFlash) fx.flashes.set(enemy, FX.hitFlash.durationMs);
    if (healthBar && FX.showHealthBars) fx.healthBars.set(enemy, FX.healthBar.visibleMs);
  });
  bus.on(EVENTS.BOSS_LAYER_BROKEN, ({ enemy }) => {
    if (!FX.enabled) return;
    fx.flashes.set(enemy, FX.bossLayer.flashMs);
    fx.layerPulseMs = FX.bossLayer.pulseMs;
  });
  bus.on(EVENTS.BOSS_SMASHED, ({ x, z, radius }) => {
    if (!FX.enabled) return;
    Object.assign(fx.smash, { x, z, radius, ms: FX.bossSmash.impactMs });
  });

  const pop = (enemy) => {
    forget(enemy);
    if (FX.enabled) startEffect(fx.pops, fx.popPool, enemy);
  };
  bus.on(EVENTS.ENEMY_KILLED, pop);
  bus.on(EVENTS.ENEMY_CLASHED, pop);
  bus.on(EVENTS.ENEMY_ESCAPED, ({ enemy }) => forget(enemy));

  return fx;
}

// scrollSpeed: velocità del campo, con cui scorrono gli scoppi
export function updateEnemyFx(fx, deltaMs, scrollSpeed) {
  countDown(fx.flashes, deltaMs);
  countDown(fx.healthBars, deltaMs);
  fx.layerPulseMs = Math.max(0, fx.layerPulseMs - deltaMs);
  fx.smash.ms = Math.max(0, fx.smash.ms - deltaMs);
  // Lo scoppio scorre con il campo come il nemico; il numero resta nel punto del colpo e da lì sale
  advance(fx.pops, fx.popPool, perFrame(scrollSpeed, deltaMs), deltaMs, FX.death.durationMs);
  advance(fx.damageNumbers, fx.numberPool, 0, deltaMs, FX.damageNumber.durationMs);
}

// I colpi che arrivano sullo stesso nemico a poca distanza di tempo diventano un solo numero con il danno
// totale: con tanti soldati che sparano i numeri restano pochi e leggibili
function addDamageNumber(fx, enemy, damage) {
  const recent = fx.damageNumbers.find((number) => number.enemy === enemy && number.elapsedMs < FX.damageNumber.mergeMs);
  if (recent) {
    recent.value += damage;
    return;
  }
  const number = startEffect(fx.damageNumbers, fx.numberPool, enemy);
  number.value = damage;
  number.enemy = enemy;
}

// Effetto a durata fissa nel punto in cui si trova il nemico, con il suo tipo
function startEffect(items, pool, enemy) {
  const item = pool.acquire();
  item.x = enemy.x;
  item.z = enemy.z;
  item.type = enemy.type;
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

// Ingrandimento del numero degli strati del boss: massimo quando uno strato si rompe, poi torna a 1
export function layerPulseScale(fx) {
  return 1 + FX.bossLayer.pulseScale * (fx.layerPulseMs / FX.bossLayer.pulseMs);
}
