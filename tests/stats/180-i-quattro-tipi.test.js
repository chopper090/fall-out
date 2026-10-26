import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  BATTLE_TYPES,
  EVENTS,
  MISSION,
  STARTING_LOADOUT,
  battlePlan,
  createEventBus,
  newBattle,
  restore,
  root,
  stepBattle,
} from '../support/suite.js';

// 180. I quattro tipi (S3): la normale gioca 3 ondate senza boss, quella col boss 5 e un boss, la doppia 7 e due boss
// insieme, la tripla 9, due insieme e poi il più grande da solo; giocate fino in fondo dal bot con una squadra che le
// vince (con soldati e armi del villaggio, gli eroi non cadono e i nemici passati non contano) durano circa 45, 90, 135
// e 180 s
test('180. I quattro tipi (S3): la normale gioca 3 ondate senza boss, quella col boss 5 e un...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const limits = { normal: [40, 55], boss: [78, 100], double: [120, 150], triple: [158, 200] };
  const STRONG = { damage: 0.3, fireRate: 0.1, autoAim: true };
  const play = (type, seed) => {
    const bus = createEventBus();
    const spawned = [];
    let lastWave = 0;
    bus.on(EVENTS.WAVE_STARTED, ({ index }) => {
      lastWave = index + 1;
    });
    const b = newBattle(seed, bus, { ...STARTING_LOADOUT, soldiers: 40, weapons: STRONG, rules: { type } });
    bus.on(EVENTS.BOSS_SPAWNED, () => spawned.push(b.ms));
    for (const hero of b.army.heroes) hero.hp = hero.maxHp = 1e9;
    MISSION.maxEscaped = 1e9;
    const bot = createBot(1000 / 60);
    while (!b.over && b.ms < 400000) {
      updateBot(bot, b);
      stepBattle(b, 1000 / 60);
    }
    restore(MISSION, 'maxEscaped');
    return { won: b.mission.completed, lastWave, spawned, seconds: b.ms / 1000 };
  };
  const lines = [];
  let ok = true;
  for (const type of Object.keys(BATTLE_TYPES)) {
    const games = Array.from({ length: 8 }, (_, i) => play(type, i + 1));
    const plan = battlePlan({ type });
    const groups = plan.bosses.map((group) => group.length);
    const seconds = games.reduce((sum, g) => sum + g.seconds, 0) / games.length;
    // I boss di un gruppo arrivano insieme, il gruppo dopo più tardi
    const together = games.every((g) => {
      let at = 0;
      return groups.every((size) => {
        const group = g.spawned.slice(at, at + size);
        const previous = at > 0 ? g.spawned[at - 1] : -Infinity;
        at += size;
        return group.length === size && group.every((ms) => ms === group[0]) && group[0] > previous;
      });
    });
    const [low, high] = limits[type];
    const good =
      games.every((g) => g.won && g.lastWave === plan.waves && g.spawned.length === plan.bosses.flat().length) &&
      together &&
      seconds >= low &&
      seconds <= high;
    ok &&= good;
    lines.push(
      `${type}: ${plan.waves} ondate, boss ${groups.join('+') || 0} insieme ${together}, ${Math.round(seconds)} s (${low}-${high})`,
    );
  }
  check(`tipi di battaglia: ${lines.join('; ')}`, ok);
  check.done();
});
