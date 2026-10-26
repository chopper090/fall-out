import { FX, LOOT } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ageEffects } from './effects.js';

// Premio preso: dove l'esercito l'ha raccolto un anello a terra che si allarga e sfuma (picks), trascinato dal campo;
// vicino agli eroi la sua quantità ("+3 materiali", gains, ognuna nella sua riga), ferma per un po' e poi sale e sfuma:
// i premi dello stesso tipo presi mentre la sua scritta è ancora ferma si sommano in quella, che riparte. A missione
// finita le scritte spariscono: il campo si ferma e resterebbero sotto il riepilogo. FX.enabled lo spegne
export function createLootFx(bus) {
  const fx = {
    picks: [],
    gains: [],
    pool: createPool(() => ({ x: 0, z: 0, kind: null, elapsedMs: 0 }), LOOT.poolSize),
    gainPool: createPool(() => ({ kind: null, amount: 0, row: 0, elapsedMs: 0 }), FX.poolSize),
  };
  // Il premio torna nella sua pool subito dopo l'evento: se ne copia quello che serve
  bus.on(EVENTS.LOOT_COLLECTED, (item) => {
    if (!FX.enabled) return;
    const pick = fx.pool.acquire();
    pick.x = item.x;
    pick.z = item.z;
    pick.kind = item.kind;
    pick.elapsedMs = 0;
    fx.picks.push(pick);
    addGain(fx, item);
  });
  const clear = () => {
    for (const pick of fx.picks) fx.pool.release(pick);
    for (const gain of fx.gains) fx.gainPool.release(gain);
    fx.picks.length = 0;
    fx.gains.length = 0;
  };
  bus.on(EVENTS.MISSION_FAILED, clear);
  bus.on(EVENTS.MISSION_COMPLETED, clear);
  return fx;
}

// La scritta ancora ferma dello stesso tipo prende anche questo premio e riparte, in fondo all'elenco (così i più
// vecchi restano i primi a finire); se non c'è, una nuova nella prima riga libera
function addGain(fx, { kind, amount }) {
  const index = fx.gains.findIndex((gain) => gain.kind === kind && gain.elapsedMs < FX.lootGain.holdMs);
  const gain = index >= 0 ? fx.gains.splice(index, 1)[0] : fx.gainPool.acquire();
  if (index < 0) {
    gain.kind = kind;
    gain.amount = 0;
    gain.row = freeRow(fx.gains);
  }
  gain.amount += amount;
  gain.elapsedMs = 0;
  fx.gains.push(gain);
}

function freeRow(gains) {
  let row = 0;
  while (gains.some((gain) => gain.row === row)) row += 1;
  return row;
}

// scrollSpeed: velocità del campo, con cui scorrono le scritte dove si è preso il premio
export function updateLootFx(fx, deltaMs, scrollSpeed) {
  ageEffects(fx.picks, fx.pool, deltaMs, FX.lootPick.burstMs, perFrame(scrollSpeed, deltaMs));
  const { holdMs, fadeMs } = FX.lootGain;
  ageEffects(fx.gains, fx.gainPool, deltaMs, holdMs + fadeMs);
}

// A che punto è una scritta vicino agli eroi: 0 finché è ferma, poi sale fino a 1 quando è sparita
export function gainFade(gain) {
  const { holdMs, fadeMs } = FX.lootGain;
  return Math.min(1, Math.max(0, gain.elapsedMs - holdMs) / fadeMs);
}

// Ingrandimento della scritta di un premio preso (con popMs e popScale di FX.lootGain): 1 + popScale appena compare,
// poi torna a 1
export function lootPop(elapsedMs, { popMs, popScale }) {
  return 1 + popScale * Math.max(0, 1 - elapsedMs / popMs);
}
