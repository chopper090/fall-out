import { CHESTS, GATES } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { CHEST_KINDS } from '../data/chests.js';

// Scrigni: solo durante le ondate, uno ogni CHESTS.everyGates arrivi di cancelli, a metà tra due arrivi, al centro
// di una corsia a caso; vengono avanti con il campo. Ricompensa e colpi per aprirli li decide l'ondata (chests in
// data/waves.js, ricompense in data/chests.js; ogni ricompensa chiede i colpi dell'ondata per il suo value, e per
// hitScale, che cresce con la battaglia come i colpi che spara l'esercito). Ogni
// CHEST_HIT toglie uno a hits, i colpi che mancano (un colpo ne manda uno, o weapon.gateHits con la fucina:
// systems/combat.js): a zero lo scrigno si apre e dà la sua ricompensa. Se arriva chiuso al fronte della folla è perso.
// gatesElapsed: intervalli dei cancelli passati dall'inizio dell'ondata; nextAt: quando arriva il prossimo scrigno
// Eventi: CHEST_OPENED con lo scrigno aperto, CHEST_REMOVED con ogni scrigno che sparisce, aperto o perso
export function createChests(bus, rng, laneCenters, hitScale) {
  const state = {
    list: [],
    pool: createPool(() => ({ kind: null, x: 0, z: 0, hits: 0 }), CHESTS.poolSize),
    wave: null,
    gatesElapsed: 0,
    nextAt: 0,
    hitScale,
    bus,
    rng,
    laneCenters,
  };

  // Il primo arriva dopo firstAfterGates intervalli dei cancelli dall'inizio dell'ondata: nella prima a metà tra due
  // arrivi di cancelli, nelle altre prima del primo cancello
  bus.on(EVENTS.WAVE_STARTED, ({ wave }) => {
    state.wave = wave;
    state.gatesElapsed = 0;
    state.nextAt = CHESTS.firstAfterGates;
  });
  bus.on(EVENTS.WAVE_ENDED, () => {
    state.wave = null;
  });

  // Uno scrigno già aperto (non più in strada) non conta: un colpo che conta più volte si ferma lì
  bus.on(EVENTS.CHEST_HIT, ({ chest }) => {
    const index = state.list.indexOf(chest);
    if (index < 0) return;
    chest.hits -= 1;
    if (chest.hits > 0) return;
    bus.emit(EVENTS.CHEST_OPENED, chest);
    state.list.splice(index, 1);
    removeChest(state, chest);
  });

  return state;
}

// Muove gli scrigni con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa arrivare di nuovi
export function updateChests(state, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const chest of state.list) chest.z -= step;

  const { wave } = state;
  if (wave === null) return;
  state.gatesElapsed += perFrame(1 / GATES.spawnInterval, deltaMs);
  while (state.gatesElapsed >= state.nextAt) {
    spawnChest(state, wave.chests);
    state.nextAt += CHESTS.everyGates;
  }
}

// Va chiamata dopo il combattimento. Gli scrigni sono in ordine di arrivo: quello che arriva al fronte della folla
// ancora chiuso è perso
export function reachChests(state, army) {
  const { list } = state;
  const reachZ = army.front + CHESTS.depth / 2;
  while (list.length > 0 && list[0].z <= reachZ) removeChest(state, list.shift());
}

// Ricompensa scelta con le probabilità dell'ondata; i colpi in proporzione a quanto vale
function spawnChest(state, { hits, rewards }) {
  const { rng, laneCenters, pool, list } = state;
  const chest = pool.acquire();
  chest.kind = CHEST_KINDS[rng.pick(Object.entries(rewards))];
  chest.x = laneCenters[rng.int(laneCenters.length)];
  chest.z = CHESTS.spawnDistance;
  chest.hits = Math.max(1, Math.round(hits * chest.kind.value * state.hitScale));
  list.push(chest);
}

function removeChest({ pool, bus }, chest) {
  bus.emit(EVENTS.CHEST_REMOVED, chest);
  pool.release(chest);
}
