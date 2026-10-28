import { FX } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { secondsToMs } from '../core/time.js';
import { ageEffects } from './effects.js';

// Effetti delle abilità degli eroi: l'anello dell'onda d'urto che si allarga e sfuma, la scia del colpo perforante che
// sfuma, il lampo dove lo scudo ferma un colpo nemico, l'onda verde del soccorso (heals), il nome del potere sopra
// l'eroe che l'ha usato (names, con il suo eroe, il tipo, kind, e la riga, row: freeRow). Restano dove sono nati
// (l'esercito non scorre).
// L'anello del fuoco rapido invece segue il suo eroe (hero) per tutto il tempo che dura (length, in ms), ricomincia se
// il fuoco rapido riparte mentre dura ancora e sparisce se l'eroe muore. FX.enabled li spegne
export function createHeroFx(bus) {
  const fx = {
    waves: [],
    streaks: [],
    blocks: [],
    boosts: [],
    heals: [],
    names: [],
    pool: createPool(
      () => ({ x: 0, z: 0, radius: 0, length: 0, elapsedMs: 0, hero: null, kind: '', row: 0 }),
      FX.poolSize,
    ),
  };
  bus.on(EVENTS.ABILITY_USED, ({ hero, ability, x, z }) => {
    if (!FX.enabled) return;
    const row = freeRow(fx.names);
    const name = start(fx, fx.names, x, z, 0, 0);
    name.hero = hero;
    name.kind = ability.kind;
    name.row = row;
    if (ability.kind === 'shockwave') start(fx, fx.waves, x, z, ability.radius, 0);
    else if (ability.kind === 'pierce') start(fx, fx.streaks, x, z, ability.width / 2, ability.range);
    else if (ability.kind === 'rescue') start(fx, fx.heals, x, z, FX.rescue.radius, 0);
    else if (ability.kind === 'rapidFire' || ability.kind === 'fury') {
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

// La prima riga libera per il nome di un potere: sono prese quelle dei nomi ancora in vista
function freeRow(names) {
  let row = 0;
  while (names.some((name) => name.row === row)) row += 1;
  return row;
}

function start(fx, list, x, z, radius, length) {
  const item = fx.pool.acquire();
  item.x = x;
  item.z = z;
  item.radius = radius;
  item.length = length;
  item.elapsedMs = 0;
  item.hero = null;
  item.row = 0;
  list.push(item);
  return item;
}

export function updateHeroFx(fx, deltaMs) {
  ageEffects(fx.waves, fx.pool, deltaMs, FX.shockwave.durationMs);
  ageEffects(fx.streaks, fx.pool, deltaMs, FX.pierce.durationMs);
  ageEffects(fx.blocks, fx.pool, deltaMs, FX.shield.blockMs);
  ageEffects(fx.names, fx.pool, deltaMs, FX.powerName.durationMs);
  ageEffects(fx.heals, fx.pool, deltaMs, FX.rescue.durationMs);
  for (const boost of fx.boosts) boost.elapsedMs += deltaMs;
  for (let index = fx.boosts.length - 1; index >= 0; index--) {
    if (fx.boosts[index].elapsedMs < fx.boosts[index].length) continue;
    fx.pool.release(fx.boosts[index]);
    fx.boosts.splice(index, 1);
  }
}
