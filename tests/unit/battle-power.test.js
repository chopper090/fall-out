import { test } from 'node:test';
import { checker } from '../support/check.js';
import { ARMY, BOSS, ENEMY_TYPES, HEROES, LINEUP, WAVES, WEAPONS, battlePlan, restore, root } from '../support/suite.js';

// 54. Potenza: la formula unica dà per noi e per il livello la radice di danno al secondo per vita, calcolata a mano
test('54. Potenza: la formula unica dà per noi e per il livello la radice di danno al secondo...', async (t) => {
  const check = checker(t);
  const { armyPower, levelPower, difficulty } = await import(root + 'systems/power.js');
  const { POWER } = await import(root + 'config/balance.js');
  const { afterArmor: armor } = await import(root + 'systems/combat.js');
  const heroes = LINEUP.map((l) => HEROES[l.hero]);
  const weaponDps = (w) => w.damage * (w.pellets ?? 1) * (w.kind === 'lob' ? POWER.blastTargets : 1) * w.fireRate;
  const abilityDps = ({ ability: a, weapon }) =>
    a.kind === 'shockwave' || a.kind === 'pierce'
      ? (a.share * POWER.abilityHp) / a.cooldownSeconds
      : a.kind === 'rapidFire'
        ? (weaponDps(weapon) * (a.fireRateScale - 1) * a.seconds) / a.cooldownSeconds
        : 0;
  const dps = heroes.reduce((s, h) => s + weaponDps(h.weapon) + abilityDps(h), 0);
  const hp = heroes.reduce((s, h) => s + h.maxHp, 0);
  const expectedArmy = Math.sqrt(dps * hp) * POWER.scale;
  // Livello: vita che arriva ogni secondo e vita totale, con la vita dei corazzati contro il fucile
  const tough = (base, type) =>
    (Math.max(1, Math.round(base * type.hpScale)) * WEAPONS.rifle.damage) / armor(WEAPONS.rifle.damage, type.armor);
  const plan = battlePlan();
  let total = 0;
  for (const w of WAVES.slice(0, plan.waves)) {
    const normalShare = 1 - Object.values(w.specials).reduce((s, c) => s + c, 0);
    const enemy =
      Object.entries(w.specials).reduce((s, [n, c]) => s + c * tough(w.enemyHp, ENEMY_TYPES[n]), 0) +
      normalShare * tough(w.enemyHp, ENEMY_TYPES.grunt);
    const perArrival =
      w.swarmChance * w.swarm.count * tough(w.enemyHp, ENEMY_TYPES.swarm) +
      (1 - w.swarmChance) * (w.rowChance * Math.min(w.rowSize, 3) + 1 - w.rowChance) * enemy;
    total += (w.duration / w.spawnInterval) * perArrival;
  }
  const seconds = WAVES.slice(0, plan.waves).reduce((s, w) => s + w.duration, 0);
  const bossHp = plan.bosses.flat().reduce((s, { hpScale }) => s + BOSS.hp * hpScale, 0);
  const expectedLevel =
    Math.sqrt((total / seconds) * (total + bossHp)) * POWER.scale * POWER.levelScale * plan.powerScale;
  const ratio = armyPower() / levelPower();
  check(
    `potenza: noi ${armyPower().toFixed(1)} (a mano ${expectedArmy.toFixed(1)}), livello ${levelPower().toFixed(1)} (a mano ${expectedLevel.toFixed(1)}), rapporto ${ratio.toFixed(2)}: ${difficulty(ratio).label}`,
    Math.abs(armyPower() - expectedArmy) < 1e-9 && Math.abs(levelPower() - expectedLevel) < 1e-9,
  );

  // Più vita ai nemici abbassa il rapporto, più danno agli eroi lo alza; ogni rapporto ha la sua fascia
  const savedHp = WAVES.map((w) => w.enemyHp);
  WAVES.forEach((w) => {
    w.enemyHp *= 1.5;
  });
  const harder = armyPower() / levelPower();
  WAVES.forEach((w, i) => {
    w.enemyHp = savedHp[i];
  });
  const savedDamage = heroes.map((h) => h.weapon.damage);
  heroes.forEach((h) => {
    h.weapon.damage *= 2;
  });
  const stronger = armyPower() / levelPower();
  heroes.forEach((h, i) => {
    h.weapon.damage = savedDamage[i];
  });
  const froms = POWER.bands.map((b) => b.from);
  const ordered = froms.every((f, i) => i === 0 || f < froms[i - 1]) && froms[froms.length - 1] === 0;
  const labels = [...froms.map((f) => f + 0.01), 0].map((r) => difficulty(r).label);
  check(
    `rapporto con nemici x1.5 ${harder.toFixed(2)}, con eroi a danno doppio ${stronger.toFixed(2)}; fasce ${labels.join(' / ')}`,
    harder < ratio && stronger > ratio && ordered && new Set(labels).size === POWER.bands.length,
  );
  check.done();
});

// 55. La potenza non è più scritta a mano negli eroi e nel livello
test('55. La potenza non è più scritta a mano negli eroi e nel livello', async (t) => {
  const check = checker(t);
  const waves = await import(root + 'data/waves.js');
  check(
    `niente potenza scritta a mano: eroi ${Object.values(HEROES).filter((h) => 'power' in h).length}, LEVEL_INFO ${'LEVEL_INFO' in waves}`,
    Object.values(HEROES).every((h) => !('power' in h)) && !('LEVEL_INFO' in waves),
  );
  check.done();
});

// 56. I soldati di partenza contano nella nostra potenza: ognuno con il danno del fucile e un punto di vita
test('56. I soldati di partenza contano nella nostra potenza: ognuno con il danno del fucile...', async (t) => {
  const check = checker(t);
  const { armyPower } = await import(root + 'systems/power.js');
  const { POWER } = await import(root + 'config/balance.js');
  const base = armyPower() / POWER.scale;
  const heroHp = LINEUP.reduce((s, l) => s + HEROES[l.hero].maxHp, 0);
  const heroDps = (base * base) / heroHp;
  ARMY.startSize = 11;
  const withSoldiers = armyPower();
  restore(ARMY, 'startSize');
  const rifleDps = WEAPONS.rifle.damage * WEAPONS.rifle.fireRate;
  const expected = Math.sqrt((heroDps + 10 * rifleDps) * (heroHp + 10)) * POWER.scale;
  check(
    `potenza con 10 soldati di partenza: ${withSoldiers.toFixed(1)} (attesa ${expected.toFixed(1)})`,
    Math.abs(withSoldiers - expected) < 1e-9,
  );
  check.done();
});
