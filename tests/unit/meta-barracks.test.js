import { test } from 'node:test';
import { checker } from '../support/check.js';
import { same } from '../support/suite.js';
import { HUD } from '../../src/config/balance.js';
import { SOLDIER_TYPES, WEAPONS } from '../../src/data/units.js';
import { VILLAGE } from '../../src/data/village.js';
import { armyCapacity, armyFrom, armyOf, changeArmy, trainableTypes, typesFrom } from '../../src/meta/barracks.js';
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
