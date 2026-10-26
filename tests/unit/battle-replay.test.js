import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checker } from '../support/check.js';
import { ARMY, CONTROLS, DEBUG, TEST_BATTLE } from '../../src/config/balance.js';
import { EVENTS } from '../../src/core/events.js';
import { createRng } from '../../src/core/rng.js';
import { applyTweaks, tweaksDiff } from '../../src/core/tweaks.js';
import { STARTING_LOADOUT } from '../../src/data/loadout.js';
import { createBot, updateBot } from '../../src/sim/bot.js';
import { createBattle, updateBattle } from '../../src/systems/battle.js';
import {
  endBattle,
  playReplay,
  recordFrame,
  replayDifference,
  startReplay,
  watchReplay,
} from '../../src/systems/replay.js';

// Battaglie rigiocabili (B11, systems/replay.js): una battaglia registrata mentre si gioca, con il seme, il loadout, i
// ritocchi del pannello, la durata di ogni frame e i comandi, si rigioca senza grafica fino allo stesso risultato

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Registrata nel browser dalla prova lengths (tests/e2e): se la battaglia cambia apposta, la si registra di nuovo
// (Copia l'ultima battaglia nel pannello di sviluppo, o tests/e2e/out/410-battaglia.json dopo la prova) e la si
// mette qui
const FIXTURE = `${ROOT}tests/fixtures/replay-corta.json`;
// Frame da 7 a 34 ms: un telefono da 30 a 144 frame al secondo, che non tiene il passo
const FRAME = { min: 7, spread: 27 };
// Ogni quanti frame il dito si alza
const LIFT_EVERY = 41;
const json = (value) => JSON.parse(JSON.stringify(value));
// Le impostazioni dei comandi di partenza, come le lascia applyTweaks({})
const DEFAULT_CONTROLS = (() => {
  applyTweaks({});
  return { sensitivity: CONTROLS.sensitivity, snapEnabled: CONTROLS.snapEnabled };
})();
const pathOf = (difference) => difference?.path ?? 'nessuna';

// Una battaglia corta del bot registrata come nel gioco: i comandi li manda il bot (STEER) e ogni tanto un dito che si
// alza (STEER_END), ogni frame dura quanto vuole un seme suo. Il file è la registrazione in JSON, come la copia il
// pannello. before(battle, replay), se c'è, prima di ogni frame: quello che fa il giocatore fuori dalla battaglia
function botBattle(seed, before = () => {}) {
  const loadout = { ...STARTING_LOADOUT, rules: { length: 'short' } };
  const replay = startReplay(seed, loadout);
  const battle = createBattle(seed, undefined, loadout);
  watchReplay(replay, battle);
  const bot = createBot(1000 / 60);
  const rng = createRng(seed);
  while (!battle.over && battle.ms < 400000) {
    before(battle, replay);
    if (battle.over) break;
    updateBot(bot, battle);
    if (battle.frame % LIFT_EVERY === LIFT_EVERY - 1) battle.bus.emit(EVENTS.STEER_END);
    const deltaMs = FRAME.min + rng.float() * FRAME.spread;
    recordFrame(replay, deltaMs);
    updateBattle(battle, deltaMs);
  }
  return { battle, replay, file: json(replay) };
}

const count = (replay, name) => replay.inputs.filter((input) => input[1] === name).length;
const outcome = ({ result }) => `${result.completed ? 'compiuta' : 'fallita'} all'ondata ${result.wave}`;

// La battaglia del bot, registrata e scritta in JSON, si rigioca identica: stessi frame e stesso risultato, campo per
// campo, con il seme nel risultato. Cambiando un frame, il seme o togliendo i comandi la differenza si vede
test('Battaglia rigiocabile: una battaglia del bot registrata in JSON si rigioca identica', (t) => {
  const check = checker(t);
  const seed = 7;
  const { battle, replay, file } = botBattle(seed);
  const played = playReplay(file);
  const difference = replayDifference(file, played);
  check(
    `bot, seme ${seed}: ${replay.frames.length} frame da ${FRAME.min} a ${FRAME.min + FRAME.spread} ms (la battaglia ne ha giocati ${battle.frame}), ${count(replay, EVENTS.STEER)} steer e ${count(replay, EVENTS.STEER_END)} steerEnd, ${outcome(replay)}, seme nel risultato ${replay.result.seed}; rigiocata dal JSON: ${played.framesPlayed} frame, differenza ${pathOf(difference)}`,
    replay.frames.length === battle.frame &&
      count(replay, EVENTS.STEER) > 0 &&
      count(replay, EVENTS.STEER_END) > 0 &&
      replay.result.seed === seed &&
      played.framesPlayed === battle.frame &&
      difference === null,
  );
  const middle = Math.floor(file.frames.length / 2);
  const slower = { ...file, frames: file.frames.map((ms, index) => (index === middle ? ms + 5 : ms)) };
  const reseeded = { ...file, seed: seed + 1 };
  const still = { ...file, inputs: [] };
  const changes = [slower, reseeded, still].map((changed) => replayDifference(changed, playReplay(changed)));
  check(
    `cambiato: un frame di 5 ms più lungo → ${pathOf(changes[0])}; un altro seme → ${pathOf(changes[1])}; senza comandi → ${pathOf(changes[2])}`,
    changes.every((change) => change !== null),
  );
  check.done();
});

// I ritocchi del pannello (core/tweaks.js) si registrano come differenza dai valori di partenza, cartella per cartella,
// e rigiocando si rimettono: senza, la battaglia viene diversa. Dopo, i valori tornano com'erano prima di rigiocare;
// quelli che questa versione non conosce si dicono
test('Battaglia rigiocabile: i ritocchi del pannello si registrano e si rimettono per rigiocarla', (t) => {
  const check = checker(t);
  const titles = DEBUG.folders.map((folder) => folder.title);
  const untouched = JSON.stringify(tweaksDiff());
  ARMY.startSize = 6;
  TEST_BATTLE.enemyHpScale = 1.5;
  CONTROLS.sensitivity = 1.5;
  const { file } = botBattle(5);
  applyTweaks({});
  const reset = [ARMY.startSize, TEST_BATTLE.enemyHpScale, CONTROLS.sensitivity].join(' ');
  CONTROLS.snapRadius = 50;
  const difference = replayDifference(file, playReplay(file));
  const after = [ARMY.startSize, TEST_BATTLE.enemyHpScale, CONTROLS.sensitivity, CONTROLS.snapRadius].join(' ');
  const bare = { ...file, tweaks: {} };
  const without = replayDifference(bare, playReplay(bare));
  const unknown = applyTweaks({ 'Cartella vecchia': { speed: 2 }, Esercito: { gone: 3 } });
  applyTweaks({});
  check(
    `cartelle del pannello ${titles.length}, titoli tutti diversi ${new Set(titles).size === titles.length}; ritocchi a inizio prova ${untouched}; registrati ${JSON.stringify(file.tweaks)}; rimessi a posto ${reset}; rigiocata con i ritocchi: differenza ${pathOf(difference)}, dopo ${after}; senza i ritocchi: ${pathOf(without)}; sconosciuti ${unknown.join(', ')}`,
    new Set(titles).size === titles.length &&
      untouched === '{}' &&
      JSON.stringify(file.tweaks) ===
        JSON.stringify({ 'Difficoltà di prova': { enemyHpScale: 1.5 }, Comandi: { sensitivity: 1.5 }, Esercito: { startSize: 6 } }) &&
      reset === '1 1 1' &&
      difference === null &&
      after === '1 1 1 50' &&
      without !== null &&
      unknown.join() === 'Cartella vecchia.speed,Esercito.gone' &&
      CONTROLS.snapRadius !== 50,
  );
  check.done();
});

// Una battaglia vera, registrata nel browser con il dito e con le frecce sul tempo dei frame di Edge, si rigioca in
// node identica: con le funzioni e con il comando npm run replay, che scrive ok
test('Battaglia rigiocabile: quella registrata nel browser si rigioca uguale, anche con npm run replay', (t) => {
  const check = checker(t);
  const replay = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const played = playReplay(replay);
  const difference = replayDifference(replay, played);
  const shortest = Math.min(...replay.frames).toFixed(2);
  const longest = Math.max(...replay.frames).toFixed(2);
  const cli = spawnSync(process.execPath, ['src/sim/replay.js', FIXTURE], { cwd: ROOT, encoding: 'utf8' });
  const last = cli.stdout.trim().split('\n').at(-1);
  check(
    `dal browser (v${replay.version} · ${replay.commit}): seme ${replay.seed}, ${replay.frames.length} frame da ${shortest} a ${longest} ms, ${count(replay, EVENTS.STEER)} steer e ${count(replay, EVENTS.STEER_END)} steerEnd, ${outcome(replay)}; rigiocata: ${played.framesPlayed} frame, differenza ${pathOf(difference)}; npm run replay: «${last}» (uscita ${cli.status})`,
    difference === null && played.framesPlayed === replay.frames.length && cli.status === 0 && last.startsWith('ok'),
  );
  check.done();
});

// Revisione. Le impostazioni cambiate nella pausa a metà battaglia (sensibilità e aggancio dello swipe, poi la
// battaglia riparte con il dito alzato, come in scenes/Battle.js) si registrano al loro frame, prima del dito alzato, e
// rigiocando si rimettono lì: la battaglia torna uguale (senza quei comandi no). Un ritocco del pannello senza pausa si
// registra prima del frame che viene. Una battaglia finita dal trucco del pannello, vinta o persa (endBattle), si
// rigioca fino allo stesso frame e allo stesso risultato
test('Battaglia rigiocabile: ritocchi cambiati a metà e battaglia finita dal trucco si rigiocano uguali', (t) => {
  const check = checker(t);
  const pause = 300;
  const panel = 600;
  const retune = (battle) => {
    if (battle.frame === pause) {
      battle.bus.emit(EVENTS.GAME_PAUSED);
      CONTROLS.sensitivity = 1.5;
      CONTROLS.snapEnabled = false;
      battle.bus.emit(EVENTS.GAME_RESUMED);
      battle.bus.emit(EVENTS.STEER_END);
    }
    if (battle.frame === panel) CONTROLS.sensitivity = 0.8;
  };
  const { file } = botBattle(7, retune);
  applyTweaks({});
  const tweaks = file.inputs.filter((input) => input[1] === 'tweaks');
  const atPause = file.inputs.findIndex((input) => input[0] === pause && input[1] === 'tweaks');
  const liftAfter = file.inputs[atPause + 1];
  const difference = replayDifference(file, playReplay(file));
  const bare = { ...file, inputs: file.inputs.filter((input) => input[1] !== 'tweaks') };
  const without = replayDifference(bare, playReplay(bare));
  const after = [CONTROLS.sensitivity, CONTROLS.snapEnabled].join(' ');
  const ended = [true, false].map((won) => {
    const { replay } = botBattle(11, (battle, recording) => {
      if (battle.frame === 200) endBattle(battle, won, recording);
    });
    const played = playReplay(json(replay));
    return { won, replay, played, difference: replayDifference(json(replay), played) };
  });
  check(
    `ritocchi a metà: ${tweaks.map((input) => `al frame ${input[0]} ${JSON.stringify(input[2])}`).join(', ')}; poi ${JSON.stringify(liftAfter)}; rigiocata: differenza ${pathOf(difference)}, senza quei comandi ${pathOf(without)}; dopo, impostazioni ${after}; finita dal trucco: ${ended.map((e) => `${e.won ? 'vinta' : 'persa'} al frame ${e.replay.frames.length} (${outcome(e.replay)}), rigiocata in ${e.played.framesPlayed} frame, differenza ${pathOf(e.difference)}`).join('; ')}`,
    tweaks.length === 2 &&
      tweaks[0][0] === pause &&
      JSON.stringify(tweaks[0][2]) === JSON.stringify({ Comandi: { sensitivity: 1.5, snapEnabled: false } }) &&
      tweaks[1][0] === panel &&
      tweaks[1][2].Comandi.sensitivity === 0.8 &&
      JSON.stringify(liftAfter) === JSON.stringify([pause, EVENTS.STEER_END]) &&
      difference === null &&
      without !== null &&
      after === `${DEFAULT_CONTROLS.sensitivity} ${DEFAULT_CONTROLS.snapEnabled}` &&
      ended.every(
        (e) =>
          e.replay.frames.length === 200 &&
          e.replay.result.completed === e.won &&
          e.played.framesPlayed === 200 &&
          e.difference === null,
      ),
  );
  check.done();
});
