import { CHESTS, FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Effetti su cancelli e scrigni: lampo a ogni colpo ricevuto e, quando il numero cambia (il numero del cancello o
// i colpi che mancano allo scrigno), uno scatto dell'insegna che si ingrandisce e torna normale (bumps:
// millisecondi che mancano alla fine dello scatto). Quando uno scrigno si apre, a terra un cerchio che sfuma e la
// sua ricompensa che sale e sfuma (opens), trascinati dal campo. FX.enabled li spegne tutti
export function createGateFx(bus) {
  const fx = {
    flashes: new Map(),
    bumps: new Map(),
    opens: [],
    openPool: createPool(() => ({ x: 0, z: 0, kind: null, elapsedMs: 0 }), CHESTS.poolSize),
  };
  bus.on(EVENTS.GATE_HIT, ({ gate }) => {
    if (FX.enabled) fx.flashes.set(gate, FX.hitFlash.durationMs);
  });
  bus.on(EVENTS.GATE_VALUE_CHANGED, (gate) => {
    if (FX.enabled) fx.bumps.set(gate, FX.gateBump.durationMs);
  });
  // Lo scrigno che il colpo ha aperto è già sparito
  bus.on(EVENTS.CHEST_HIT, ({ chest }) => {
    if (!FX.enabled || chest.hits <= 0) return;
    fx.flashes.set(chest, FX.hitFlash.durationMs);
    fx.bumps.set(chest, FX.gateBump.durationMs);
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
  const forget = (item) => {
    fx.flashes.delete(item);
    fx.bumps.delete(item);
  };
  bus.on(EVENTS.GATE_REMOVED, forget);
  bus.on(EVENTS.CHEST_REMOVED, forget);
  return fx;
}

// scrollSpeed: velocità del campo, con cui scorrono gli effetti degli scrigni aperti
export function updateGateFx(fx, deltaMs, scrollSpeed) {
  countDown(fx.flashes, deltaMs);
  countDown(fx.bumps, deltaMs);
  const step = perFrame(scrollSpeed, deltaMs);
  for (const open of fx.opens) {
    open.elapsedMs += deltaMs;
    open.z -= step;
  }
  while (fx.opens.length > 0 && fx.opens[0].elapsedMs >= FX.chestOpen.durationMs) fx.openPool.release(fx.opens.shift());
}

function countDown(timers, deltaMs) {
  timers.forEach((remainingMs, item) => {
    if (remainingMs <= deltaMs) timers.delete(item);
    else timers.set(item, remainingMs - deltaMs);
  });
}

// Di quanto è ingrandita l'insegna adesso: 1 + FX.gateBump.scale all'inizio dello scatto, 1 alla fine
export function bumpScale(fx, item) {
  const remainingMs = fx.bumps.get(item);
  if (remainingMs === undefined) return 1;
  return 1 + (FX.gateBump.scale * remainingMs) / FX.gateBump.durationMs;
}
