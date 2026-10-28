import { test } from 'node:test';
import { checker } from '../support/check.js';
import { same } from '../support/suite.js';
import { HUD } from '../../src/config/balance.js';
import { SOLDIER_TYPES, WEAPONS } from '../../src/data/units.js';
import { VILLAGE } from '../../src/data/village.js';
import {
  armyCapacity,
  armyFrom,
  armyOf,
  changeArmy,
  clampRetrain,
  fallInBattle,
  fallenFrom,
  finishRetrain,
  readyArmy,
  retrainCost,
  retrainFrom,
  rushRetrain,
  startRetrain,
  trainableTypes,
  typesFrom,
} from '../../src/meta/barracks.js';
import { loadoutFrom } from '../../src/meta/loadout.js';
import { createProfile } from '../../src/meta/profile.js';
import { effectText } from '../../src/view/worldWords.js';

// 201. Tipi di soldati (C19): la caserma addestra i fucilieri dal livello 1, la raffica dal 2, i lanciatori dal 3 e le
// élite dal 5 (data/units.js SOLDIER_TYPES), nessuno se non è costruita; ogni tipo ha un'arma che esiste e un livello
// che la caserma ha; la scheda della caserma dice i soldati nuovi del livello che li porta, e solo di quello
test('201. Tipi di soldati: la caserma li addestra salendo di livello, e la sua scheda lo dice', (t) => {
  const check = checker(t);
  const { maxLevel } = VILLAGE.buildings.barracks;
  const { newTypes } = HUD.world.labels;
  const levels = Array.from({ length: maxLevel + 1 }, (_, level) => trainableTypes(level).join(','));
  const valid = Object.values(SOLDIER_TYPES).every(
    ({ weapon, barracks }) => Object.hasOwn(WEAPONS, weapon) && Number.isInteger(barracks) && barracks >= 1,
  );
  const reachable = Object.values(SOLDIER_TYPES).every(({ barracks }) => barracks <= maxLevel);
  const texts = Array.from({ length: maxLevel }, (_, index) => effectText('barracks', index + 1));
  // I tipi nuovi di ogni livello, da quelli che addestra rispetto al livello prima: la scheda nomina quelli e solo
  // quelli
  const named = texts.every((text, index) => {
    const fresh = trainableTypes(index + 1).filter((type) => !trainableTypes(index).includes(type));
    const each = Object.keys(SOLDIER_TYPES).every(
      (type) => text.includes(SOLDIER_TYPES[type].label.toLowerCase()) === fresh.includes(type),
    );
    return each && text.includes(newTypes) === fresh.length > 0;
  });
  const fresh = Array.from({ length: maxLevel }, (_, index) => typesFrom(index + 1).join(','));
  const wanted = [
    '',
    'rifle',
    'rifle,burst',
    'rifle,burst,launcher',
    'rifle,burst,launcher',
    'rifle,burst,launcher,elite',
  ];
  check(
    `addestra per livello ${levels.map((list, level) => `${level}: ${list || 'nessuno'}`).join('; ')}; armi e livelli validi ${valid}, tutti raggiungibili ${reachable}; schede ${texts.join(' | ')}`,
    levels.join('|') === wanted.join('|') &&
      fresh.join('|') === 'rifle|burst|launcher||elite' &&
      valid &&
      reachable &&
      named,
  );
  check.done();
});

// 202. Esercito formato in caserma (C20): tanti soldati quanti dice la caserma (nessuno se non è costruita); i
// fucilieri prendono i posti che restano, così la caserma che sale dà subito fucilieri; un fuciliere diventa di un tipo
// che la caserma addestra e ne torna, mai i fucilieri stessi, mai un tipo bloccato, mai senza il soldato da cambiare;
// dal salvataggio ogni tipo è un intero da 0, i tipi bloccati e quelli sconosciuti spariscono, e oltre il tetto si
// tolgono dagli ultimi tipi
test('202. Esercito della caserma: i tipi si scelgono tra quelli sbloccati, i fucilieri prendono il resto', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const counts = () => Object.values(armyOf(profile)).join('/');
  const capacities = Array.from({ length: VILLAGE.buildings.barracks.maxLevel + 1 }, (_, level) => armyCapacity(level));
  const unbuilt = counts();
  profile.village.levels.barracks = 2;
  const atTwo = counts();
  const moves = [
    changeArmy(profile, 'burst', 1),
    changeArmy(profile, 'burst', 1),
    changeArmy(profile, 'burst', -1),
    changeArmy(profile, 'launcher', 1),
    changeArmy(profile, 'rifle', 1),
    changeArmy(profile, 'burst', 2),
    changeArmy(profile, 'elite', -1),
  ];
  const changed = counts();
  for (let n = 0; n < 20; n++) changeArmy(profile, 'burst', 1);
  const full = counts();
  const tooMany = changeArmy(profile, 'burst', 1);
  profile.village.levels.barracks = 3;
  const grown = counts();
  const saved = armyFrom({ burst: 5, launcher: 30, elite: 4, ghost: 9 }, 3);
  const broken = armyFrom({ burst: -2, launcher: 1.5, elite: 'x' }, 5);
  const capacity = armyCapacity(3);
  check(
    `tetti ${capacities.join(' ')}; esercito (fucilieri/raffica/lanciatori/élite) senza caserma ${unbuilt}, al liv. 2 ${atTwo}; cambi ${moves.join(' ')} -> ${changed}; tutti raffica ${full}, uno in più ${tooMany}; caserma al 3 ${grown}; dal salvataggio ${JSON.stringify(saved)} (tetto ${capacity}), rotto ${JSON.stringify(broken)}`,
    same(capacities, [0, ...VILLAGE.buildings.barracks.soldiers]) &&
      unbuilt === '0/0/0/0' &&
      atTwo === `${capacities[2]}/0/0/0` &&
      same(moves, [true, true, true, false, false, false, false]) &&
      changed === `${capacities[2] - 1}/1/0/0` &&
      full === `0/${capacities[2]}/0/0` &&
      tooMany === false &&
      grown === `${capacities[3] - capacities[2]}/${capacities[2]}/0/0` &&
      same(saved, { burst: 5, launcher: capacity - 5, elite: 0 }) &&
      same(broken, { burst: 0, launcher: 0, elite: 0 }),
  );
  check.done();
});

// 204. Caduti e riaddestramento (C22): dopo una battaglia della caserma cade la stessa parte dei soldati che si è persa
// in battaglia, divisa tra i tipi in proporzione; in battaglia vanno gli altri (loadout), e i caduti non si cambiano di
// tipo; riaddestrarli costa retrain.rations razioni a soldato (arrotondate per difetto) e dura retrain.seconds secondi
// a soldato, poi tornano; chi cade mentre gli altri si addestrano resta caduto; una gemma finisce subito; cadono solo
// quelli che sono andati in battaglia (non chi è tornato da un riaddestramento finito intanto); un riaddestramento
// lasciato nel futuro dall'orologio tornato indietro non dura più di quanto deve; dal salvataggio i caduti non sono mai
// più dei soldati di quel tipo, e un riaddestramento che non torna sparisce
test('204. Caduti: cadono come in battaglia, si riaddestrano con razioni e tempo, una gemma accorcia', (t) => {
  const check = checker(t);
  const { retrain } = VILLAGE.buildings.barracks;
  const profile = createProfile();
  profile.village.levels.barracks = 3;
  profile.army.burst = 3;
  profile.army.launcher = 3;
  const counts = (byType) => Object.values(byType).join('/');
  const fell = fallInBattle(profile, 0.25, readyArmy(profile));
  const fallen = counts(profile.fallen);
  const ready = counts(readyArmy(profile));
  const loadout = loadoutFrom(profile);
  const moves = [
    changeArmy(profile, 'burst', -1),
    changeArmy(profile, 'burst', -1),
    changeArmy(profile, 'burst', -1),
    changeArmy(profile, 'launcher', 1),
  ];
  const cost = retrainCost(profile);
  profile.resources.rations = 10;
  const T0 = 1_800_000_000_000;
  const started = startRetrain(profile, T0);
  const again = startRetrain(profile, T0);
  const more = fallInBattle(profile, 0.5, readyArmy(profile));
  const early = finishRetrain(profile, T0 + cost.ms - 1);
  const back = finishRetrain(profile, T0 + cost.ms);
  const left = counts(profile.fallen);
  profile.resources.gems = 1;
  startRetrain(profile, T0 + cost.ms);
  const rushed = rushRetrain(profile);
  // Un riaddestramento di 4 soldati finisce mentre ne combattono 8: cade la metà degli 8, non dei 12
  const during = createProfile();
  during.village.levels.barracks = 3;
  during.fallen.rifle = 4;
  during.resources.rations = 10;
  const sent = readyArmy(during);
  startRetrain(during, T0);
  finishRetrain(during, T0 + retrainCost(during).ms);
  const onlySent = fallInBattle(during, 0.5, sent);
  // L'orologio torna indietro di un'ora: la fine non va oltre la durata intera
  during.fallen.rifle = 2;
  startRetrain(during, T0);
  const clamped = clampRetrain(during, T0 - 3600000);
  const clampedEnd = during.retrain.endsAt;
  const saved = fallenFrom({ rifle: 99, burst: -1, launcher: 1.5, ghost: 3 }, armyOf(profile));
  const brokenRetrain = [
    retrainFrom({ endsAt: 'presto', soldiers: { rifle: 1 } }, saved),
    retrainFrom({ endsAt: T0, soldiers: { rifle: 0 } }, saved),
  ];
  check(
    `cadono ${fell} (${fallen}), in battaglia ${ready}, loadout ${loadout.soldiers} soldati ${counts(loadout.army)}; cambi della raffica ${moves.join(' ')}; costo ${JSON.stringify(cost)}; partito ${JSON.stringify(started)} con ${profile.resources.rations} razioni rimaste, di nuovo ${again}; ne cadono altri ${more}; finito prima ${early}, alla fine ${back}, restano caduti ${left}; con la gemma ${rushed}, caduti ${counts(profile.fallen)}, gemme ${profile.resources.gems}; dal salvataggio ${JSON.stringify(saved)}, riaddestramenti rotti ${brokenRetrain.join(' ')}; con un riaddestramento finito in battaglia cadono ${onlySent} su ${Object.values(sent).reduce((a, b) => a + b, 0)} mandati; orologio indietro ${clamped}, fine ${clampedEnd - (T0 - 3600000)} ms dopo`,
    fell === 3 &&
      fallen === '1/1/1/0' &&
      ready === '5/2/2/0' &&
      loadout.soldiers === 9 &&
      counts(loadout.army) === '5/2/2/0' &&
      same(moves, [true, true, false, true]) &&
      cost.count === 3 &&
      cost.rations === Math.floor(3 * retrain.rations) &&
      cost.ms === 3 * retrain.seconds * 1000 &&
      started?.count === 3 &&
      started.endsAt === T0 + cost.ms &&
      again === null &&
      more > 0 &&
      early === 0 &&
      back === 3 &&
      Object.values(profile.fallen).every((count) => count === 0) &&
      rushed === more &&
      profile.resources.gems === 0 &&
      saved.rifle === armyOf(profile).rifle &&
      saved.burst === 0 &&
      saved.launcher === 0 &&
      !('ghost' in saved) &&
      brokenRetrain.every((value) => value === null) &&
      onlySent === 4 &&
      clamped === true &&
      clampedEnd === T0 - 3600000 + 2 * retrain.seconds * 1000,
  );
  check.done();
});
