import { FX, LOOT } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Premio preso: dove l'esercito l'ha raccolto il suo valore ("+3 materiali") sale e sfuma (picks), trascinato dal
// campo. A missione finita le scritte spariscono: il campo si ferma e resterebbero sotto il riepilogo. FX.enabled lo
// spegne
export function createLootFx(bus) {
  const fx = {
    picks: [],
    pool: createPool(() => ({ x: 0, z: 0, kind: null, amount: 0, elapsedMs: 0 }), LOOT.poolSize),
  };
  // Il premio torna nella sua pool subito dopo l'evento: se ne copia quello che serve
  bus.on(EVENTS.LOOT_COLLECTED, (item) => {
    if (!FX.enabled) return;
    const pick = fx.pool.acquire();
    pick.x = item.x;
    pick.z = item.z;
    pick.kind = item.kind;
    pick.amount = item.amount;
    pick.elapsedMs = 0;
    fx.picks.push(pick);
  });
  const clear = () => {
    for (const pick of fx.picks) fx.pool.release(pick);
    fx.picks.length = 0;
  };
  bus.on(EVENTS.MISSION_FAILED, clear);
  bus.on(EVENTS.MISSION_COMPLETED, clear);
  return fx;
}

// scrollSpeed: velocità del campo, con cui scorrono le scritte
export function updateLootFx(fx, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const pick of fx.picks) {
    pick.elapsedMs += deltaMs;
    pick.z -= step;
  }
  while (fx.picks.length > 0 && fx.picks[0].elapsedMs >= FX.lootPick.durationMs) fx.pool.release(fx.picks.shift());
}
