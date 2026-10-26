import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  EVENTS,
  LENGTHS,
  STARTING_LOADOUT,
  battlePlan,
  battleResult,
  createEventBus,
  newBattle,
  root,
  stepBattle,
} from '../support/suite.js';

// 180. Le tre durate: la corta gioca 2 ondate e finisce senza boss, la media 4 e il boss, la lunga 6 e un boss più
// duro; col bot una vinta dura circa uno, due e tre minuti
test('180. Le tre durate: la corta gioca 2 ondate e finisce senza boss, la media 4 e il boss,...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const plans = Object.fromEntries(Object.keys(LENGTHS).map((length) => [length, battlePlan({ length })]));
  const shape =
    plans.short.waves === 2 &&
    !plans.short.boss &&
    plans.medium.waves === 4 &&
    plans.medium.boss &&
    plans.medium.bossHpScale === 1 &&
    plans.long.waves === 6 &&
    plans.long.boss &&
    plans.long.bossHpScale > 1 &&
    battlePlan().waves === 4;
  const play = (length, seed) => {
    const bus = createEventBus();
    let bossSeen = false;
    let lastWave = 0;
    bus.on(EVENTS.BOSS_STARTED, () => {
      bossSeen = true;
    });
    bus.on(EVENTS.WAVE_STARTED, ({ index }) => {
      lastWave = index + 1;
    });
    const b = newBattle(seed, bus, { ...STARTING_LOADOUT, rules: { enemyHpScale: 1, length } });
    const bot = createBot(1000 / 60);
    while (!b.over && b.ms < 400000) {
      updateBot(bot, b);
      stepBattle(b, 1000 / 60);
    }
    return { won: b.mission.completed, bossSeen, lastWave, seconds: b.ms / 1000, result: battleResult(b) };
  };
  const summary = {};
  for (const length of Object.keys(LENGTHS)) {
    const games = Array.from({ length: 30 }, (_, i) => play(length, i + 1));
    const won = games.filter((g) => g.won);
    summary[length] = {
      won: won.length,
      seconds: won.reduce((sum, g) => sum + g.seconds, 0) / Math.max(1, won.length),
      waves: Math.max(...games.map((g) => g.lastWave)),
      boss: games.some((g) => g.bossSeen),
      resultBoss: won.some((g) => g.result.boss),
    };
  }
  const { short, medium, long } = summary;
  check(
    `durate: corta ${short.waves} ondate, boss ${short.boss} (nel risultato ${short.resultBoss}), ${Math.round(short.seconds)} s; media ${medium.waves} ondate e boss ${medium.boss}, ${Math.round(medium.seconds)} s; lunga ${long.waves} ondate e boss ${long.boss}, ${Math.round(long.seconds)} s (vinte su 30: ${short.won}, ${medium.won}, ${long.won})`,
    shape &&
      short.waves === 2 &&
      !short.boss &&
      !short.resultBoss &&
      medium.waves === 4 &&
      medium.boss &&
      long.waves === 6 &&
      long.boss &&
      short.seconds >= 45 &&
      short.seconds <= 90 &&
      medium.seconds >= 100 &&
      medium.seconds <= 150 &&
      long.seconds >= 160 &&
      long.seconds <= 230,
  );
  check.done();
});
