import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  BOSS,
  ENEMIES,
  ENEMY_TYPES,
  EVENTS,
  FX,
  HERO,
  MISSION,
  SWARM,
  WAVES,
  WEAPONS,
  battle,
  createEnemyFx,
  createEventBus,
  dt,
  laneCenters,
  laneOf,
  placeEnemy,
  restore,
  root,
  run,
  updateEnemyFx,
  updateSpawner,
  weaponArena,
} from '../support/suite.js';

// 78. Contraccolpo: un colpo spinge indietro il nemico in proporzione alla parte di vita che toglie, poi la spinta
// cala; i grossi si spostano meno, il boss per niente
test('78. Contraccolpo: un colpo spinge indietro il nemico in proporzione alla parte di vita...', async (t) => {
  const check = checker(t);
  const pushed = (type, hp, damage, frames = 30) => {
    const b = weaponArena({ size: 1 });
    HERO.fireRate = 0;
    const enemy = placeEnemy(b, laneCenters[0], 900, hp, type);
    const start = enemy.z;
    b.bus.emit(EVENTS.ENEMY_HIT, { enemy, damage });
    // Campo fermo: si vede solo la spinta (scrollSpeed 0 nel frame)
    for (let i = 0; i < frames; i++) updateSpawner(b.spawner, dt, 0);
    restore(HERO, 'fireRate');
    return { moved: enemy.z - start, knock: enemy.knock };
  };
  const { strength, halfLifeMs } = ENEMIES.knockback;
  const expected = (strength * 0.1 * halfLifeMs) / 1000 / Math.LN2;
  const tenth = pushed(ENEMY_TYPES.grunt, 100, 10);
  const fifth = pushed(ENEMY_TYPES.grunt, 100, 20);
  const armored = pushed(ENEMY_TYPES.armored, 100, 10);
  const boss = pushed(ENEMY_TYPES.boss, 100, 10);
  check(
    `contraccolpo: un decimo della vita sposta di ${tenth.moved.toFixed(1)} (atteso ${expected.toFixed(1)}), un quinto di ${fifth.moved.toFixed(1)}, corazzato ${armored.moved.toFixed(1)}, boss ${boss.moved.toFixed(1)}; spinta rimasta ${tenth.knock.toFixed(2)}`,
    Math.abs(tenth.moved - expected) < 0.15 * expected &&
      Math.abs(fifth.moved - 2 * tenth.moved) < 0.1 * fifth.moved &&
      Math.abs(armored.moved - tenth.moved * ENEMY_TYPES.armored.knockback) < 0.1 * tenth.moved &&
      boss.moved === 0 &&
      tenth.knock < 0.1 * strength * 0.1,
  );
  check.done();
});

// 79. La spinta ha un tetto: un colpo che toglie tutta la vita non la supera
test('79. La spinta ha un tetto: un colpo che toglie tutta la vita non la supera', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  const enemy = placeEnemy(b, laneCenters[0], 900, 10);
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: 1000 });
  check(
    `spinta al massimo: ${enemy.knock} (tetto ${ENEMIES.knockback.maxSpeed})`,
    enemy.knock === ENEMIES.knockback.maxSpeed,
  );
  check.done();
});

// 80. Gli sciami reggono più di un colpo di fucile dalla seconda ondata; la scorta del boss resta a 8 di vita
test('80. Gli sciami reggono più di un colpo di fucile dalla seconda ondata; la scorta del bo...', async (t) => {
  const check = checker(t);
  const pawn = (w) => Math.max(1, Math.round(w.enemyHp * ENEMY_TYPES.swarm.hpScale));
  const hits = WAVES.map((w) => Math.ceil(pawn(w) / WEAPONS.rifle.damage));
  const escort = Math.max(1, Math.round(BOSS.enemyHp * ENEMY_TYPES.swarm.hpScale));
  check(
    `colpi di fucile per una pedina dello sciame, per ondata: ${hits.join(' ')}; scorta ${escort} di vita`,
    hits.slice(1).every((h) => h >= 2) && escort === 8,
  );
  check.done();
});

// 82. La spinta si ferma contro chi sta dietro nella stessa corsia: nessuno passa attraverso l'altro
test('82. La spinta si ferma contro chi sta dietro nella stessa corsia: nessuno passa attrave...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  const front = placeEnemy(b, laneCenters[1], 900, 100);
  const behind = placeEnemy(b, laneCenters[1], 900 + ENEMY_TYPES.grunt.size + 2, 1e9);
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy: front, damage: 90 });
  for (let i = 0; i < 30; i++) updateSpawner(b.spawner, dt, 0);
  const gap = behind.z - front.z;
  check(
    `spinta contro chi sta dietro: distanza ${gap.toFixed(1)} (contatto a ${ENEMY_TYPES.grunt.size}), spostato di ${(front.z - 900).toFixed(1)}`,
    gap >= ENEMY_TYPES.grunt.size - 1e-6 && front.z > 900,
  );
  check.done();
});

// 83. Danno totale alla morte: un numero con tutto il danno preso, il colpo di troppo compreso, nel punto dove è
// morto; niente per le pedine dello sciame, per chi si scontra o a numeri spenti; sparisce dopo durationMs
test('83. Danno totale alla morte: un numero con tutto il danno preso, il colpo di troppo com...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  HERO.fireRate = 0;
  const enemy = placeEnemy(b, laneCenters[0], 900, 10);
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: 4 });
  const before = b.enemyFx.totals.length;
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: 9 });
  const total = b.enemyFx.totals[0];
  const swarm = placeEnemy(b, laneCenters[1], 900, 2, ENEMY_TYPES.swarm);
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy: swarm, damage: 5 });
  const afterSwarm = b.enemyFx.totals.length;
  FX.showDamageNumbers = false;
  const quiet = placeEnemy(b, laneCenters[2], 900, 2);
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy: quiet, damage: 5 });
  FX.showDamageNumbers = true;
  const afterQuiet = b.enemyFx.totals.length;
  for (let i = 0; i < Math.ceil(FX.damageTotal.durationMs / dt) + 1; i++) updateEnemyFx(b.enemyFx, dt, 0);
  restore(HERO, 'fireRate');
  check(
    `danno totale: prima della morte ${before}, alla morte ${total?.value} (atteso 13) a z ${total?.z}, dopo uno sciame ${afterSwarm}, a numeri spenti ${afterQuiet}, dopo ${FX.damageTotal.durationMs} ms ${b.enemyFx.totals.length}`,
    before === 0 &&
      total?.value === 13 &&
      total.z === 900 &&
      afterSwarm === 1 &&
      afterQuiet === 1 &&
      b.enemyFx.totals.length === 0,
  );
  check.done();
});

// 84. Livello intero con il bot: un numero totale per ogni nemico con i numeri che muore, mai per gli sciami, con
// tutto il danno che ha preso (sommato colpo per colpo prima che il gioco lo veda), e nessun colpo su un nemico che
// ha già lasciato la strada
test('84. Livello intero con il bot: un numero totale per ogni nemico con i numeri che muore,...', async (t) => {
  const check = checker(t);
  const { createBattle, updateBattle } = await import(root + 'systems/battle.js');
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  let wrong = 0;
  let totals = 0;
  let kills = 0;
  let ghosts = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const bus = createEventBus();
    const taken = new Map();
    let battle = null;
    bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
      if (!battle.spawner.enemies.includes(enemy)) ghosts += 1;
      taken.set(enemy, (taken.get(enemy) ?? 0) + damage);
    });
    battle = createBattle(seed, bus);
    const fx = createEnemyFx(bus);
    const bot = createBot(1000 / 60);
    bus.on(EVENTS.ENEMY_CLASHED, (enemy) => taken.delete(enemy));
    bus.on(EVENTS.ENEMY_ESCAPED, ({ enemy }) => taken.delete(enemy));
    bus.on(EVENTS.ENEMY_KILLED, (enemy) => {
      if (enemy.type.damageNumbers) {
        kills += 1;
        const total = fx.totals[fx.totals.length - 1];
        if (Math.abs(total.value - taken.get(enemy)) > 1e-6) wrong += 1;
      }
      taken.delete(enemy);
    });
    while (!battle.over && battle.ms < 400000) {
      updateBot(bot, battle);
      const before = fx.totals.length;
      updateBattle(battle, 1000 / 60);
      totals += Math.max(0, fx.totals.length - before);
      updateEnemyFx(fx, 1000 / 60, battle.scroll.speed);
    }
  }
  check(
    `livelli interi: ${kills} nemici con i numeri abbattuti, ${totals} danni totali comparsi, diversi dal danno preso ${wrong}, colpi su nemici già via ${ghosts}`,
    kills > 0 && wrong === 0 && ghosts === 0 && totals === kills,
  );
  check.done();
});

// 89. File di nemici fuori riga: chi arriva nella stessa fila entra fino a rowStagger più indietro; gli sciami hanno
// ogni pedina spostata di al massimo SWARM.jitter dalla sua griglia
test('89. File di nemici fuori riga: chi arriva nella stessa fila entra fino a rowStagger più...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = battle({ size: 20, startWave: 3 });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  for (const h of b.army.heroes) h.hp = h.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  run(b, 60, () => b.waves.bossNext);
  restore(HERO, 'fireRate');
  restore(MISSION, 'maxEscaped');
  const rows = b.log.born
    .map((f) => f.enemies.filter((e) => e.swarm === null && e.type !== ENEMY_TYPES.boss))
    .filter((r) => r.length > 1);
  const spreads = rows.map((r) => Math.max(...r.map((e) => e.z)) - Math.min(...r.map((e) => e.z)));
  const swarms = b.log.born.flatMap((f) =>
    [...new Set(f.enemies.filter((e) => e.swarm).map((e) => e.swarm))].map((sw) =>
      f.enemies.filter((e) => e.swarm === sw),
    ),
  );
  let worst = 0;
  let moved = 0;
  let pairs = 0;
  for (const pawns of swarms) {
    for (let i = 1; i < pawns.length; i++) {
      // Solo pedine della stessa corsia: tra due corsie la distanza non è un multiplo del passo
      if (laneOf(pawns[i].x) !== laneOf(pawns[0].x)) continue;
      const d = pawns[i].x - pawns[0].x;
      const residue = d - Math.round(d / SWARM.spacing) * SWARM.spacing;
      worst = Math.max(worst, Math.abs(residue));
      if (Math.abs(residue) > 0.5) moved += 1;
      pairs += 1;
    }
  }
  check(
    `file: ${rows.length}, sfalsate al massimo di ${spreads.length ? Math.max(...spreads).toFixed(0) : '-'} (tetto ${ENEMIES.rowStagger}), più di 10 in ${spreads.filter((s) => s > 10).length}; sciami ${swarms.length}, scarto massimo dalla griglia ${worst.toFixed(1)} (tetto ${2 * SWARM.jitter}), fuori griglia ${moved}/${pairs}`,
    rows.length > 3 &&
      spreads.every((s) => s <= ENEMIES.rowStagger + 1e-6) &&
      spreads.filter((s) => s > 10).length > rows.length / 3 &&
      swarms.length > 0 &&
      worst <= 2 * SWARM.jitter + 1e-6 &&
      moved > pairs / 2,
  );
  check.done();
});

// R. Quote dei tipi speciali: per i moltiplicatori (le battaglie avanti e le sfide del giorno) ogni tipo cresce nella
// sua proporzione; se insieme passano 1 si stringono tutti allo stesso modo, nessuno sparisce, e i normali finiscono a
// zero
test('R. Quote dei tipi speciali: per i moltiplicatori ogni tipo cresce nella sua proporzione;...', async (t) => {
  const check = checker(t);
  const { typeShares } = await import(root + 'systems/spawn.js');
  const specials = { fast: 0.15, armored: 0.3, elite: 0.26, shooter: 0.28 };
  const shareOf = (shares, name) => shares.find(([type]) => type === ENEMY_TYPES[name])[1];
  const plain = typeShares(specials);
  const crowded = typeShares(specials, { armored: 3, elite: 2 });
  const total = crowded.reduce((sum, [, share]) => sum + share, 0);
  const ratio = shareOf(crowded, 'armored') / shareOf(crowded, 'shooter');
  check(
    `quote: normali ${shareOf(plain, 'grunt').toFixed(2)} senza moltiplicatori; con corazzati ×3 ed élite ×2 corazzati ${shareOf(crowded, 'armored').toFixed(2)}, élite ${shareOf(crowded, 'elite').toFixed(2)}, tiratori ${shareOf(crowded, 'shooter').toFixed(2)}, normali ${shareOf(crowded, 'grunt').toFixed(2)}, in tutto ${total.toFixed(2)}`,
    Math.abs(shareOf(plain, 'grunt') - 0.01) < 1e-9 &&
      Math.abs(total - 1) < 1e-9 &&
      shareOf(crowded, 'grunt') === 0 &&
      shareOf(crowded, 'shooter') > 0 &&
      Math.abs(ratio - (0.3 * 3) / 0.28) < 1e-9,
  );
  check.done();
});
