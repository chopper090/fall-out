import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  armyPower, battlePlan, root,
} from '../support/suite.js';

// 94. Livello ritarato: con il bot di riferimento si vince più di quattro volte su dieci e meno di sette, il livello
// sta nella fascia che lo promette, e nessun tratto fa un salto di perse (SIM.flags.lossJump) rispetto al precedente
test('94. Livello ritarato: con il bot di riferimento si vince più di quattro volte su dieci...', async (t) => {
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
  const segments = battlePlan().waves + 1;
  const lost = Array.from({ length: segments }, (_, i) => {
    const reached = games.filter((g) => g.segments[i]).length;
    return reached ? games.filter((g) => !g.win && g.endedIn === i).length / reached : 0;
  });
  const jumps = lost.slice(1).filter((share, i) => share - lost[i] >= SIM.flags.lossJump).length;
  check(`livello ritarato: vinte ${Math.round(100 * wins)}% su ${games.length}, rapporto ${ratio.toFixed(2)} «${band.label}» (promette ${Math.round(100 * low)}-${Math.round(100 * high)}%); perse per tratto ${lost.map((s) => Math.round(100 * s)).join(' / ')}%, salti ${jumps}`,
    wins >= 0.4 && wins <= 0.7 && wins + margin >= low && wins - margin <= high && jumps === 0 && POWER.levelScale > 0);
  check.done();
});
