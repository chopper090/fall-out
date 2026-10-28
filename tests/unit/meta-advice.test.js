import { test } from 'node:test';
import { checker } from '../support/check.js';
import { defeatAdvice } from '../../src/meta/advice.js';
import { createProfile } from '../../src/meta/profile.js';
import { freeSpot } from '../../src/meta/village.js';

// C31. Il consiglio dopo una sconfitta: la cosa più utile che si può fare adesso, in ordine. Senza scorte le missioni
// del giorno; con le scorte per un edificio la caserma o la fucina; con l'esperienza (o i frammenti) un eroe; con la
// fucina e le scorte di un'arma la fucina; con i caduti il riaddestramento se le razioni bastano (12 caduti ne
// costano una), ma non se si stanno già addestrando
test('C31. Il consiglio dopo una sconfitta: riaddestra, fucina, eroe, edificio, missioni', (t) => {
  const check = checker(t);
  const p = createProfile();
  for (const kind of Object.keys(p.resources)) p.resources[kind] = 0;
  const steps = [defeatAdvice(p)];
  Object.assign(p.resources, { wood: 50, stone: 50, gears: 10 });
  steps.push(defeatAdvice(p));
  p.heroes.rifleman.fragments = 1e3;
  steps.push(defeatAdvice(p));
  p.village.levels.forge = 1;
  steps.push(defeatAdvice(p));
  p.village.levels.barracks = 3;
  p.village.positions.barracks = freeSpot(p.village.positions, 'barracks', 0);
  p.fallen.rifle = 12;
  steps.push(defeatAdvice(p));
  p.resources.rations = 1;
  steps.push(defeatAdvice(p));
  p.retrain = { endsAt: 0, soldiers: { ...p.fallen } };
  steps.push(defeatAdvice(p));
  check(
    `consigli, aggiungendo una cosa alla volta: ${steps.join(' → ')}`,
    steps.join() === 'daily,build,hero,forge,forge,retrain,forge',
  );
  check.done();
});
