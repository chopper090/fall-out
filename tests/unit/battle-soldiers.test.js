import { test } from 'node:test';
import { checker } from '../support/check.js';
import { CHEST_KINDS, EVENTS, STARTING_LOADOUT, placeGate, same, weaponArena } from '../support/suite.js';
import { ELITE, SOLDIER_TYPES } from '../../src/data/units.js';

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
