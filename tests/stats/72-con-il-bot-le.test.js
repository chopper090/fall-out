import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  root,
} from '../support/suite.js';

// 72. Con il bot le élite arrivano in partita e l'esercito non perde mai soldati "in negativo"
test('72. Con il bot le élite arrivano in partita e l\'esercito non perde mai soldati "in neg...', async (t) => {
  const check = checker(t);
  const { playGame } = await import(root + 'sim/game.js');
  const games = Array.from({ length: 60 }, (_, i) => playGame(i + 1));
  const elites = games.reduce((s, g) => s + g.segments.filter(Boolean).reduce((t, x) => t + x.elites, 0), 0) / games.length;
  const negative = games.filter((g) => g.segments.some((x) => x && x.soldiersLost < 0)).length;
  check(`bot: élite avute ${elites.toFixed(1)} a partita, partite con soldati persi negativi ${negative}`, elites > 0 && negative === 0);
  check.done();
});
