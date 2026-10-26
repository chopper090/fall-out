import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  ARMY, EVENTS, GATE_KINDS, LEVEL_LIMITS, WEAPONS, weaponArena,
} from '../support/suite.js';

// 24. Oltre il tetto: un +N aggiunge riserve, la folla in campo resta al tetto, il danno sale a rendimento calante
test('24. Oltre il tetto: un +N aggiunge riserve, la folla in campo resta al tetto, il danno...', async (t) => {
  const check = checker(t);
  const cap = LEVEL_LIMITS.maxArmy;
  const b = weaponArena({ size: cap });
  b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.plus, value: 7, x: b.army.x });
  const { maxBonus, halfCount } = ARMY.reserves;
  const expected = maxBonus * (1 - 0.5 ** (7 / halfCount));
  check(`oltre il tetto: esercito ${b.army.size}, in campo ${b.army.soldiers.length + 1}/${cap}, riserve ${b.army.reserves}, danno in più ${(100 * b.army.reserveBonus).toFixed(1)}% (atteso ${(100 * expected).toFixed(1)}%)`,
    b.army.size === cap + 7 && b.army.soldiers.length === cap - 1 && b.army.reserves === 7 && Math.abs(b.army.reserveBonus - expected) < 1e-9);
  // Chi muore in campo viene rimpiazzato da una riserva; un negativo toglie prima le riserve
  const victim = b.army.soldiers[0];
  b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: victim });
  const afterDeath = { size: b.army.size, inField: b.army.soldiers.length + 1, reserves: b.army.reserves };
  b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.minus, value: -4, x: b.army.x });
  check(`riserve al posto dei caduti: dopo un morto esercito ${afterDeath.size}, in campo ${afterDeath.inField}, riserve ${afterDeath.reserves}; dopo un -4 riserve ${b.army.reserves}, in campo ${b.army.soldiers.length + 1}`,
    afterDeath.size === cap + 6 && afterDeath.inField === cap && afterDeath.reserves === 6 && b.army.reserves === 2 && b.army.soldiers.length === cap - 1);
  check.done();
});

// 25. Il danno in più delle riserve: metà del massimo con halfCount riserve, mai oltre il massimo; vale per ogni colpo
test('25. Il danno in più delle riserve: metà del massimo con halfCount riserve, mai oltre il...', async (t) => {
  const check = checker(t);
  const cap = LEVEL_LIMITS.maxArmy;
  const { maxBonus, halfCount } = ARMY.reserves;
  const bonusWith = (extra) => {
    const b = weaponArena({ size: cap + extra });
    return b.army.reserveBonus;
  };
  const half = bonusWith(halfCount);
  const double = bonusWith(2 * halfCount);
  const huge = bonusWith(1000);
  const b = weaponArena({ size: cap + halfCount });
  for (let i = 0; i < 30 && b.combat.projectiles.length === 0; i++) b.step();
  const shot = b.combat.projectiles.find((p) => p.weapon === WEAPONS.rifle);
  const expectedDamage = WEAPONS.rifle.damage * (1 + maxBonus / 2);
  check(`danno delle riserve: ${halfCount} -> +${(100 * half).toFixed(1)}%, ${2 * halfCount} -> +${(100 * double).toFixed(1)}%, 1000 -> +${(100 * huge).toFixed(1)}% (massimo +${100 * maxBonus}%); colpo di fucile ${shot?.damage.toFixed(2)} (atteso ${expectedDamage.toFixed(2)})`,
    Math.abs(half - maxBonus / 2) < 1e-9 && Math.abs(double - 0.75 * maxBonus) < 1e-9 && huge <= maxBonus && huge > 0.99 * maxBonus && shot && Math.abs(shot.damage - expectedDamage) < 1e-9);
  check.done();
});

// 27. I cursori delle riserve nel pannello valgono subito: il danno in più si ricalcola a ogni frame
test('27. I cursori delle riserve nel pannello valgono subito: il danno in più si ricalcola a...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: LEVEL_LIMITS.maxArmy + 30 });
  const before = b.army.reserveBonus;
  const saved = { ...ARMY.reserves };
  ARMY.reserves.maxBonus = 0.6;
  b.step();
  const after = b.army.reserveBonus;
  Object.assign(ARMY.reserves, saved);
  const expected = 0.6 * (1 - 0.5 ** (30 / saved.halfCount));
  check(`cursore delle riserve dal vivo: +${(100 * before).toFixed(1)}% -> +${(100 * after).toFixed(1)}% in un frame (atteso +${(100 * expected).toFixed(1)}%)`,
    Math.abs(after - expected) < 1e-9);
  check.done();
});
