import { test } from 'node:test';
import { checker } from '../support/check.js';
import { lossJumps } from '../support/stats.js';
import { battlePlan, root } from '../support/suite.js';

// 94. Battaglia normale ritarata (S7): con il bot di riferimento e la squadra di partenza si vince almeno sette volte
// su dieci (all'inizio è tutto facile), il livello sta nella fascia che lo promette, e nessun tratto fa un salto di
// perse (SIM.flags.lossJump) rispetto al precedente, oltre il rumore del campione (tests/support/stats.js)
test('94. Battaglia normale ritarata (S7): con il bot di riferimento si vince almeno sette vo...', async (t) => {
  const check = checker(t);
  const { SIM, POWER } = await import(root + 'config/balance.js');
  const { playGame } = await import(root + 'sim/game.js');
  const { armyPower, levelPower, difficulty, bandWins } = await import(root + 'systems/power.js');
  const games = Array.from({ length: 200 }, (_, i) => playGame(i + 1));
  const wins = games.filter((g) => g.win).length / games.length;
  const ratio = armyPower() / levelPower();
  const band = difficulty(ratio);
  const [low, high] = bandWins(band);
  const z = SIM.flags.confidenceZ;
  const margin = z * Math.sqrt((wins * (1 - wins)) / games.length);
  const segments = battlePlan().waves + (battlePlan().boss ? 1 : 0);
  const reached = Array.from({ length: segments }, (_, i) => games.filter((g) => g.segments[i]).length);
  const lost = reached.map((count, i) => (count ? games.filter((g) => !g.win && g.endedIn === i).length / count : 0));
  const jumps = lossJumps(lost, reached, z, SIM.flags.lossJump);
  check(
    `livello ritarato: vinte ${Math.round(100 * wins)}% su ${games.length}, rapporto ${ratio.toFixed(2)} «${band.label}» (promette ${Math.round(100 * low)}-${Math.round(100 * high)}%); perse per tratto ${lost.map((s) => Math.round(100 * s)).join(' / ')}%, salti ${jumps}`,
    wins >= 0.7 && wins + margin >= low && wins - margin <= high && jumps === 0 && POWER.levelScale > 0,
  );
  check.done();
});
