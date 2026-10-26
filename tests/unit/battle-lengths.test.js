import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  EVENTS,
  HERO,
  LENGTHS,
  LEVEL,
  MISSION,
  TEST_BATTLE,
  WAVES,
  battle,
  battlePlan,
  newBattle,
  powerModule,
  stepBattle,
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
  check(
    `velocità delle ondate ${speeds.join(' → ')} (passi ${steps.map((r) => `+${Math.round(100 * (r - 1))}%`).join(' ')}); nemici attesi ${expected.map(Math.round).join(' → ')}`,
    gentle && growing,
  );
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
  check(
    `difficoltà di prova: vita ×2 → nemici ×${hp}, potenza ${base.toFixed(0)} → ${harder.toFixed(0)}; numero ×2 → arrivi ×${countScale} (nemici in 20 s ${once} → ${twice}), potenza → ${denser.toFixed(0)}; a 1 come prima ${back}`,
    hp === 2 && harder > base && countScale === 2 && twice > once * 1.6 && denser > base && back,
  );
  check.done();
});

// 190. Battaglie corte e fitte (A3): le ondate di una battaglia, con le pause, durano al massimo 40, 80 e 120 s (corta,
// media, lunga: un quarto meno delle ondate di 25 s); i cancelli tengono il loro ritmo, almeno 4 arrivi a ondata (nella
// prima anche quelli già in strada), e valgono di più di ondata in ondata, così l'esercito cresce come prima; i nemici
// al secondo crescono di ondata in ondata
test('190. Battaglie corte e fitte (A3): le ondate di una battaglia, con le pause, durano al...', async (t) => {
  const check = checker(t);
  const limits = { short: 40, medium: 80, long: 120 };
  const seconds = Object.fromEntries(
    Object.keys(LENGTHS).map((length) => {
      const { waves } = battlePlan({ length });
      const play = WAVES.slice(0, waves).reduce((sum, wave) => sum + wave.duration, 0);
      return [length, LEVEL.firstBreakSeconds + play + (waves - 1) * LEVEL.breakSeconds];
    }),
  );
  const short = Object.entries(seconds).every(([length, value]) => value <= limits[length]);
  // Arrivi di cancelli in una battaglia media, una coppia conta una volta; quelli che la prima ondata trova già in
  // strada (nel frame in cui comincia) no
  HERO.fireRate = 0;
  const b = battle({ size: 1 });
  for (const hero of b.army.heroes) hero.hp = hero.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  const perWave = WAVES.slice(0, battlePlan().waves).map(() => 0);
  let frame = 0;
  let headStart = -1;
  b.bus.on(EVENTS.WAVE_STARTED, ({ index }) => {
    if (index === 0) headStart = frame;
  });
  let previous = new Set();
  for (; frame < 60 * 130 && !b.log.over && !b.waves.bossNext; frame++) {
    b.step();
    const { list } = b.gates;
    for (const gate of list) {
      const first = gate.partner === null || list.indexOf(gate) < list.indexOf(gate.partner);
      if (!previous.has(gate) && first && frame !== headStart) perWave[b.waves.index] += 1;
    }
    previous = new Set(list);
  }
  HERO.fireRate = undefined;
  MISSION.maxEscaped = 3;
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const plus = WAVES.map((wave) => mean(wave.gates.plus));
  const minus = WAVES.map((wave) => -mean(wave.gates.minus));
  const growing = (list) => list.every((value, i) => i === 0 || value > list[i - 1]);
  const perSecond = WAVES.map((wave) => {
    const swarm = wave.swarmChance * wave.swarm.count;
    const rest = (1 - wave.swarmChance) * (wave.rowChance * wave.rowSize + (1 - wave.rowChance));
    return (swarm + rest) / wave.spawnInterval;
  });
  check(
    `ondate con le pause: corta ${seconds.short} s, media ${seconds.medium} s, lunga ${seconds.long} s (al massimo ${Object.values(limits).join(', ')}); arrivi di cancelli per ondata ${perWave.join(' ')}; +N in media ${plus.map(Math.round).join(' → ')}, −N ${minus.map(Math.round).join(' → ')}; nemici al secondo ${perSecond.map((n) => n.toFixed(1)).join(' → ')}`,
    short &&
      perWave.every((count) => count >= 4) &&
      growing(plus) &&
      growing(minus) &&
      growing(perSecond),
  );
  check.done();
});
