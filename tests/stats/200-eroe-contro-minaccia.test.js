import { test } from 'node:test';
import { checker } from '../support/check.js';
import { pairedMargin } from '../support/stats.js';
import { root } from '../support/suite.js';

// 200. Eroe contro minaccia (C18): l'eroe comune di ogni categoria, nello schieramento di partenza, contro la minaccia
// a cui risponde (SIM.threats.list, answers; ogni categoria ne ha almeno una). Ogni categoria serve: con il potere
// acceso vince almeno SIM.threats.least.gain di battaglie in più, o perde almeno least.cut di soldati in meno, a meno
// del rumore del campione (sugli stessi semi: tests/support/stats.js). Nessuna decide da sola: nessun potere aggiunge
// più di gainMax di vittorie, oltre il rumore. Su 100 semi; il quadro intero, ogni categoria contro ogni minaccia, lo
// dà npm run sim -- --minacce
test('200. Eroe contro minaccia: ogni categoria serve contro la sua minaccia, nessuna decide da...', async (t) => {
  const check = checker(t);
  const { SIM } = await import(root + 'config/balance.js');
  const { CATEGORIES } = await import(root + 'data/heroes.js');
  const { playThreats, threatEffect } = await import(root + 'sim/threats.js');
  const z = SIM.flags.confidenceZ;
  const { least, gainMax, list } = SIM.threats;
  const seeds = Array.from({ length: 100 }, (_, index) => index + 1);
  const answers = list.flatMap(({ answers: categories }, threat) =>
    categories.map((category) => ({ threat, category })),
  );
  const cells = answers.flatMap((answer) => [true, false].map((powered) => ({ ...answer, powered })));
  const played = await playThreats(cells, seeds);
  const results = answers.map(({ threat, category }, index) => {
    const on = played[2 * index];
    const off = played[2 * index + 1];
    const { gain, cut } = threatEffect(on, off);
    const gainMargin = pairedMargin(
      z,
      on.map((battle, seed) => Number(battle.won) - Number(off[seed].won)),
    );
    const lostOff = off.reduce((sum, battle) => sum + battle.lost, 0) / off.length;
    const cutMargin =
      pairedMargin(
        z,
        on.map((battle, seed) => off[seed].lost - battle.lost),
      ) / lostOff;
    const serves = (gain > 0 && gain + gainMargin >= least.gain) || (cut > 0 && cut + cutMargin >= least.cut);
    const decides = gain - gainMargin > gainMax;
    const text = `${category} contro ${list[threat].label} ${Math.round(100 * gain)} punti, persi ${Math.round(100 * cut)}% in meno`;
    return { category, serves, decides, text };
  });
  const covered = new Set(results.map(({ category }) => category));
  check(
    `eroe contro minaccia: ${results.map(({ text, serves }) => `${text}${serves ? '' : ' (non serve)'}`).join('; ')}; categorie con una minaccia ${covered.size}/${Object.keys(CATEGORIES).length}; decide da sola ${
      results
        .filter(({ decides }) => decides)
        .map(({ category }) => category)
        .join(', ') || 'nessuna'
    }`,
    covered.size === Object.keys(CATEGORIES).length &&
      results.every(({ serves }) => serves) &&
      results.every(({ decides }) => !decides),
  );
  check.done();
});
