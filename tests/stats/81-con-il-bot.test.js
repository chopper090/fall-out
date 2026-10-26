import { test } from 'node:test';
import { checker } from '../support/check.js';
import { EVENTS, WAVES, createEventBus, root } from '../support/suite.js';

// 81. Con il bot: uno sciame regge in media più di un secondo e mezzo dal primo colpo all'ultima pedina, e si vince
// tra il 40 e il 70% delle partite
test('81. Con il bot: uno sciame regge in media più di un secondo e mezzo dal primo colpo all...', async (t) => {
  const check = checker(t);
  const { createBattle, updateBattle } = await import(root + 'systems/battle.js');
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const lives = [];
  const perWave = WAVES.map(() => ({ pawns: 0, hits: 0, oneHit: 0 }));
  let wins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const bus = createEventBus();
    const first = new Map();
    const hits = new Map();
    let t = 0;
    let wave = 0;
    bus.on(EVENTS.WAVE_ANNOUNCED, ({ index }) => {
      wave = index;
    });
    bus.on(EVENTS.ENEMY_HIT, ({ enemy }) => {
      if (!enemy.swarm) return;
      if (!first.has(enemy.swarm)) first.set(enemy.swarm, t);
      hits.set(enemy, (hits.get(enemy) ?? 0) + 1);
    });
    bus.on(EVENTS.ENEMY_KILLED, (enemy) => {
      if (!enemy.swarm) return;
      if (enemy.swarm.alive === 1 && first.has(enemy.swarm)) {
        lives.push(t - first.get(enemy.swarm));
        first.delete(enemy.swarm);
      }
      // La scorta del boss conta a parte: resta a 8 di vita
      if (!enemy.extraSpeed) {
        const n = hits.get(enemy) ?? 0;
        perWave[wave].pawns += 1;
        perWave[wave].hits += n;
        if (n <= 1) perWave[wave].oneHit += 1;
      }
      hits.delete(enemy);
    });
    const battle = createBattle(seed, bus);
    const bot = createBot(1000 / 60);
    while (!battle.over && battle.ms < 400000) {
      updateBot(bot, battle);
      updateBattle(battle, 1000 / 60);
      t = battle.ms;
    }
    if (battle.mission.completed) wins += 1;
  }
  const mean = lives.reduce((s, v) => s + v, 0) / lives.length / 1000;
  const later = perWave.slice(1).filter((w) => w.pawns > 0);
  const text = later
    .map((w) => `${(w.hits / w.pawns).toFixed(1)} colpi, ${Math.round((100 * w.oneHit) / w.pawns)}% a un colpo`)
    .join('; ');
  check(
    `sciami sotto il fuoco: ${mean.toFixed(2)} s in media dal primo colpo all'ultima pedina (${lives.length} sciami); per pedina dall'ondata 2: ${text}; vinte ${wins}/40`,
    mean > 1.5 &&
      later.length === 3 &&
      later.every((w) => w.hits / w.pawns >= 2 && w.oneHit / w.pawns <= 0.25) &&
      wins >= 16 &&
      wins <= 28,
  );
  check.done();
});
