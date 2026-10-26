import { test } from 'node:test';
import { checker } from '../support/check.js';
import { DEBUG, LOOT, SAVE } from '../../src/config/balance.js';
import { MIGRATIONS } from '../../src/core/save.js';
import { CHEST_KINDS } from '../../src/data/chests.js';
import { ENEMY_TYPES } from '../../src/data/enemies.js';
import { GATE_KINDS } from '../../src/data/gates.js';
import { HEROES, LINEUP } from '../../src/data/heroes.js';
import { DROPS, REWARDS } from '../../src/data/rewards.js';
import { ROAD } from '../../src/data/road.js';
import { VILLAGE } from '../../src/data/village.js';
import { BATTLE_TYPES, DEFAULT_TYPE, WAVES } from '../../src/data/waves.js';
import { WORLD } from '../../src/data/world.js';
import { createProfile } from '../../src/meta/profile.js';

// Controllo dei dati: ogni nome che un dato usa esiste davvero, i numeri stanno dove il gioco se li aspetta e le
// probabilità di ogni scelta fanno 1. Un errore qui si vedrebbe solo giocando, o romperebbe il pannello di sviluppo
const EPSILON = 1e-9;
const sumsToOne = (weights) => Math.abs(weights.reduce((sum, w) => sum + w, 0) - 1) < EPSILON;
const missing = (names, known) => names.filter((name) => !(name in known));

test('Pannello di sviluppo: ogni cursore ha il suo valore, dentro i suoi limiti', (t) => {
  const check = checker(t);
  const wrong = [];
  for (const { title, target, fields } of DEBUG.folders) {
    for (const [key, options] of Object.entries(fields)) {
      const value = target[key];
      const outside =
        typeof value === 'number' && ((options.min ?? -Infinity) > value || value > (options.max ?? Infinity));
      if (!(key in target) || outside) wrong.push(`${title}.${key}=${value}`);
    }
  }
  check(
    `pannello: ${DEBUG.folders.length} cartelle, valori mancanti o fuori dai limiti ${wrong.join(', ') || 'nessuno'}`,
    wrong.length === 0,
  );
  check.done();
});

test('Ondate: nemici, cancelli e scrigni esistono e le probabilità fanno 1', (t) => {
  const check = checker(t);
  const wrong = [];
  WAVES.forEach((wave, index) => {
    const name = `ondata ${index + 1}`;
    const specials = Object.values(wave.specials).reduce((sum, chance) => sum + chance, 0);
    if (missing(Object.keys(wave.specials), ENEMY_TYPES).length || specials > 1) wrong.push(`${name} nemici`);
    const { plus, minus, singles, pairs } = wave.gates;
    if (!plus.every((n) => n > 0) || !minus.every((n) => n < 0)) wrong.push(`${name} numeri dei cancelli`);
    if (missing(Object.keys(singles), GATE_KINDS).length || !sumsToOne(Object.values(singles)))
      wrong.push(`${name} singoli`);
    const pairKinds = pairs.flatMap((pair) => pair.kinds);
    if (missing(pairKinds, GATE_KINDS).length || !sumsToOne(pairs.map((pair) => pair.weight)))
      wrong.push(`${name} coppie`);
    const rewards = wave.chests.rewards;
    if (missing(Object.keys(rewards), CHEST_KINDS).length || !sumsToOne(Object.values(rewards)))
      wrong.push(`${name} scrigni`);
  });
  check(`ondate: ${WAVES.length}, sbagliate ${wrong.join(', ') || 'nessuna'}`, wrong.length === 0);
  check.done();
});

test('Premi: i nemici che lasciano premi esistono, ogni premio si sa disegnare e scrivere', (t) => {
  const check = checker(t);
  const kinds = [
    ...new Set(
      Object.values(DROPS)
        .flat()
        .map((drop) => drop.kind),
    ),
  ];
  const enemies = missing(Object.keys(DROPS), ENEMY_TYPES);
  const drawn = kinds.filter((kind) => !(kind in LOOT.colors) || !(kind in LOOT.words));
  const chances = Object.values(DROPS)
    .flat()
    .filter((drop) => !(drop.chance > 0 && drop.chance <= 1)).length;
  check(
    `premi: ${kinds.join(' ')}; nemici sconosciuti ${enemies.join(' ') || 'nessuno'}, senza colore o scritta ` +
      `${drawn.join(' ') || 'nessuno'}, probabilità sbagliate ${chances}`,
    !enemies.length && !drawn.length && !chances,
  );
  check.done();
});

test('Risorse: premi della vittoria, raccolte e conquiste vanno in risorse che il profilo conosce', (t) => {
  const check = checker(t);
  const { resources } = createProfile();
  const known = { ...resources, fragments: 0 };
  const victory = missing(Object.keys(REWARDS.victory), { ...known, xp: 0 });
  const collect = missing(Object.keys(ROAD.collect), known);
  const { perArea, ...base } = ROAD.conquest;
  const conquest = missing([...Object.keys(base), ...Object.keys(perArea)], known);
  check(
    `risorse ${Object.keys(resources).join(' ')}; sconosciute nella vittoria ${victory.join(' ') || 'nessuna'}, ` +
      `nelle raccolte ${collect.join(' ') || 'nessuna'}, nelle conquiste ${conquest.join(' ') || 'nessuna'}`,
    !victory.length && !collect.length && !conquest.length,
  );
  check.done();
});

test('Tipi e schieramento: ogni tipo nominato esiste, ha le ondate che servono e i boss in corsie vere, ogni eroe esiste', (t) => {
  const check = checker(t);
  const named = [DEFAULT_TYPE, ...ROAD.cadence.map(({ type }) => type)];
  const types = missing(named, BATTLE_TYPES);
  const tooLong = Object.entries(BATTLE_TYPES)
    .filter(([, type]) => type.waves > WAVES.length)
    .map(([name]) => name);
  const offLane = Object.entries(BATTLE_TYPES)
    .filter(([, type]) => type.bosses.flat().some(({ lane }) => !Number.isInteger(lane) || lane < 0 || lane > 2))
    .map(([name]) => name);
  const heroes = missing(
    LINEUP.map((slot) => slot.hero),
    HEROES,
  );
  check(
    `tipi ${Object.keys(BATTLE_TYPES).join(' ')}; sconosciuti ${types.join(' ') || 'nessuno'}, con più ondate di ` +
      `quelle che ci sono ${tooLong.join(' ') || 'nessuno'}, con boss fuori corsia ${offLane.join(' ') || 'nessuno'}; ` +
      `eroi dello schieramento sconosciuti ${heroes.join(' ') || 'nessuno'}`,
    !types.length && !tooLong.length && !offLane.length && !heroes.length,
  );
  check.done();
});

test('Salvataggio: una migrazione per ogni versione del formato dopo la prima', (t) => {
  const check = checker(t);
  const functions = MIGRATIONS.filter((migration) => typeof migration === 'function').length;
  check(
    `salvataggio: versione ${SAVE.version}, migrazioni ${MIGRATIONS.length} (attese ${SAVE.version - 1}), ` +
      `funzioni ${functions}`,
    MIGRATIONS.length === SAVE.version - 1 && functions === MIGRATIONS.length,
  );
  check.done();
});

// Revisione. Il villaggio: ogni edificio ha costo e minuti per ognuno dei suoi livelli, e così ogni sua tabella per
// livello (razioni l'ora, tetto, soldati, danno, cadenza, operai); ogni numero è finito e non negativo; i posti
// cantiere sono un numero intero tra 1 e uno per edificio; il lanciatore che mira arriva a un livello che c'è; il
// centro città chiede solo livelli che si possono avere e parte dentro il villaggio. Un numero che manca
// aprirebbe un cantiere che non finisce mai (endsAt NaN), riscritto a ogni secondo e perso ricaricando
test('Villaggio: ogni livello ha i suoi numeri', (t) => {
  const check = checker(t);
  const PER_LEVEL = ['minutes', 'rationsPerHour', 'storage', 'soldiers', 'damage', 'fireRate', 'workers'];
  const valid = (value) => Number.isFinite(value) && value >= 0;
  // Un costo paga solo scorte del villaggio (quelle di VILLAGE.start), ognuna con un numero valido
  const validCost = (cost) =>
    cost !== null &&
    typeof cost === 'object' &&
    Object.entries(cost).every(([kind, amount]) => Object.hasOwn(VILLAGE.start, kind) && valid(amount));
  const wrong = [];
  for (const [id, building] of Object.entries(VILLAGE.buildings)) {
    const { maxLevel, costs } = building;
    if (!Number.isInteger(maxLevel) || maxLevel < 1) wrong.push(`${id}.maxLevel`);
    const costsOk = Array.isArray(costs) && costs.length === maxLevel;
    if (!costsOk || !costs.every(validCost)) wrong.push(`${id}.costs`);
    for (const key of PER_LEVEL.filter((name) => name === 'minutes' || name in building)) {
      const values = building[key];
      if (!Array.isArray(values) || values.length !== maxLevel || !values.every(valid)) wrong.push(`${id}.${key}`);
    }
  }
  const { forge } = VILLAGE.buildings;
  if (!Number.isInteger(forge.autoAimLevel) || forge.autoAimLevel < 1 || forge.autoAimLevel > forge.maxLevel) {
    wrong.push('forge.autoAimLevel');
  }
  const ids = Object.keys(VILLAGE.buildings).length;
  const builders = Number.isInteger(VILLAGE.builders) && VILLAGE.builders >= 1 && VILLAGE.builders <= ids;
  if (!builders) wrong.push('builders');
  // Il centro città: per salire al livello n chiede edifici che esistono a livelli che si possono già avere con il
  // centro al livello n - 1 (gli altri non lo superano); la sua cella di partenza sta nel villaggio
  const { center, lodge } = VILLAGE.buildings;
  const reachable = (required, level) =>
    Object.entries(required).every(
      ([id, need]) => id !== 'center' && Object.hasOwn(VILLAGE.buildings, id) && Number.isInteger(need) && need < level,
    );
  const requiresOk = Array.isArray(center.requires) && center.requires.length === center.maxLevel;
  if (!requiresOk || !center.requires.every((required, index) => reachable(required, index + 1))) {
    wrong.push('center.requires');
  }
  const fits = center.home.every((value, axis) => value >= 0 && value + center.size[axis] <= WORLD.areaCells);
  if (!center.home.every(Number.isInteger) || !fits) {
    wrong.push('center.home');
  }
  const { workers, centerLevel } = lodge;
  const rising = workers.every((count, index) => Number.isInteger(count) && count >= (workers[index - 1] ?? 0));
  if (workers.length !== lodge.maxLevel || !rising) wrong.push('lodge.workers');
  if (!Number.isInteger(centerLevel) || centerLevel < 1 || centerLevel > center.maxLevel) wrong.push('lodge.centerLevel');
  check(
    `villaggio: ${ids} edifici, posti cantiere ${VILLAGE.builders}; numeri che mancano o non vanno ${wrong.join(', ') || 'nessuno'}`,
    wrong.length === 0,
  );
  check.done();
});
