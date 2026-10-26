import { DEBUG } from '../config/balance.js';
import { BUILD } from '../core/build.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { applyTweaks, tweaksDiff } from '../core/tweaks.js';
import { battleResult, createBattle, updateBattle } from './battle.js';

// Battaglie rigiocabili: quello che serve per rifare una battaglia uguale, senza disegno (su V8, il motore di Chrome,
// di Edge e di node, i conti tornano identici). Il tempo dei frame resta quello vero del telefono, a 60, 90 o 120 al
// secondo: si registra com'era. Una battaglia registrata (replay) ha format, la versione di questo formato
// (DEBUG.replay.format); version e commit del gioco (core/build.js); seed e loadout (in JSON semplice) della battaglia;
// tweaks, i ritocchi globali diversi da quelli di partenza (core/tweaks.js); frames, la durata di ogni frame passata a
// updateBattle; inputs, i comandi con il frame prima del quale sono arrivati, [frame, 'steer', dx] e [frame,
// 'steerEnd']; result, il risultato della battaglia finita (battleResult), null finché non finisce

// La registrazione di una battaglia che sta per partire con il seme seed e il loadout: si prende prima di crearla, con
// i ritocchi di adesso
export function startReplay(seed, loadout) {
  const { version, commit } = BUILD;
  const { format } = DEBUG.replay;
  const tweaks = tweaksDiff();
  return { format, version, commit, seed, loadout: plain(loadout), tweaks, frames: [], inputs: [], result: null };
}

// Da qui la registrazione replay segue la battaglia battle, appena creata con il suo seme e il suo loadout: i comandi
// che arrivano sul suo bus, con il frame a cui sono arrivati, e alla fine il risultato, poi onEnd(replay). A battaglia
// finita i comandi non contano più
export function watchReplay(replay, battle, onEnd = () => {}) {
  const { bus } = battle;
  const input = (...command) => {
    if (replay.result === null) replay.inputs.push([battle.frame, ...command]);
  };
  bus.on(EVENTS.STEER, (dx) => input(EVENTS.STEER, dx));
  bus.on(EVENTS.STEER_END, () => input(EVENTS.STEER_END));
  const end = () => {
    replay.result = battleResult(battle);
    onEnd(replay);
  };
  bus.on(EVENTS.MISSION_FAILED, end);
  bus.on(EVENTS.MISSION_COMPLETED, end);
}

// Un frame lungo deltaMs, da segnare subito prima che la battaglia lo giochi
export function recordFrame(replay, deltaMs) {
  replay.frames.push(deltaMs);
}

// Rigioca replay senza disegno: con i suoi ritocchi globali (poi tornano com'erano) la battaglia del suo seme e del suo
// loadout, e per ogni frame prima i suoi comandi e poi il frame, fino alla fine della battaglia o dei frame. Il
// risultato si prende quando finisce la missione, come nel gioco. Restituisce il risultato (null se non è finita), i
// frame giocati (framesPlayed) e i ritocchi che questa versione del gioco non conosce
export function playReplay(replay) {
  const before = tweaksDiff();
  const unknown = applyTweaks(replay.tweaks);
  try {
    return { ...play(replay), unknown };
  } finally {
    applyTweaks(before);
  }
}

// La prima differenza tra la battaglia registrata replay e quella rigiocata (played, da playReplay), confrontate come
// JSON: dopo quanti frame sono finite (frames), poi il risultato campo per campo. { path: dove, expected: com'era,
// actual: com'è ora }, o null se sono uguali
export function replayDifference(replay, played) {
  const expected = plain({ frames: replay.frames.length, result: replay.result });
  return firstDifference(expected, plain({ frames: played.framesPlayed, result: played.result }), '');
}

function play({ seed, loadout, frames, inputs }) {
  const bus = createEventBus();
  const battle = createBattle(seed, bus, plain(loadout));
  let result = null;
  const end = () => {
    result = battleResult(battle);
  };
  bus.on(EVENTS.MISSION_FAILED, end);
  bus.on(EVENTS.MISSION_COMPLETED, end);
  let next = 0;
  for (const deltaMs of frames) {
    if (battle.over) break;
    for (; next < inputs.length && inputs[next][0] <= battle.frame; next++) {
      const [, name, value] = inputs[next];
      bus.emit(name, value);
    }
    updateBattle(battle, deltaMs);
  }
  return { result, framesPlayed: battle.frame };
}

function firstDifference(expected, actual, path) {
  const isObject = (value) => typeof value === 'object' && value !== null;
  if (!isObject(expected) || !isObject(actual)) return expected === actual ? null : { path, expected, actual };
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const found = firstDifference(expected[key], actual[key], path === '' ? key : `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

// Una copia in JSON semplice, come la si scrive in un file
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
