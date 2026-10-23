import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { secondsToMs } from '../core/time.js';

// Effetti delle abilità degli eroi: l'anello dell'onda d'urto che si allarga e sfuma, la scia del colpo perforante
// che sfuma, il lampo dove lo scudo ferma un colpo nemico. Restano dove sono nati (l'esercito non scorre).
// L'anello del fuoco rapido invece segue il suo eroe (hero) per tutto il tempo che dura (length, in ms), ricomincia
// se il fuoco rapido riparte mentre dura ancora e sparisce se l'eroe muore. FX.enabled li spegne
export function createHeroFx(bus) {
  const fx = {
    waves: [],
    streaks: [],
    blocks: [],
    boosts: [],
    pool: createPool(() => ({ x: 0, z: 0, radius: 0, length: 0, elapsedMs: 0, hero: null }), FX.poolSize),
  };
  bus.on(EVENTS.ABILITY_USED, ({ hero, ability, x, z }) => {
    if (!FX.enabled) return;
    if (ability.kind === 'shockwave') start(fx, fx.waves, x, z, ability.radius, 0);
    else if (ability.kind === 'pierce') start(fx, fx.streaks, x, z, ability.width / 2, ability.range);
    else if (ability.kind === 'rapidFire') {
      const boost = fx.boosts.find((item) => item.hero === hero) ?? start(fx, fx.boosts, x, z, ability.radius, 0);
      boost.hero = hero;
      boost.length = secondsToMs(ability.seconds);
      boost.elapsedMs = 0;
    }
  });
  bus.on(EVENTS.SHOT_BLOCKED, ({ x, z }) => {
    if (FX.enabled) start(fx, fx.blocks, x, z, FX.shield.blockRadius, 0);
  });
  bus.on(EVENTS.HERO_KILLED, (hero) => {
    for (const boost of fx.boosts) if (boost.hero === hero) boost.elapsedMs = boost.length;
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
  item.hero = null;
  list.push(item);
  return item;
}

export function updateHeroFx(fx, deltaMs) {
  age(fx, fx.waves, deltaMs, FX.shockwave.durationMs);
  age(fx, fx.streaks, deltaMs, FX.pierce.durationMs);
  age(fx, fx.blocks, deltaMs, FX.shield.blockMs);
  for (const boost of fx.boosts) boost.elapsedMs += deltaMs;
  for (let index = fx.boosts.length - 1; index >= 0; index--) {
    if (fx.boosts[index].elapsedMs < fx.boosts[index].length) continue;
    fx.pool.release(fx.boosts[index]);
    fx.boosts.splice(index, 1);
  }
}

// I più vecchi finiscono per primi
function age(fx, list, deltaMs, durationMs) {
  for (const item of list) item.elapsedMs += deltaMs;
  while (list.length > 0 && list[0].elapsedMs >= durationMs) fx.pool.release(list.shift());
}
