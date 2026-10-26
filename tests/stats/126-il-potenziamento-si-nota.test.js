import { test } from 'node:test';
import { checker } from '../support/check.js';
import { gainHolds } from '../support/stats.js';
import { createProfile, levelOf, loadoutFrom, newBattle, root, stepBattle } from '../support/suite.js';

// 126. Il potenziamento si nota in battaglia: con gli stessi eroi a 1200 di esperienza (livello 6) e 3 stelle il bot
// vince di più, una quindicina di vittorie su cento a meno del rumore del campione (tests/support/stats.js; su 100
// semi: sui primi 40 la battaglia normale viene più facile del solito)
test('126. Il potenziamento si nota in battaglia: con gli stessi eroi a 1200 di esperienza (l...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const { SIM } = await import(root + 'config/balance.js');
  const p = createProfile();
  for (const id of ['leader', 'rifleman', 'sniper', 'defender']) Object.assign(p.heroes[id], { xp: 1200, stars: 3 });
  const strong = loadoutFrom(p);
  const wins = (loadout) => {
    let n = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const battle = newBattle(seed, undefined, loadout);
      const bot = createBot(1000 / 60);
      while (!battle.over && battle.ms < 400000) {
        updateBot(bot, battle);
        stepBattle(battle, 1000 / 60);
      }
      if (battle.mission.completed) n += 1;
    }
    return n;
  };
  const before = wins(undefined);
  const after = wins(strong);
  check(
    `potenziamento: livello ${levelOf(1200).level} e 3 stelle, vinte ${after}/100 contro ${before}/100 al livello 1`,
    gainHolds(after, before, 100, SIM.flags.confidenceZ, 15),
  );
  check.done();
});
