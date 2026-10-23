import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';

// Effetti delle abilità degli eroi: l'anello dell'onda d'urto che si allarga e sfuma, la scia del colpo perforante
// che sfuma, il lampo dove lo scudo ferma un colpo nemico. Restano dove sono nati (l'esercito non scorre).
// FX.enabled li spegne
export function createHeroFx(bus) {
  const fx = {
    waves: [],
    streaks: [],
    blocks: [],
    pool: createPool(() => ({ x: 0, z: 0, radius: 0, length: 0, elapsedMs: 0 }), FX.poolSize),
  };
  bus.on(EVENTS.ABILITY_USED, ({ ability, x, z }) => {
    if (!FX.enabled) return;
    if (ability.kind === 'shockwave') start(fx, fx.waves, x, z, ability.radius, 0);
    else if (ability.kind === 'pierce') start(fx, fx.streaks, x, z, ability.width / 2, ability.range);
  });
  bus.on(EVENTS.SHOT_BLOCKED, ({ x, z }) => {
    if (FX.enabled) start(fx, fx.blocks, x, z, FX.shield.blockRadius, 0);
  });
  return fx;
}

function start(fx, list, x, z, radius, length) {
  const item = fx.pool.acquire();
  item.x = x;
  item.z = z;
  item.radius = radius;
  item.length = length;
  item.elapsedMs = 0;
  list.push(item);
}

export function updateHeroFx(fx, deltaMs) {
  age(fx, fx.waves, deltaMs, FX.shockwave.durationMs);
  age(fx, fx.streaks, deltaMs, FX.pierce.durationMs);
  age(fx, fx.blocks, deltaMs, FX.shield.blockMs);
}

// I più vecchi finiscono per primi
function age(fx, list, deltaMs, durationMs) {
  for (const item of list) item.elapsedMs += deltaMs;
  while (list.length > 0 && list[0].elapsedMs >= durationMs) fx.pool.release(list.shift());
}
