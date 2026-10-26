import { test } from 'node:test';
import { checker } from '../support/check.js';
import { battlePlan, root } from '../support/suite.js';

// 191. Il boss non si allunga (A3): con le ondate corte l'esercito arriva al boss con meno scrigni aperti, ma la sua
// vita è più bassa: nelle partite vinte dal bot (100 semi) la fase del boss dura al massimo 16 s nella media e nella
// lunga, come con le ondate di 25 s (14 e 15 s)
test('191. Il boss non si allunga (A3): con le ondate corte l\'esercito arriva al boss con meno...', async (t) => {
  const check = checker(t);
  const { playGame } = await import(root + 'sim/game.js');
  const lines = [];
  let ok = true;
  for (const length of ['medium', 'long']) {
    const rules = { length };
    const { waves } = battlePlan(rules);
    const won = Array.from({ length: 100 }, (_, i) => playGame(i + 1, rules)).filter((game) => game.win);
    const seconds = won.reduce((sum, game) => sum + game.segments[waves].ms, 0) / won.length / 1000;
    ok &&= won.length > 0 && seconds <= 16;
    lines.push(`${length} ${seconds.toFixed(1)} s su ${won.length} vinte`);
  }
  check(`fase del boss nelle vinte: ${lines.join('; ')} (al massimo 16 s)`, ok);
  check.done();
});
