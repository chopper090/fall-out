import { LANES, LOOT } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { createRng } from '../core/rng.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { DROPS } from '../data/rewards.js';

// I tipi di premio che i nemici lasciano, tranne i frammenti, che si contano per eroe
const COUNTED = [...new Set(Object.values(DROPS).flatMap((drops) => drops.map((drop) => drop.kind)))].filter(
  (kind) => kind !== 'fragments',
);

// Bottino della battaglia: quando muore un nemico con dei premi (DROPS in data/rewards.js) ognuno che esce cade in
// strada dove è morto, in fila dietro gli altri dello stesso nemico (a LOOT.spread), e viene avanti con il campo; a
// campo fermo (il boss) scivola da solo verso l'esercito a LOOT.ownSpeed. Lo prende l'esercito che ci passa sopra, come
// un cancello; se lo supera è perso. Ogni premio: kind (uno dei tipi di DROPS: le scorte, l'esperienza o i
// frammenti), amount e, per i frammenti, hero (l'id di un eroe schierato a caso, tra heroIds). collected: quanto preso
// finora per tipo (i frammenti per eroe). Il bottino ha un suo seme (quello della battaglia più LOOT.seedOffset): non
// tocca la sequenza casuale del resto della battaglia; i premi in strada però contano come oggetti sulla strada, e il
// boss e la fine del livello li aspettano. Eventi: LOOT_COLLECTED con il premio preso, prima che torni nella sua pool
export function createLoot(bus, seed, heroIds) {
  const state = {
    list: [],
    pool: createPool(() => ({ kind: null, amount: 0, hero: null, x: 0, z: 0 }), LOOT.poolSize),
    collected: { ...Object.fromEntries(COUNTED.map((kind) => [kind, 0])), fragments: {} },
    bus,
  };
  const rng = createRng(seed + LOOT.seedOffset);
  const dropsOf = new Map(Object.entries(DROPS).map(([name, drops]) => [ENEMY_TYPES[name], drops]));
  bus.on(EVENTS.ENEMY_KILLED, (enemy) => {
    const drops = dropsOf.get(enemy.type);
    if (drops === undefined) return;
    const out = drops.filter((drop) => rng.float() < drop.chance);
    const half = LOOT.width / 2;
    out.forEach((drop, index) => {
      const item = state.pool.acquire();
      item.kind = drop.kind;
      item.amount = drop.amount;
      item.hero = drop.kind === 'fragments' ? heroIds[rng.int(heroIds.length)] : null;
      item.x = Math.min(LANES.fieldWidth - half, Math.max(half, enemy.x));
      item.z = enemy.z + index * LOOT.spread;
      state.list.push(item);
    });
  });
  return state;
}

// Muove i premi con il campo (scrollSpeed unità/s), o da soli se il campo è fermo
export function updateLoot(state, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed > 0 ? scrollSpeed : LOOT.ownSpeed, deltaMs);
  for (const item of state.list) item.z -= step;
}

// Il premio arrivato al fronte dell'esercito è preso se gli sta sopra anche solo con un bordo, altrimenti è perso
export function reachLoot(state, army) {
  const { list, pool, collected, bus } = state;
  const reachZ = army.front + LOOT.depth / 2;
  for (let index = list.length - 1; index >= 0; index--) {
    const item = list[index];
    if (item.z > reachZ) continue;
    const under = item.x + LOOT.width / 2 > army.x - army.left && item.x - LOOT.width / 2 < army.x + army.right;
    if (under && item.kind === 'fragments') {
      collected.fragments[item.hero] = (collected.fragments[item.hero] ?? 0) + item.amount;
    } else if (under) {
      collected[item.kind] += item.amount;
    }
    if (under) bus.emit(EVENTS.LOOT_COLLECTED, item);
    list.splice(index, 1);
    pool.release(item);
  }
}
