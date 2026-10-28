import { test } from 'node:test';
import { checker } from '../support/check.js';
import { CHEST_KINDS, EVENTS, STARTING_LOADOUT, newBattle, placeGate, same, weaponArena } from '../support/suite.js';
import { ELITE, SOLDIER_TYPES } from '../../src/data/units.js';
import { lostShare } from '../../src/systems/army.js';
import { battleResult } from '../../src/systems/battle.js';

// 203. Soldati per tipo in battaglia (C21): l'esercito della caserma entra con i suoi tipi nelle sue proporzioni, le
// élite dalla partenza nei primi posti; in campo la raffica sta davanti, i fucilieri in mezzo e i lanciatori dietro
// (data/units.js depth), ognuno con l'arma del suo tipo. Una porta porta soldati nelle stesse proporzioni, e dopo le
// perdite restano quelle; uno scrigno d'arma vince sul tipo di chi sta nei posti davanti a lui, anche quando i tipi si
// ridistribuiscono
test("203. Soldati per tipo: l'esercito della caserma entra nelle sue proporzioni, per gittata", (t) => {
  const check = checker(t);
  const loadout = { ...STARTING_LOADOUT, soldiers: 14, army: { rifle: 6, burst: 3, launcher: 3, elite: 2 } };
  const b = weaponArena({ loadout });
  const count = () => {
    const counts = { rifle: 0, burst: 0, launcher: 0, elite: 0 };
    for (const soldier of b.army.soldiers) counts[soldier.elite ? 'elite' : soldier.type] += 1;
    return counts;
  };
  // Dal più avanti, la depth del tipo di ognuno non scende mai
  const ordered = () => {
    const depths = b.army.soldiers
      .filter((soldier) => !soldier.elite)
      .sort((a, c) => c.slot.dz - a.slot.dz)
      .map((soldier) => SOLDIER_TYPES[soldier.type].depth);
    return depths.every((depth, index) => index === 0 || depth >= depths[index - 1]);
  };
  const armed = (soldier) => soldier.weapon === (soldier.elite ? ELITE.weapon : SOLDIER_TYPES[soldier.type].weapon);
  const start = count();
  const startOrdered = ordered();
  const startArmed = b.army.soldiers.every(armed);
  const elitesFirst = b.army.soldiers.filter((soldier) => soldier.elite).every((soldier) => soldier.slot.index < 2);
  b.bus.emit(EVENTS.GATE_PASSED, placeGate(b, 'plus', 1, 0, 24));
  const afterGate = count();
  const gateOrdered = ordered();
  for (const soldier of b.army.soldiers.filter((one) => !one.elite).slice(0, 12)) {
    b.bus.emit(EVENTS.SOLDIER_HIT, { soldier });
  }
  const afterLosses = count();
  const lossesOrdered = ordered();
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.burst, x: b.army.x, z: 700 });
  b.bus.emit(EVENTS.GATE_PASSED, placeGate(b, 'plus', 1, 0, 6));
  const onArmed = b.army.soldiers.filter((soldier) => !soldier.elite && soldier.slot.armed !== null);
  const chestWins = onArmed.length > 0 && onArmed.every((soldier) => soldier.weapon === soldier.slot.armed);
  check(
    `tipi alla partenza ${JSON.stringify(start)} (in ordine ${startOrdered}, armi giuste ${startArmed}, élite nei primi posti ${elitesFirst}); dopo una porta +24 ${JSON.stringify(afterGate)} (in ordine ${gateOrdered}); dopo 12 perdite ${JSON.stringify(afterLosses)} (in ordine ${lossesOrdered}); scrigno di raffica: ${onArmed.length} posti armati, armi dello scrigno anche dopo un'altra porta ${chestWins}`,
    same(start, { rifle: 6, burst: 3, launcher: 3, elite: 2 }) &&
      startOrdered &&
      startArmed &&
      elitesFirst &&
      same(afterGate, { rifle: 18, burst: 9, launcher: 9, elite: 2 }) &&
      gateOrdered &&
      same(afterLosses, { rifle: 12, burst: 6, launcher: 6, elite: 2 }) &&
      lossesOrdered &&
      chestWins,
  );
  check.done();
});

// 205. La parte dei soldati persi in battaglia (C22, systems/army.js lostShare), che dice quanti della caserma cadono:
// i persi (morti contro i nemici, tolti dalle porte negative, meno quelli che il soccorso riporta) su tutti quelli che
// sono stati nell'esercito (di partenza, dalle porte e dagli scrigni d'élite); il risultato della battaglia la porta
test('205. Soldati persi in battaglia: persi su quelli che ci sono stati, con porte, scrigni e soccorso', (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 21 });
  const start = { served: b.army.served, lost: b.army.lost };
  const hit = (count) => {
    for (const soldier of b.army.soldiers.filter((one) => !one.elite).slice(0, count)) {
      soldier.lives = 1;
      b.bus.emit(EVENTS.SOLDIER_HIT, { soldier });
    }
  };
  hit(5);
  const afterHits = lostShare(b.army);
  b.bus.emit(EVENTS.GATE_PASSED, placeGate(b, 'plus', 1, 0, 20));
  b.bus.emit(EVENTS.GATE_PASSED, placeGate(b, 'minus', 1, 0, -4));
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 200 });
  b.bus.emit(EVENTS.SOLDIERS_REVIVED, { count: 3 });
  const elites = CHEST_KINDS.elite.count;
  const end = { served: b.army.served, lost: b.army.lost };
  // Il risultato di una battaglia vera porta la stessa parte
  const real = newBattle(1);
  Object.assign(real.army, { served: 40, lost: 10 });
  const result = battleResult(real);
  check(
    `soldati: alla partenza ${JSON.stringify(start)}; 5 morti ${afterHits}; poi porta +20, porta -4, scrigno d'élite (+${elites}) e soccorso di 3: ${JSON.stringify(end)}, parte persa ${lostShare(b.army)}; nel risultato di una battaglia con 10 persi su 40 ${result.lostShare}`,
    same(start, { served: 20, lost: 0 }) &&
      afterHits === 5 / 20 &&
      same(end, { served: 40 + elites, lost: 6 }) &&
      lostShare(b.army) === 6 / (40 + elites) &&
      result.lostShare === 0.25,
  );
  check.done();
});
