import { test } from 'node:test';
import { checker } from '../support/check.js';
import { HUD } from '../../src/config/balance.js';
import { SOLDIER_TYPES, WEAPONS } from '../../src/data/units.js';
import { VILLAGE } from '../../src/data/village.js';
import { trainableTypes, typesFrom } from '../../src/meta/barracks.js';
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
  const named = texts.every((text, index) => {
    const fresh = typesFrom(index + 1);
    const all = fresh.every((type) => text.includes(SOLDIER_TYPES[type].label.toLowerCase()));
    return all && text.includes(newTypes) === fresh.length > 0;
  });
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
    levels.join('|') === wanted.join('|') && valid && reachable && named,
  );
  check.done();
});
