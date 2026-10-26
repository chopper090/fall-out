import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  TEST_BATTLE, WAVES, arrivals, count, newBattle, powerModule, stepBattle,
} from '../support/suite.js';

// 170. Velocità del campo quasi costante: ogni ondata va poco più della precedente (al massimo il 5% in più), e dalla
// prima all'ultima non cresce di più di un quinto; la difficoltà viene dal numero dei nemici, che cresce di ondata in
// ondata (arrivi al secondo e pedine degli sciami)
test('170. Velocità del campo quasi costante: ogni ondata va poco più della precedente (al ma...', async (t) => {
  const check = checker(t);
  const speeds = WAVES.map((wave) => wave.scrollSpeed);
  const steps = speeds.slice(1).map((speed, i) => speed / speeds[i]);
  const gentle = steps.every((ratio) => ratio >= 1 && ratio <= 1.05) && speeds.at(-1) / speeds[0] <= 1.2;
  // Nemici attesi in un'ondata: arrivi per la loro grandezza media (sciame, fila o uno solo)
  const expected = WAVES.map((wave) => {
    const arrivals = wave.duration / wave.spawnInterval;
    const swarm = wave.swarmChance * wave.swarm.count;
    const rest = (1 - wave.swarmChance) * (wave.rowChance * wave.rowSize + (1 - wave.rowChance));
    return arrivals * (swarm + rest);
  });
  const growing = expected.every((count, i) => i === 0 || count > expected[i - 1]);
  check(`velocità delle ondate ${speeds.join(' → ')} (passi ${steps.map((r) => `+${Math.round(100 * (r - 1))}%`).join(' ')}); nemici attesi ${expected.map(Math.round).join(' → ')}`,
    gentle && growing);
  check.done();
});

// 183. Difficoltà di prova: la vita dei nemici e il numero degli arrivi crescono quanto dice il pannello, anche nella
// potenza del livello; a 1 tutto com'è
test('183. Difficoltà di prova: la vita dei nemici e il numero degli arrivi crescono quanto d...', async (t) => {
  const check = checker(t);
  const { levelPower } = powerModule;
  const base = levelPower();
  TEST_BATTLE.enemyHpScale = 2;
  const harder = levelPower();
  const hp = newBattle(4).spawner.hpScale;
  TEST_BATTLE.enemyHpScale = 1;
  TEST_BATTLE.enemyCountScale = 2;
  const denser = levelPower();
  const countScale = newBattle(4).spawner.countScale;
  TEST_BATTLE.enemyCountScale = 1;
  const back = levelPower() === base && newBattle(4).spawner.hpScale === 1 && newBattle(4).spawner.countScale === 1;
  // Nemici nati nei primi 20 s, contati uno per uno
  const born = (scale) => {
    TEST_BATTLE.enemyCountScale = scale;
    const b = newBattle(4);
    const seen = new Set();
    for (let i = 0; i < 60 * 20; i++) {
      stepBattle(b, 1000 / 60);
      for (const enemy of b.spawner.enemies) seen.add(enemy);
    }
    TEST_BATTLE.enemyCountScale = 1;
    return seen.size;
  };
  const once = born(1);
  const twice = born(2);
  check(`difficoltà di prova: vita ×2 → nemici ×${hp}, potenza ${base.toFixed(0)} → ${harder.toFixed(0)}; numero ×2 → arrivi ×${countScale} (nemici in 20 s ${once} → ${twice}), potenza → ${denser.toFixed(0)}; a 1 come prima ${back}`,
    hp === 2 && harder > base && countScale === 2 && twice > once * 1.6 && denser > base && back);
  check.done();
});
