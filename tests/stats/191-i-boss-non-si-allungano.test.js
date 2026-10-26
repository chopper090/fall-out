import { test } from 'node:test';
import { checker } from '../support/check.js';
import { battlePlan, root } from '../support/suite.js';

// 191. I boss non si allungano (S3): nelle partite vinte dal bot (100 semi) la fase dei boss dura al massimo 18 s con
// un boss, 22 con due insieme e 36 con tre (due insieme, la pausa e poi il più grande)
test('191. I boss non si allungano (S3): nelle partite vinte dal bot (100 semi) la fase dei b...', async (t) => {
  const check = checker(t);
  const { playGame } = await import(root + 'sim/game.js');
  const limits = { boss: 18, double: 22, triple: 36 };
  const lines = [];
  let ok = true;
  for (const [type, limit] of Object.entries(limits)) {
    const rules = { type };
    const { waves } = battlePlan(rules);
    const won = Array.from({ length: 100 }, (_, i) => playGame(i + 1, rules)).filter((game) => game.win);
    const seconds = won.reduce((sum, game) => sum + game.segments[waves].ms, 0) / won.length / 1000;
    ok &&= won.length > 0 && seconds <= limit;
    lines.push(`${type} ${seconds.toFixed(1)} s su ${won.length} vinte (al massimo ${limit})`);
  }
  check(`fase dei boss nelle vinte: ${lines.join('; ')}`, ok);
  check.done();
});
