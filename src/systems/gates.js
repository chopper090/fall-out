import { GATES, LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { GATE_KINDS } from '../data/gates.js';

// Cancelli: compaiono in fondo alla strada, soli o in coppia in due corsie diverse, solo durante le ondate,
// e vengono avanti con il campo. Tipi e numeri li decide l'ondata (gates in data/waves.js, tipi in
// data/gates.js): ogni cancello ha il suo numero (value, negativo finché toglie soldati) e il suo massimo (max). Ogni
// colpo che lo tocca (GATE_HIT, systems/combat.js) lo alza di GATES.perHit, i negativi verso zero e poi oltre, fino
// al massimo; finché non ci arriva ferma i colpi, dopo li lascia passare. plan: la battaglia (systems/waves.js
// battlePlan): con minusOnly ogni cancello è profondo (deep), negativo e da girare, con il numero per deepScale; numeri
// e massimi per hitScale.
// partner: l'altro cancello della coppia, null per un cancello solo; missed: gli eroi l'hanno mancato e va avanti senza
// effetto fino a GATES.despawnZ.
// La prima ondata della partita trova già sulla strada i cancelli degli ultimi secondi, come i nemici.
// Eventi: GATE_PASSED con quello che vale per l'esercito quando ci passano sotto gli eroi
export function createGates(bus, rng, laneCenters, plan) {
  const state = {
    list: [],
    pool: createPool(
      () => ({ kind: null, x: 0, z: 0, value: 0, max: 0, partner: null, missed: false }),
      GATES.poolSize,
    ),
    wave: null,
    spawnsDue: 0,
    headStart: true,
    minusOnly: plan.minusOnly,
    deepScale: plan.deepScale,
    hitScale: plan.hitScale,
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
    gate.value = Math.min(gate.max, gate.value + GATES.perHit);
  });

  return state;
}

// Muove i cancelli con il campo (scrollSpeed unità/s), toglie quelli usciti sotto lo schermo e, durante un'ondata, ne
// fa comparire di nuovi
export function updateGates(state, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  const { list } = state;
  for (const gate of list) gate.z -= step;
  while (list.length > 0 && list[0].z < GATES.despawnZ) state.pool.release(list.shift());

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

// Una coppia in due corsie diverse a caso, oppure un cancello solo in una corsia a caso; un −N da solo solo in una
// corsia esterna, così lo si schiva restando con gli eroi in una delle altre due (una coppia si sceglie sempre).
// Nelle battaglie con minusOnly i tipi si scelgono come sempre, ma ogni cancello diventa profondo
function spawnArrival(state, wave, z) {
  const { rng, laneCenters } = state;
  const { gates } = wave;
  const kindOf = (name) => (state.minusOnly ? 'deep' : name);
  const first = rng.int(laneCenters.length);
  if (rng.float() >= gates.pairChance) {
    const name = kindOf(rng.pick(Object.entries(gates.singles)));
    const outer = rng.int(2) === 0 ? 0 : laneCenters.length - 1;
    spawnGate(state, gates, name, laneCenters[GATE_KINDS[name].malus ? outer : first], z);
    return;
  }
  const second = (first + 1 + rng.int(laneCenters.length - 1)) % laneCenters.length;
  const { kinds } = rng.pick(gates.pairs.map((pair) => [pair, pair.weight]));
  const a = spawnGate(state, gates, kindOf(kinds[0]), laneCenters[first], z);
  const b = spawnGate(state, gates, kindOf(kinds[1]), laneCenters[second], z);
  a.partner = b;
  b.partner = a;
}

// Il numero, a caso tra quelli che l'ondata dà al suo tipo (per deepScale se è profondo), e il massimo che il tipo
// prende dall'ondata, tutti e due per hitScale
function spawnGate(state, gates, name, x, z) {
  const gate = state.pool.acquire();
  const values = gates[name];
  const depth = name === 'deep' ? state.deepScale : 1;
  gate.kind = GATE_KINDS[name];
  gate.x = x;
  gate.z = z;
  gate.value = Math.round(values[state.rng.int(values.length)] * depth * state.hitScale);
  gate.max = Math.round(gates[gate.kind.max] * state.hitScale);
  gate.partner = null;
  gate.missed = false;
  state.list.push(gate);
  return gate;
}

// Va chiamata dopo il combattimento. I cancelli sono in ordine di comparsa: i più vecchi sono i più vicini,
// e i due di una coppia arrivano insieme. Valgono solo per gli eroi, i soldati da soli non ne prendono: un cancello
// si giudica quando arriva alla linea degli eroi (il loro fronte, heroFront, anche dentro una folla grande) e vale per
// l'esercito se ci passa sotto almeno un eroe; preso, sparisce, se no va avanti mancato
export function reachGates(state, army) {
  const reachZ = army.heroFront + GATES.depth / 2;
  let gate = nextGate(state.list);
  while (gate !== undefined && gate.z <= reachZ) {
    pass(state, gate, army);
    gate = nextGate(state.list);
  }
}

// Il più vicino tra quelli che gli eroi non hanno ancora passato
function nextGate(list) {
  return list.find((gate) => !gate.missed);
}

// Gli eroi arrivano al cancello e, se è di una coppia, al suo vicino: quello che prendono vale per l'esercito e
// sparisce, gli altri vanno avanti mancati
function pass(state, gate, army) {
  const taken = takenGate(gate, army, army.x);
  for (const arrived of [gate, gate.partner]) {
    if (arrived === null) continue;
    arrived.missed = true;
    arrived.partner = null;
  }
  if (taken === null) return;
  state.bus.emit(EVENTS.GATE_PASSED, taken);
  state.list.splice(state.list.indexOf(taken), 1);
  state.pool.release(taken);
}

// Il cancello che prendono gli eroi, con il punto guidato in x, arrivando a gate e al suo vicino (partner, se è di
// una coppia), o null: quello sotto cui passa almeno un eroe, anche solo con un bordo. Se passano sotto tutti e due
// vale quello più vicino al centro degli eroi; con il centro esattamente in mezzo vale il peggiore (a pari numero
// gate), così chi non sceglie paga. Lo usa anche il bot del simulatore
export function takenGate(gate, army, x) {
  const { partner } = gate;
  const gateUnder = heroesUnder(gate, army, x);
  if (partner === null || !heroesUnder(partner, army, x)) return gateUnder ? gate : null;
  if (!gateUnder) return partner;
  const center = x + (army.heroRight - army.heroLeft) / 2;
  const gap = Math.abs(gate.x - center) - Math.abs(partner.x - center);
  if (gap !== 0) return gap < 0 ? gate : partner;
  return soldiersFrom(gate, army.size) <= soldiersFrom(partner, army.size) ? gate : partner;
}

// La fila degli eroi con il punto guidato in x, dal bordo del primo a sinistra a quello dell'ultimo a destra, tocca
// la larghezza del cancello
function heroesUnder(gate, army, x) {
  const half = GATES.width / 2;
  return gate.x + half > x - army.heroLeft && gate.x - half < x + army.heroRight;
}

// Un cancello che adesso toglie soldati: si disegna rosso
export function isMalus(gate) {
  return gate.value < 0;
}

// Un cancello che ferma ancora i colpi: non è al suo massimo e gli eroi non l'hanno ancora mancato
export function stopsShots(gate) {
  return !gate.missed && gate.value < gate.max;
}

// Soldati che il cancello dà a un esercito grande size (negativo se ne toglie), senza mai togliere il capo: oltre il
// tetto della folla diventano riserve
export function soldiersFrom({ value }, size) {
  return Math.max(1 - size, value);
}
