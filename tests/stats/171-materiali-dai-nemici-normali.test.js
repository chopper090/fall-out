import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  DROPS, EVENTS, battlePlan, createEventBus, newBattle, root, stepBattle,
} from '../support/suite.js';

// 171. Materiali dai nemici normali: ognuno ne lascia uno con una probabilità piccola (non tutti), i più duri di più;
// col bot si raccoglie poco nella prima ondata e di più nelle ultime, e una battaglia intera ne dà il doppio di prima
// (8 dalle élite e dal boss)
test('171. Materiali dai nemici normali: ognuno ne lascia uno con una probabilità piccola (no...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const normal = ['grunt', 'fast', 'armored', 'shooter', 'swarm'];
  const chances = Object.fromEntries(normal.map((name) => [name, DROPS[name]?.find((d) => d.kind === 'materials')?.chance ?? 0]));
  const some = normal.every((name) => chances[name] > 0 && chances[name] < 1);
  const tougher = chances.armored > chances.grunt && chances.shooter > chances.grunt && chances.swarm < chances.grunt;
  const mediumWaves = battlePlan().waves;
  const perWave = Array.from({ length: mediumWaves + 1 }, () => 0);
  let total = 0;
  const games = 60;
  for (let seed = 1; seed <= games; seed++) {
    const bus = createEventBus();
    let segment = 0;
    bus.on(EVENTS.WAVE_ANNOUNCED, ({ index }) => { segment = index; });
    bus.on(EVENTS.BOSS_STARTED, () => { segment = mediumWaves; });
    bus.on(EVENTS.LOOT_COLLECTED, (item) => {
      if (item.kind !== 'materials') return;
      perWave[segment] += item.amount / games;
      total += item.amount / games;
    });
    const b = newBattle(seed, bus);
    const bot = createBot(1000 / 60);
    while (!b.over && b.ms < 400000) {
      updateBot(bot, b);
      stepBattle(b, 1000 / 60);
    }
  }
  const rising = perWave.slice(0, mediumWaves).every((amount, i) => i === 0 || amount > perWave[i - 1]);
  check(`materiali dai nemici: probabilità ${JSON.stringify(chances)}; raccolti per ondata ${perWave.map((a) => a.toFixed(1)).join(' / ')} (l'ultimo è il boss), in tutto ${total.toFixed(1)} a battaglia`,
    some && tougher && rising && perWave[0] > 0 && perWave[0] < 2 && total >= 13 && total <= 22);
  check.done();
});
