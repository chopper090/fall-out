import { CHESTS, FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ageEffects, countDown } from './effects.js';

// Effetti sugli scrigni: lampo a ogni colpo ricevuto e uno scatto del contatore dei colpi che mancano, che si
// ingrandisce e torna normale (bumps: millisecondi che mancano alla fine dello scatto). Quando uno scrigno si apre,
// a terra un cerchio che sfuma e la sua ricompensa che sale e sfuma (opens), trascinati dal campo. FX.enabled li
// spegne tutti
export function createChestFx(bus) {
  const fx = {
    flashes: new Map(),
    bumps: new Map(),
    opens: [],
    openPool: createPool(() => ({ x: 0, z: 0, kind: null, elapsedMs: 0 }), CHESTS.poolSize),
  };
  // Lo scrigno che il colpo ha aperto è già sparito
  bus.on(EVENTS.CHEST_HIT, ({ chest }) => {
    if (!FX.enabled || chest.hits <= 0) return;
    fx.flashes.set(chest, FX.hitFlash.durationMs);
    fx.bumps.set(chest, FX.chestBump.durationMs);
  });
  bus.on(EVENTS.CHEST_OPENED, (chest) => {
    if (!FX.enabled) return;
    const open = fx.openPool.acquire();
    open.x = chest.x;
    open.z = chest.z;
    open.kind = chest.kind;
    open.elapsedMs = 0;
    fx.opens.push(open);
  });
  bus.on(EVENTS.CHEST_REMOVED, (chest) => {
    fx.flashes.delete(chest);
    fx.bumps.delete(chest);
  });
  return fx;
}

// scrollSpeed: velocità del campo, con cui scorrono gli effetti degli scrigni aperti
export function updateChestFx(fx, deltaMs, scrollSpeed) {
  countDown(fx.flashes, deltaMs);
  countDown(fx.bumps, deltaMs);
  ageEffects(fx.opens, fx.openPool, deltaMs, FX.chestOpen.durationMs, perFrame(scrollSpeed, deltaMs));
}

// Di quanto è ingrandito il contatore adesso: 1 + FX.chestBump.scale all'inizio dello scatto, 1 alla fine
export function bumpScale(fx, chest) {
  const remainingMs = fx.bumps.get(chest);
  if (remainingMs === undefined) return 1;
  return 1 + (FX.chestBump.scale * remainingMs) / FX.chestBump.durationMs;
}
