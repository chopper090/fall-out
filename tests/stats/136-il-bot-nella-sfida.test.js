import { test } from 'node:test';
import { checker } from '../support/check.js';
import { VILLAGE, createProfile, newBattle, root, stepBattle, villageLoadout } from '../support/suite.js';

// 136. Il bot nella sfida e il villaggio che si sente: la sfida è più dura di una battaglia normale ma si vince; con
// caserma e fucina al livello 2 il bot vince più battaglie
test('136. Il bot nella sfida e il villaggio che si sente: la sfida è più dura di una battagl...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const wins = (loadout, seeds) => {
    let n = 0;
    for (let seed = 1; seed <= seeds; seed++) {
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
  const p = createProfile();
  const before = wins(undefined, 40);
  const challenge = wins(villageLoadout(p, VILLAGE.challenge.rules), 40);
  p.village.levels.barracks = 2;
  p.village.levels.forge = 2;
  const after = wins(villageLoadout(p), 40);
  check(
    `villaggio che si sente: battaglia normale vinta dal bot ${before}/40, sfida ${challenge}/40; con caserma e fucina al liv. 2: ${after}/40`,
    after >= before + 4 && challenge > 0 && challenge < before,
  );
  check.done();
});
