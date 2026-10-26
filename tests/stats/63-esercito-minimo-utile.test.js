import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  LEVEL_LIMITS, root,
} from '../support/suite.js';

// 63. Esercito minimo utile: con il bot di riferimento chi arriva all'ondata 4 ci arriva in media con la folla
// piena (LIMITS.maxArmy), e si vince una partita su tre o più
test('63. Esercito minimo utile: con il bot di riferimento chi arriva all\'ondata 4 ci arriva...', async (t) => {
  const check = checker(t);
  const { playGame } = await import(root + 'sim/game.js');
  const games = Array.from({ length: 100 }, (_, i) => playGame(i + 1));
  const atWave4 = games.filter((g) => g.segments[3]).map((g) => g.segments[3].armyStart);
  const mean = atWave4.reduce((s, v) => s + v, 0) / atWave4.length;
  const wins = games.filter((g) => g.win).length;
  check(`esercito all'inizio dell'ondata 4: ${mean.toFixed(0)} in media su ${atWave4.length} partite (minimo utile ${LEVEL_LIMITS.maxArmy}); vinte ${wins}/100`,
    mean >= LEVEL_LIMITS.maxArmy && wins >= 30 && wins <= 70);
  check.done();
});
