import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ageEffects, countDown } from './effects.js';

// Effetti sui nemici: lampo e barra di vita quando vengono colpiti, lampo arancione quando sparano (muzzles),
// numero del danno a ogni colpo e, quando muore, il danno che ha preso in tutto (totals: la vita di partenza meno
// quella che gli resta, il colpo di troppo compreso), scoppio con la pedina del nemico quando muore o si scontra con
// l'esercito.
// Ogni tipo dice quali vuole
// (data/enemies.js): le pedine dello sciame sono troppe e troppo piccole per barra e numeri.
// Il boss lampeggia quando si rompe uno strato della sua vita, e intanto il numero degli strati sulla sua barra in
// alto pulsa (layerPulses, per boss); dove schiaccia resta per poco il segno del colpo (smashes, uno per boss, per la
// sua zona: dove e quanto manca, ms).
// FX.enabled li spegne tutti; barra e numeri hanno anche un interruttore proprio
export function createEnemyFx(bus) {
  const fx = {
    flashes: new Map(),
    muzzles: new Map(),
    healthBars: new Map(),
    layerPulses: new Map(),
    smashes: new Map(),
    pops: [],
    damageNumbers: [],
    totals: [],
    popPool: createPool(() => ({ x: 0, z: 0, type: null, elapsedMs: 0 }), FX.poolSize),
    numberPool: createPool(() => ({ x: 0, z: 0, type: null, value: 0, elapsedMs: 0, enemy: null }), FX.poolSize),
    totalPool: createPool(() => ({ x: 0, z: 0, type: null, value: 0, elapsedMs: 0 }), FX.poolSize),
  };

  const forget = (enemy) => {
    fx.flashes.delete(enemy);
    fx.muzzles.delete(enemy);
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
  bus.on(EVENTS.ENEMY_FIRED, (enemy) => {
    if (FX.enabled) fx.muzzles.set(enemy, FX.muzzleFlash.durationMs);
  });
  bus.on(EVENTS.BOSS_LAYER_BROKEN, ({ enemy }) => {
    if (!FX.enabled) return;
    fx.flashes.set(enemy, FX.bossLayer.flashMs);
    fx.layerPulses.set(enemy, FX.bossLayer.pulseMs);
  });
  bus.on(EVENTS.BOSS_SMASHED, (zone) => {
    if (!FX.enabled) return;
    const { x, z, radius } = zone;
    fx.smashes.set(zone, { x, z, radius, ms: FX.bossSmash.impactMs });
  });

  const pop = (enemy) => {
    forget(enemy);
    if (FX.enabled) startEffect(fx.pops, fx.popPool, enemy);
  };
  // Il nemico ha ancora la sua vita, già sotto zero: il danno totale è quello che manca alla vita di partenza
  bus.on(EVENTS.ENEMY_KILLED, (enemy) => {
    if (FX.enabled && FX.showDamageNumbers && enemy.type.damageNumbers) {
      startEffect(fx.totals, fx.totalPool, enemy).value = enemy.maxHp - enemy.hp;
    }
    pop(enemy);
  });
  bus.on(EVENTS.ENEMY_CLASHED, pop);
  bus.on(EVENTS.ENEMY_ESCAPED, ({ enemy }) => forget(enemy));

  return fx;
}

// scrollSpeed: velocità del campo, con cui scorrono gli scoppi
export function updateEnemyFx(fx, deltaMs, scrollSpeed) {
  countDown(fx.flashes, deltaMs);
  countDown(fx.muzzles, deltaMs);
  countDown(fx.healthBars, deltaMs);
  countDown(fx.layerPulses, deltaMs);
  for (const [zone, smash] of fx.smashes) {
    smash.ms -= deltaMs;
    if (smash.ms <= 0) fx.smashes.delete(zone);
  }
  // Lo scoppio scorre con il campo come il nemico; il numero resta nel punto del colpo e da lì sale
  ageEffects(fx.pops, fx.popPool, deltaMs, FX.death.durationMs, perFrame(scrollSpeed, deltaMs));
  ageEffects(fx.damageNumbers, fx.numberPool, deltaMs, FX.damageNumber.durationMs);
  ageEffects(fx.totals, fx.totalPool, deltaMs, FX.damageTotal.durationMs);
}

// I colpi che arrivano sullo stesso nemico a poca distanza di tempo diventano un solo numero con il danno
// totale: con tanti soldati che sparano i numeri restano pochi e leggibili
function addDamageNumber(fx, enemy, damage) {
  const { mergeMs } = FX.damageNumber;
  const recent = fx.damageNumbers.find((number) => number.enemy === enemy && number.elapsedMs < mergeMs);
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

// Ingrandimento del numero degli strati del boss enemy: massimo quando uno strato si rompe, poi torna a 1
export function layerPulseScale(fx, enemy) {
  return 1 + FX.bossLayer.pulseScale * ((fx.layerPulses.get(enemy) ?? 0) / FX.bossLayer.pulseMs);
}
