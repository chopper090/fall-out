import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  LENGTHS, armyPower, battlePlan, powerModule, root,
} from '../support/suite.js';

// 181. Ogni durata col bot di riferimento sta nella fascia che il suo rapporto di potenza promette (la corta più
// facile, la lunga più dura), e nessuna ondata fa un salto di perse rispetto alla precedente
test('181. Ogni durata col bot di riferimento sta nella fascia che il suo rapporto di potenza...', async (t) => {
  const check = checker(t);
  const { SIM } = await import(root + 'config/balance.js');
  const { playGame } = await import(root + 'sim/game.js');
  const { armyPower, levelPower, difficulty, bandWins } = powerModule;
  const lines = [];
  let ok = true;
  const rates = {};
  for (const length of Object.keys(LENGTHS)) {
    const rules = { length };
    const games = Array.from({ length: 200 }, (_, i) => playGame(i + 1, rules));
    const wins = games.filter((g) => g.win).length / games.length;
    const ratio = armyPower() / levelPower(rules);
    const band = difficulty(ratio);
    const [low, high] = bandWins(band);
    const margin = SIM.flags.confidenceZ * Math.sqrt((wins * (1 - wins)) / games.length);
    const segments = battlePlan(rules).waves + (battlePlan(rules).boss ? 1 : 0);
    const lost = Array.from({ length: segments }, (_, i) => {
      const reached = games.filter((g) => g.segments[i]).length;
      return reached ? games.filter((g) => !g.win && g.endedIn === i).length / reached : 0;
    });
    const jumps = lost.slice(1).filter((share, i) => share - lost[i] >= SIM.flags.lossJump).length;
    rates[length] = wins;
    ok &&= wins + margin >= low && wins - margin <= high && jumps === 0;
    lines.push(`${length} vinte ${Math.round(100 * wins)}%, rapporto ${ratio.toFixed(2)} «${band.label}» (${Math.round(100 * low)}-${Math.round(100 * high)}%), perse ${lost.map((s) => Math.round(100 * s)).join('/')}%, salti ${jumps}`);
  }
  check(`durate tarate: ${lines.join('; ')}`, ok && rates.short > rates.medium && rates.medium > rates.long);
  check.done();
});
