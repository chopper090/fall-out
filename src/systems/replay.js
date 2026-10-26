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
// updateBattle; inputs, i comandi con il frame prima del quale sono arrivati, [frame, 'steer', dx], [frame,
// 'steerEnd'], [frame, 'tweaks', ritocchi] (cambiati a metà battaglia, dal menu della pausa o dal pannello di
// sviluppo: da lì valgono questi, sempre come differenza da quelli di partenza) e [frame, 'end', vinta] (il trucco del
// pannello che la finisce, endBattle); result, il risultato della battaglia finita (battleResult), null finché non
// finisce. Il formato 2 ha in più i comandi tweaks ed end: uno del formato 1 si legge uguale
const TWEAKS = 'tweaks';
const END = 'end';
// Per ogni registrazione, i ritocchi dell'ultima volta che li si è guardati, in JSON
const lastTweaks = new WeakMap();

// La registrazione di una battaglia che sta per partire con il seme seed e il loadout: si prende prima di crearla, con
// i ritocchi di adesso
export function startReplay(seed, loadout) {
  const { version, commit } = BUILD;
  const { format } = DEBUG.replay;
  const tweaks = tweaksDiff();
  const replay = {
    format,
    version,
    commit,
    seed,
    loadout: plain(loadout),
    tweaks,
    frames: [],
    inputs: [],
    result: null,
  };
  lastTweaks.set(replay, JSON.stringify(tweaks));
  return replay;
}

// Da qui la registrazione replay segue la battaglia battle, appena creata con il suo seme e il suo loadout: i comandi
// che arrivano sul suo bus, con il frame a cui sono arrivati, e alla fine il risultato, poi onEnd(replay). A battaglia
// finita i comandi non contano più
export function watchReplay(replay, battle, onEnd = () => {}) {
  const { bus } = battle;
  bus.on(EVENTS.STEER, (dx) => record(replay, battle.frame, EVENTS.STEER, dx));
  bus.on(EVENTS.STEER_END, () => record(replay, battle.frame, EVENTS.STEER_END));
  const end = () => {
    replay.result = battleResult(battle);
    onEnd(replay);
  };
  bus.on(EVENTS.MISSION_FAILED, end);
  bus.on(EVENTS.MISSION_COMPLETED, end);
}

// Un frame lungo deltaMs, da segnare subito prima che la battaglia lo giochi (con i ritocchi cambiati nel frattempo)
export function recordFrame(replay, deltaMs) {
  noteTweaks(replay, replay.frames.length);
  replay.frames.push(deltaMs);
}

// La battaglia battle finisce adesso come finirebbe davvero (il trucco del pannello di sviluppo): vinta (won) come al
// completamento del livello, persa come alla morte del capo. La registrazione replay che la segue lo segna come un
// comando, prima, così rigiocandola finisce allo stesso frame
export function endBattle(battle, won, replay = null) {
  if (replay !== null) record(replay, battle.frame, END, won);
  const { bus, army, waves } = battle;
  if (won) bus.emit(EVENTS.LEVEL_COMPLETED, waves);
  else bus.emit(EVENTS.HERO_HIT, { hero: army.leader, damage: army.leader.hp });
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

// La battaglia della registrazione, frame per frame, con prima i comandi arrivati prima di ognuno; dopo l'ultimo frame
// quelli arrivati dopo (il trucco che l'ha finita lì)
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
  const commands = () => {
    for (; next < inputs.length && inputs[next][0] <= battle.frame; next++) command(battle, inputs[next]);
  };
  for (const deltaMs of frames) {
    if (battle.over) break;
    commands();
    updateBattle(battle, deltaMs);
  }
  if (!battle.over) commands();
  return { result, framesPlayed: battle.frame };
}

// Un comando registrato, rifatto sulla battaglia battle
function command(battle, [, name, value]) {
  if (name === TWEAKS) applyTweaks(value);
  else if (name === END) endBattle(battle, value);
  else battle.bus.emit(name, value);
}

// Il comando (name, value) arrivato prima del frame frame entra nella registrazione replay, se la battaglia non è
// finita; prima, se sono cambiati, i ritocchi di adesso
function record(replay, frame, name, value) {
  if (replay.result !== null) return;
  noteTweaks(replay, frame);
  replay.inputs.push(value === undefined ? [frame, name] : [frame, name, value]);
}

// I ritocchi di adesso, se non sono più quelli dell'ultima volta, entrano nella registrazione replay come un comando
// arrivato prima del frame frame
function noteTweaks(replay, frame) {
  const tweaks = tweaksDiff();
  const text = JSON.stringify(tweaks);
  if (replay.result !== null || text === lastTweaks.get(replay)) return;
  lastTweaks.set(replay, text);
  replay.inputs.push([frame, TWEAKS, tweaks]);
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
