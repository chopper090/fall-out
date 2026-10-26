import { test } from 'node:test';
import { checker } from '../support/check.js';
import { lossJumps } from '../support/stats.js';
import { BATTLE_TYPES, battlePlan, powerModule, root } from '../support/suite.js';

// 181. Ogni tipo col bot di riferimento sta nella fascia che il suo rapporto di potenza promette (la normale la più
// facile, poi quella col boss, la doppia e la tripla), e nessuna ondata fa un salto di perse rispetto alla precedente,
// oltre il rumore del campione (tests/support/stats.js)
test('181. Ogni tipo col bot di riferimento sta nella fascia che il suo rapporto di potenza p...', async (t) => {
  const check = checker(t);
  const { SIM } = await import(root + 'config/balance.js');
  const { playGame } = await import(root + 'sim/game.js');
  const { armyPower, levelPower, difficulty, bandWins } = powerModule;
  const lines = [];
  let ok = true;
  const rates = {};
  for (const type of Object.keys(BATTLE_TYPES)) {
    const rules = { type };
    const games = Array.from({ length: 160 }, (_, i) => playGame(i + 1, rules));
    const wins = games.filter((g) => g.win).length / games.length;
    const ratio = armyPower() / levelPower(rules);
    const band = difficulty(ratio);
    const [low, high] = bandWins(band);
    const margin = SIM.flags.confidenceZ * Math.sqrt((wins * (1 - wins)) / games.length);
    const plan = battlePlan(rules);
    const segments = plan.waves + (plan.boss ? 1 : 0);
    const reached = Array.from({ length: segments }, (_, i) => games.filter((g) => g.segments[i]).length);
    const lost = reached.map((count, i) => (count ? games.filter((g) => !g.win && g.endedIn === i).length / count : 0));
    const jumps = lossJumps(lost, reached, SIM.flags.confidenceZ, SIM.flags.lossJump);
    rates[type] = wins;
    ok &&= wins + margin >= low && wins - margin <= high && jumps === 0;
    lines.push(
      `${type} vinte ${Math.round(100 * wins)}%, rapporto ${ratio.toFixed(2)} «${band.label}» (${Math.round(100 * low)}-${Math.round(100 * high)}%), perse ${lost.map((s) => Math.round(100 * s)).join('/')}%, salti ${jumps}`,
    );
  }
  check(
    `tipi tarati: ${lines.join('; ')}`,
    ok && rates.normal > rates.boss && rates.boss > rates.double && rates.double >= rates.triple,
  );
  check.done();
});
