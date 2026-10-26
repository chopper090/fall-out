import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  DROPS,
  ENEMY_TYPES,
  EVENTS,
  FX,
  LOOT,
  REWARDS,
  createEventBus,
  createProfile,
  dt,
  grantRewards,
  killAt,
  laneCenters,
  newBattle,
  profileFrom,
  quietBattle,
  root,
  stepBattle,
  withAllDrops,
} from '../support/suite.js';

// 110. Un'élite che muore lascia i suoi premi dove è morta, in fila lungo la strada; i frammenti sono di un eroe
// schierato; un nemico normale lascia i suoi (dal 4.9 un materiale, qui sempre)
test("110. Un'élite che muore lascia i suoi premi dove è morta, in fila lungo la strada; i f...", async (t) => {
  const check = checker(t);
  const result = withAllDrops(() => {
    const b = quietBattle();
    killAt(b, ENEMY_TYPES.grunt, laneCenters[1], 900);
    const afterGrunt = b.loot.list.length;
    killAt(b, ENEMY_TYPES.elite, laneCenters[0], 1000);
    const items = b.loot.list.slice(afterGrunt).map((item) => ({ ...item }));
    return { afterGrunt, items, ids: b.army.heroes.map((h) => h.id) };
  });
  const { items, ids } = result;
  const gaps = items.slice(1).map((item, i) => item.z - items[i].z);
  check(
    `premi di un'élite: dopo un nemico normale ${result.afterGrunt}, dopo l'élite ${items.map((i) => `${i.kind} ${i.amount}${i.hero ? ' di ' + i.hero : ''}`).join(', ')}; a x ${[...new Set(items.map((i) => i.x))].join(' ')}, z da ${items[0].z}, distanze ${gaps.map((g) => g.toFixed(0)).join(' ')}`,
    result.afterGrunt === DROPS.grunt.length &&
      items.length === DROPS.elite.length &&
      items[0].z === 1000 &&
      items.every((i) => i.x === laneCenters[0]) &&
      gaps.every((g) => Math.abs(g - LOOT.spread) < 1e-6) &&
      items.filter((i) => i.kind === 'fragments').every((i) => ids.includes(i.hero)) &&
      items.filter((i) => i.kind !== 'fragments').every((i) => i.hero === null),
  );
  check.done();
});

// 111. L'esercito che passa sopra un premio lo prende; quello in un'altra corsia è perso; a campo fermo i premi
// scivolano da soli verso l'esercito
test("111. L'esercito che passa sopra un premio lo prende; quello in un'altra corsia è pers...", async (t) => {
  const check = checker(t);
  const b = quietBattle();
  const collected = [];
  b.bus.on(EVENTS.LOOT_COLLECTED, (item) => collected.push(item.kind));
  withAllDrops(() => killAt(b, ENEMY_TYPES.elite, b.army.x, 1200));
  const far = b.army.x < laneCenters[1] ? laneCenters[2] : laneCenters[0];
  withAllDrops(() => killAt(b, ENEMY_TYPES.elite, far, 1400));
  for (let i = 0; i < 60 * 12 && b.loot.list.length > 0; i++) stepBattle(b, dt);
  const lost = 2 * DROPS.elite.length - collected.length - b.loot.list.length;
  const got = { ...b.loot.collected, fragments: { ...b.loot.collected.fragments } };
  const stopped = quietBattle();
  stopped.scroll.speed = 0;
  withAllDrops(() => killAt(stopped, ENEMY_TYPES.elite, stopped.army.x, 900));
  const before = stopped.loot.list[0].z;
  const { updateLoot } = await import(root + 'systems/loot.js');
  updateLoot(stopped.loot, 1000, 0);
  const slid = before - stopped.loot.list[0].z;
  const fragmentCount = Object.values(got.fragments).reduce((s, n) => s + n, 0);
  check(
    `raccolta: presi ${collected.join(' ')}, persi ${lost}; raccolto ${got.materials} materiali, ${got.xp} esperienza, ${fragmentCount} frammenti; a campo fermo scivola di ${slid.toFixed(0)} in 1 s`,
    collected.length === DROPS.elite.length &&
      lost === DROPS.elite.length &&
      got.materials === 3 &&
      got.xp === 20 &&
      fragmentCount === 1 &&
      Math.abs(slid - LOOT.ownSpeed) < 1e-6,
  );
  check.done();
});

// 112. Partite intere con il bot: i colpi degli eroi portano l'eroe, quelli dei soldati no; le statistiche di ogni
// eroe tornano con i colpi; il bottino preso più quello ancora in strada non supera quello caduto; il risultato non è
// legato allo stato della battaglia
test("112. Partite intere con il bot: i colpi degli eroi portano l'eroe, quelli dei soldati...", async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const { battleResult } = await import(root + 'systems/battle.js');
  let soldierHits = 0;
  let foreign = 0;
  let mismatched = 0;
  let unbalanced = 0;
  let badResult = 0;
  let wins = 0;
  let pickups = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const bus = createEventBus();
    const dealt = new Map();
    const kills = new Map();
    let resolved = 0;
    let battle = null;
    bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage, hero }) => {
      if (hero === null || hero === undefined) {
        soldierHits += 1;
        return;
      }
      if (!battle.heroStats.some((entry) => entry.id === hero.id)) foreign += 1;
      dealt.set(hero.id, (dealt.get(hero.id) ?? 0) + damage);
      if (enemy.hp - damage <= 0) kills.set(hero.id, (kills.get(hero.id) ?? 0) + 1);
    });
    bus.on(EVENTS.LOOT_COLLECTED, () => {
      resolved += 1;
    });
    battle = newBattle(seed, bus);
    // Ogni premio caduto passa dalla pool: si contano lì
    let spawned = 0;
    const { acquire } = battle.loot.pool;
    battle.loot.pool.acquire = () => {
      spawned += 1;
      return acquire();
    };
    const bot = createBot(1000 / 60);
    while (!battle.over && battle.ms < 400000) {
      updateBot(bot, battle);
      stepBattle(battle, 1000 / 60);
    }
    pickups += spawned;
    for (const entry of battle.heroStats) {
      if (Math.abs(entry.damageDealt - (dealt.get(entry.id) ?? 0)) > 1e-6 || entry.kills !== (kills.get(entry.id) ?? 0))
        mismatched += 1;
    }
    if (resolved + battle.loot.list.length > spawned) unbalanced += 1;
    const result = battleResult(battle);
    result.loot.fragments.x = 1;
    result.heroes[0].kills += 1000;
    const ok =
      result.completed === battle.mission.completed &&
      result.leaderHpShare === undefined &&
      battle.loot.collected.fragments.x === undefined &&
      battle.heroStats[0].kills < 1000 &&
      result.heroes.length === battle.heroStats.length;
    if (!ok) badResult += 1;
    if (battle.mission.completed) wins += 1;
  }
  check(
    `12 battaglie: colpi dei soldati ${soldierHits}, colpi di eroi fuori schieramento ${foreign}, statistiche diverse dai colpi ${mismatched}, bottino che non torna ${unbalanced}, risultati sbagliati ${badResult}; premi caduti ${pickups}; vinte ${wins}`,
    soldierHits > 0 && foreign === 0 && mismatched === 0 && unbalanced === 0 && badResult === 0 && pickups > 0,
  );
  check.done();
});

// 113. Premi di fine battaglia, senza stelle: vinta tutto il bottino e il premio della vittoria, persa la parte tenuta
// e nient'altro; l'esperienza divisa tra gli eroi (il resto ai primi), i frammenti all'eroe giusto, un solo migliore;
// tutto nel profilo e nel salvataggio
test('113. Premi di fine battaglia, senza stelle: vinta tutto il bottino e il premio della vi...', async (t) => {
  const check = checker(t);
  const heroes = [
    { id: 'leader', damageDealt: 500, damageTaken: 3, kills: 10 },
    { id: 'rifleman', damageDealt: 900, damageTaken: 0, kills: 20 },
    { id: 'sniper', damageDealt: 200, damageTaken: 1, kills: 4 },
  ];
  const loot = { materials: 9, xp: 61, scrap: 0, accelerators: 0, fragments: { sniper: 3 } };
  const startMaterials = createProfile().resources.materials;
  const base = { distance: 30000, wave: 4, boss: true, heroes, loot };
  const win = grantRewards(createProfile(), { ...base, completed: true });
  const profile = createProfile();
  const loss = grantRewards(profile, { ...base, completed: false });
  const xpWin = 61 + REWARDS.victory.xp;
  const split = win.heroes.map((h) => h.xp);
  const reloaded = profileFrom(JSON.parse(JSON.stringify(profile)));
  check(
    `premi: vinta materiali ${win.materials} (9 + ${REWARDS.victory.materials}), esperienza ${split.join('+')} = ${xpWin}; migliore ${win.heroes.filter((h) => h.mvp).map((h) => h.id)}; persa: tiene ${loss.kept.materials} materiali, ${loss.kept.xp} esperienza, ${loss.kept.fragments.sniper} frammenti del cecchino, premio ${loss.prize.materials}; profilo ${JSON.stringify(reloaded.resources)} ${JSON.stringify(reloaded.heroes)}`,
    win.materials === startMaterials + 9 + REWARDS.victory.materials &&
      split.reduce((sum, v) => sum + v, 0) === xpWin &&
      Math.max(...split) - Math.min(...split) <= 1 &&
      split[0] >= split[2] &&
      win.stars === undefined &&
      win.heroes.filter((h) => h.mvp).length === 1 &&
      win.heroes[1].mvp &&
      win.heroes[2].fragments === 3 &&
      loss.kept.materials === Math.floor(9 * REWARDS.defeatShare) &&
      loss.kept.xp === Math.floor(61 * REWARDS.defeatShare) &&
      loss.kept.fragments.sniper === Math.floor(3 * REWARDS.defeatShare) &&
      loss.prize.materials === 0 &&
      loss.prize.xp === 0 &&
      reloaded.resources.materials === loss.materials &&
      reloaded.heroes.sniper.fragments === loss.kept.fragments.sniper &&
      reloaded.heroes.leader.xp === loss.heroes[0].xp,
  );
  check.done();
});

// 114. Il bottino ha un seme suo: due battaglie con lo stesso seme fanno cadere gli stessi premi
test('114. Il bottino ha un seme suo: due battaglie con lo stesso seme fanno cadere gli stess...', async (t) => {
  const check = checker(t);
  const run = () =>
    withAllDrops(() => {
      const b = quietBattle(9);
      for (let i = 0; i < 4; i++) killAt(b, ENEMY_TYPES.elite, laneCenters[i % 3], 1000 + i * 100);
      return b.loot.list.map((item) => `${item.kind}${item.hero ?? ''}`).join(',');
    });
  const a = run();
  const c = run();
  check(`stesso seme, stessi premi: ${a === c} (${a.split(',').length} premi)`, a === c && a.length > 0);
  check.done();
});

// 188. Premi presi, vicino agli eroi: la quantità con la sua parola; quelli dello stesso tipo presi mentre la scritta è
// ferma si sommano in una sola, che riparte; un tipo diverso va nella riga sopra; uno preso quando la scritta sfuma già
// ne apre un'altra; le scritte finite tornano nella pool; niente con gli effetti spenti, e a missione finita spariscono
test('188. Premi presi, vicino agli eroi: la quantità con la sua parola; quelli dello stess...', async (t) => {
  const check = checker(t);
  const { createLootFx, updateLootFx, gainFade } = await import(root + 'fx/lootFx.js');
  const { amountText } = await import(root + 'view/words.js');
  const { holdMs, fadeMs } = FX.lootGain;
  const bus = createEventBus();
  const fx = createLootFx(bus);
  const take = (kind, amount) => bus.emit(EVENTS.LOOT_COLLECTED, { kind, amount, x: 360, z: 0, hero: null });
  const wait = (ms) => {
    for (let left = ms; left > 0; left -= dt) updateLootFx(fx, Math.min(dt, left), 0);
  };
  const rows = () => fx.gains.map((gain) => `${amountText(gain.kind, gain.amount, '+')} riga ${gain.row}`).join(', ');
  take('materials', 1);
  const first = rows();
  const used = new Set(fx.gains);
  wait(holdMs / 2);
  take('materials', 2);
  take('scrap', 1);
  const merged = rows();
  const restarted = fx.gains[0].elapsedMs;
  for (const gain of fx.gains) used.add(gain);
  wait(holdMs + fadeMs / 2);
  const fade = gainFade(fx.gains[0]);
  take('materials', 1);
  const reopened = rows();
  for (const gain of fx.gains) used.add(gain);
  wait(fadeMs / 2 + dt);
  const left = rows();
  take('xp', 20);
  const freed = rows();
  wait(holdMs + fadeMs + dt);
  const ended = rows();
  take('fragments', 1);
  const reused = used.has(fx.gains[0]);
  wait(holdMs + fadeMs + dt);
  FX.enabled = false;
  take('materials', 1);
  const off = fx.gains.length + fx.picks.length;
  FX.enabled = true;
  take('materials', 1);
  bus.emit(EVENTS.MISSION_COMPLETED);
  const cleared = fx.gains.length + fx.picks.length;
  check(
    `scritte vicino agli eroi: ${first}; dopo ${holdMs / 2} ms un altro +2 e un rottame: ${merged} (la somma riparte da ${restarted} ms); quando sfumano (a ${fade}) un materiale: ${reopened}; finite le prime: ${left}; un'esperienza: ${freed}; alla fine «${ended}», scritta riusata dalla pool ${reused}; effetti spenti ${off}; a missione finita ${cleared}`,
    first === '+1 materiale riga 0' &&
      merged === '+3 materiali riga 0, +1 rottame riga 1' &&
      restarted === 0 &&
      fade > 0 &&
      fade < 1 &&
      reopened === '+3 materiali riga 0, +1 rottame riga 1, +1 materiale riga 2' &&
      left === '+1 materiale riga 2' &&
      freed === '+1 materiale riga 2, +20 esperienza riga 0' &&
      ended === '' &&
      reused &&
      off === 0 &&
      cleared === 0,
  );
  check.done();
});

// 189. In battaglia: l'esercito prende uno dopo l'altro i premi di un'élite e vicino agli eroi compare una riga per
// tipo, con la sua quantità, mai due nella stessa riga; i materiali di due nemici normali vicini fanno una scritta
// sola; dove si prende un premio il valore compare ingrandito e torna normale, e l'anello a terra finisce prima della
// scritta
test("189. In battaglia: l'esercito prende uno dopo l'altro i premi di un'élite e vicino ag...", async (t) => {
  const check = checker(t);
  const { createLootFx, updateLootFx, lootPop } = await import(root + 'fx/lootFx.js');
  const { amountText } = await import(root + 'view/words.js');
  const b = quietBattle();
  const fx = createLootFx(b.bus);
  const shown = new Map();
  let sharedRow = 0;
  let most = 0;
  let picks = 0;
  b.bus.on(EVENTS.LOOT_COLLECTED, () => {
    picks += 1;
  });
  // Fino a quando i premi in strada sono presi o persi e le loro scritte sono finite
  const play = () => {
    for (let i = 0; i < 60 * 12 && (b.loot.list.length > 0 || fx.gains.length > 0); i++) {
      updateLootFx(fx, dt, b.scroll.speed);
      stepBattle(b, dt);
      for (const gain of fx.gains) shown.set(gain.kind, amountText(gain.kind, gain.amount, '+'));
      if (new Set(fx.gains.map((gain) => gain.row)).size < fx.gains.length) sharedRow += 1;
      most = Math.max(most, fx.gains.length);
    }
  };
  withAllDrops(() => killAt(b, ENEMY_TYPES.elite, b.army.x, 900));
  play();
  const elite = [...shown.values()].join(', ');
  const eliteRight = DROPS.elite.every((drop) => shown.get(drop.kind) === amountText(drop.kind, drop.amount, '+'));
  const elitePicks = picks;
  shown.clear();
  most = 0;
  withAllDrops(() => {
    killAt(b, ENEMY_TYPES.grunt, b.army.x, 900);
    killAt(b, ENEMY_TYPES.grunt, b.army.x, 1000);
  });
  play();
  const grunts = [...shown.values()].join(', ');
  const { lootPick } = FX;
  const pop = { start: lootPop(0, lootPick), end: lootPop(lootPick.popMs, lootPick), later: lootPop(600, lootPick) };
  check(
    `élite davanti all'esercito: presi ${elitePicks} premi, scritte ${elite}, righe condivise ${sharedRow}; due nemici normali vicini: ${grunts}, al massimo ${most} scritta, poi ${fx.gains.length}; valore dove si prende: ingrandito ${pop.start}, dopo ${lootPick.popMs} ms ${pop.end}, poi ${pop.later}; anello ${lootPick.burstMs} ms, scritta ${lootPick.durationMs} ms`,
    elitePicks === DROPS.elite.length &&
      eliteRight &&
      sharedRow === 0 &&
      grunts === '+2 materiali' &&
      most === 1 &&
      fx.gains.length === 0 &&
      pop.start === 1 + lootPick.popScale &&
      pop.start > 1 &&
      pop.end === 1 &&
      pop.later === 1 &&
      lootPick.burstMs < lootPick.durationMs,
  );
  check.done();
});
