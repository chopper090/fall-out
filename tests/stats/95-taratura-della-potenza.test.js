import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  BOSS, WAVES, armyPower, root,
} from '../support/suite.js';

// 95. Taratura della potenza: cambiando la vita dei nemici, metà delle partite si vince a rapporto vicino a 1
test('95. Taratura della potenza: cambiando la vita dei nemici, metà delle partite si vince a...', async (t) => {
  const check = checker(t);
  const { playGame } = await import(root + 'sim/game.js');
  const { armyPower, levelPower } = await import(root + 'systems/power.js');
  const saved = { waves: WAVES.map((w) => w.enemyHp), boss: BOSS.hp, escort: BOSS.enemyHp };
  const point = (factor) => {
    WAVES.forEach((w, i) => { w.enemyHp = Math.round(saved.waves[i] * factor); });
    BOSS.hp = Math.round(saved.boss * factor);
    BOSS.enemyHp = Math.round(saved.escort * factor);
    const games = Array.from({ length: 150 }, (_, i) => playGame(i + 1));
    return { ratio: armyPower() / levelPower(), wins: games.filter((g) => g.win).length / games.length };
  };
  const points = [0.8, 1.15, 1.4].map(point);
  WAVES.forEach((w, i) => { w.enemyHp = saved.waves[i]; });
  BOSS.hp = saved.boss;
  BOSS.enemyHp = saved.escort;
  // Rapporto a metà vittorie, tra i due punti che stanno a cavallo del 50%
  let half = null;
  for (let i = 1; i < points.length && half === null; i++) {
    const [a, b] = [points[i - 1], points[i]];
    if ((a.wins - 0.5) * (b.wins - 0.5) <= 0 && a.wins !== b.wins) half = a.ratio + ((0.5 - a.wins) * (b.ratio - a.ratio)) / (b.wins - a.wins);
  }
  check(`taratura: ${points.map((p) => `rapporto ${p.ratio.toFixed(2)} vinte ${Math.round(100 * p.wins)}%`).join('; ')}; metà vittorie a rapporto ${half === null ? '-' : half.toFixed(2)}`,
    half !== null && half >= 0.85 && half <= 1.15);
  check.done();
});
