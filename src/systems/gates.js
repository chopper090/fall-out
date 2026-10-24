import { GATES, LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { GATE_KINDS } from '../data/gates.js';
import { LIMITS } from '../data/waves.js';

// Cancelli: compaiono in fondo alla strada, soli o in coppia in due corsie diverse, solo durante le ondate,
// e vengono avanti con il campo. Tipi e numeri li decide l'ondata (gates in data/waves.js, tipi in
// data/gates.js). Ogni colpo che tocca un cancello con il numero lo alza di GATES.perHit (i negativi salgono
// verso zero e poi oltre), fino al massimo del cancello (max, dall'ondata: plusMax per i +N, minusMax per i
// negativi); start: il numero con cui è comparso. Al massimo il cancello lascia passare i colpi.
// partner: l'altro cancello della coppia, null per un cancello solo.
// La prima ondata della partita trova già sulla strada i cancelli degli ultimi secondi, come i nemici.
// Eventi: GATE_VALUE_CHANGED con il cancello quando il suo numero cambia, GATE_PASSED con quello che vale per
// l'esercito quando ci passa sotto, GATE_REMOVED con ogni cancello che sparisce
export function createGates(bus, rng, laneCenters) {
  const state = {
    list: [],
    pool: createPool(() => ({ kind: null, x: 0, z: 0, value: 0, start: 0, max: 0, partner: null }), GATES.poolSize),
    wave: null,
    spawnsDue: 0,
    headStart: true,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.WAVE_STARTED, ({ wave }) => {
    state.wave = wave;
    state.spawnsDue = 0;
    if (state.headStart) fillRoad(state, wave);
    state.headStart = false;
  });
  bus.on(EVENTS.WAVE_ENDED, () => {
    state.wave = null;
  });

  bus.on(EVENTS.GATE_HIT, ({ gate }) => {
    if (gate.value >= gate.max) return;
    gate.value = Math.min(gate.max, gate.value + GATES.perHit);
    bus.emit(EVENTS.GATE_VALUE_CHANGED, gate);
  });

  return state;
}

// Muove i cancelli con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa comparire di nuovi
export function updateGates(state, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const gate of state.list) gate.z -= step;

  const { wave } = state;
  if (wave === null) return;
  state.spawnsDue += perFrame(1 / GATES.spawnInterval, deltaMs);
  while (state.spawnsDue >= 1) {
    spawnArrival(state, wave, GATES.spawnDistance);
    state.spawnsDue -= 1;
  }
}

// I cancelli già in arrivo, ognuno dove sarebbe arrivato, dal più vicino fino a quello che compare adesso
// in fondo: la lista resta in ordine di distanza
function fillRoad(state, wave) {
  const spacing = GATES.spawnInterval * wave.scrollSpeed;
  const count = Math.floor((GATES.spawnDistance - LEVEL.headStartZ) / spacing);
  for (let n = count; n >= 0; n--) spawnArrival(state, wave, GATES.spawnDistance - n * spacing);
}

// Una coppia in due corsie diverse a caso, oppure un cancello solo in una corsia a caso
function spawnArrival(state, wave, z) {
  const { rng, laneCenters } = state;
  const { gates } = wave;
  const first = rng.int(laneCenters.length);
  if (rng.float() >= gates.pairChance) {
    spawnGate(state, gates, rng.pick(Object.entries(gates.singles)), laneCenters[first], z);
    return;
  }
  const second = (first + 1 + rng.int(laneCenters.length - 1)) % laneCenters.length;
  const { kinds } = rng.pick(gates.pairs.map((pair) => [pair, pair.weight]));
  const a = spawnGate(state, gates, kinds[0], laneCenters[first], z);
  const b = spawnGate(state, gates, kinds[1], laneCenters[second], z);
  a.partner = b;
  b.partner = a;
}

// Il numero con cui parte e il massimo (solo per plus e minus) vengono dall'ondata
function spawnGate(state, gates, name, x, z) {
  const gate = state.pool.acquire();
  const minus = name === 'minus';
  gate.kind = GATE_KINDS[name];
  gate.x = x;
  gate.z = z;
  gate.max = minus ? gates.minusMax : gates.plusMax;
  gate.value = minus ? gates.minus : Math.min(gate.max, gates.plus);
  gate.start = gate.value;
  gate.partner = null;
  state.list.push(gate);
  return gate;
}

// Va chiamata dopo il combattimento. I cancelli sono in ordine di comparsa: i più vecchi sono i più vicini,
// e i due di una coppia arrivano insieme. Quello che arriva al fronte della folla sparisce; se la folla ci passa
// sotto, anche solo in parte, vale per l'esercito. Di una coppia ne vale uno solo: quello più vicino al centro
// degli eroi; se il centro sta esattamente in mezzo vale il peggiore, così chi non sceglie paga
export function reachGates(state, army) {
  const { list, bus } = state;
  const reachZ = army.front + GATES.depth / 2;
  while (list.length > 0 && list[0].z <= reachZ) {
    const gate = list.shift();
    const { partner } = gate;
    const passed = [gate, partner].filter((candidate) => candidate !== null && isUnder(candidate, army));
    if (passed.length > 0) bus.emit(EVENTS.GATE_PASSED, chosen(passed, army));
    removeGate(state, gate);
    if (partner !== null) {
      list.splice(list.indexOf(partner), 1);
      removeGate(state, partner);
    }
  }
}

function chosen(passed, army) {
  if (passed.length === 1) return passed[0];
  const [a, b] = passed;
  const gap = Math.abs(a.x - army.x) - Math.abs(b.x - army.x);
  if (gap !== 0) return gap < 0 ? a : b;
  return soldiersFrom(a, army.size) <= soldiersFrom(b, army.size) ? a : b;
}

function isUnder(gate, army) {
  return gate.x + GATES.width / 2 > army.x - army.left && gate.x - GATES.width / 2 < army.x + army.right;
}

function removeGate({ pool, bus }, gate) {
  bus.emit(EVENTS.GATE_REMOVED, gate);
  pool.release(gate);
}

// Un cancello che toglie: un malus o un numero ancora negativo. Si disegna rosso
export function isMalus(gate) {
  return gate.kind.malus || (gate.kind.charged && gate.value < 0);
}

// Soldati che il cancello dà a un esercito grande size (negativo se ne toglie), senza mai togliere il capo:
// oltre il tetto della folla diventano riserve; il ×2 ne dà al massimo LIMITS.multiplyMax. La guarigione non
// ne dà
export function soldiersFrom({ kind, value }, size) {
  if (kind.effect === 'add') return Math.max(1 - size, value);
  if (kind.effect === 'multiply') return Math.min(LIMITS.multiplyMax, size * (kind.factor - 1));
  if (kind.effect === 'divide') return Math.ceil(size / kind.factor) - size;
  return 0;
}
