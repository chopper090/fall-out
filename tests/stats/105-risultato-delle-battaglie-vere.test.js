import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  EVENTS,
  STARTING_LOADOUT,
  WAVES,
  battleResult,
  createEventBus,
  createProfile,
  recordBattle,
  root,
  same,
} from '../support/suite.js';

// 105. Risultato delle battaglie vere con il bot (S3: la decima della strada, con il boss): compiuta come la missione,
// il numero della battaglia, l'ondata raggiunta, il boss se è arrivato; le statistiche le contano tutte
test('105. Risultato delle battaglie vere con il bot: compiuta come la missione, il numero...', async (t) => {
  const check = checker(t);
  const { createBattle, updateBattle } = await import(root + 'systems/battle.js');
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const profile = createProfile();
  let wrong = 0;
  let wins = 0;
  let last = null;
  const reached = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const bus = createEventBus();
    let bossSeen = false;
    let result = null;
    let battle = null;
    bus.on(EVENTS.BOSS_STARTED, () => {
      bossSeen = true;
    });
    const end = () => {
      result = battleResult(battle);
      recordBattle(profile, result);
    };
    bus.on(EVENTS.MISSION_FAILED, end);
    bus.on(EVENTS.MISSION_COMPLETED, end);
    battle = createBattle(seed, bus, { ...STARTING_LOADOUT, rules: { type: 'boss', number: 10 } });
    const bot = createBot(1000 / 60);
    while (!battle.over && battle.ms < 400000) {
      updateBot(bot, battle);
      updateBattle(battle, 1000 / 60);
    }
    const ok =
      result !== null &&
      result.completed === battle.mission.completed &&
      result.number === 10 &&
      result.wave >= 1 &&
      result.wave <= WAVES.length &&
      result.boss === bossSeen &&
      (!result.completed || result.boss);
    if (!ok) wrong += 1;
    if (battle.mission.completed) wins += 1;
    last = result && { completed: result.completed, wave: result.wave, boss: result.boss };
    reached.add(result?.boss ? 'boss' : result?.wave);
  }
  const { stats } = profile;
  check(
    `risultati di 30 battaglie: sbagliati ${wrong}, arrivate a ${[...reached].join(' ')}; statistiche giocate ${stats.played}, vinte ${stats.won} (attese ${wins}), ultima uguale ${same(stats.last, last)}`,
    wrong === 0 && stats.played === 30 && stats.won === wins && same(stats.last, last) && reached.size > 1,
  );
  check.done();
});
