import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  DROPS,
  ENEMY_TYPES,
  EVENTS,
  HOUR,
  MINUTE,
  MISSION,
  STARTING_LOADOUT,
  VILLAGE,
  WEAPONS,
  armyPowerOf,
  createCombat,
  createEventBus,
  createProfile,
  durationText,
  grantRewards,
  levelPowerOf,
  newBattle,
  profileFrom,
  root,
  stepBattle,
  updateCombat,
  villageLoadout,
  villageMeta,
} from '../support/suite.js';
import { goalText } from '../../src/view/worldWords.js';

// 130. Tempo vero: la fattoria produce le sue razioni l'ora fino al tetto, anche "ad app chiusa" (un salto di ore);
// un suo miglioramento conta dal momento in cui finisce; le razioni si raccolgono intere; l'orologio che torna
// indietro non fa produrre due volte
test('130. Tempo vero: la fattoria produce le sue razioni l\'ora fino al tetto, anche "ad app...', async (t) => {
  const check = checker(t);
  const { settle, collectRations, startUpgrade } = villageMeta;
  const farm = VILLAGE.buildings.farm;
  const p = createProfile();
  const t0 = 1_000_000_000_000;
  settle(p, t0);
  const nothing = p.village.farm.stored;
  startUpgrade(p, 'farm', t0);
  const ends = t0 + farm.minutes[0] * MINUTE;
  settle(p, ends + HOUR / 2);
  const half = p.village.farm.stored;
  settle(p, ends + 5 * HOUR);
  const capped = p.village.farm.stored;
  const got = collectRations(p);
  const rations = p.resources.rations;
  // Miglioramento al livello 2 mentre produce: fino alla fine al ritmo del livello 1, poi a quello del 2
  p.resources.materials = 1000;
  p.resources.scrap = 1000;
  const t1 = ends + 5 * HOUR;
  settle(p, t1);
  startUpgrade(p, 'farm', t1);
  const ends2 = t1 + farm.minutes[1] * MINUTE;
  settle(p, ends2 + HOUR / 4);
  const expected = Math.min(
    farm.storage[1],
    (farm.rationsPerHour[0] * farm.minutes[1]) / 60 + farm.rationsPerHour[1] / 4,
  );
  const mixed = p.village.farm.stored;
  // L'orologio torna indietro di un'ora e poi riprende: niente due volte
  const before = p.village.farm.stored;
  settle(p, ends2 - HOUR);
  settle(p, ends2 + HOUR / 4);
  const back = p.village.farm.stored;
  check(
    `tempo vero: senza fattoria ${nothing}; mezz'ora dopo il liv. 1 ${half.toFixed(2)} (attese ${farm.rationsPerHour[0] / 2}); dopo 5 h ${capped} (tetto ${farm.storage[0]}); raccolte ${got}, razioni ${rations}; liv. 2 a metà ${mixed.toFixed(2)} (attese ${expected.toFixed(2)}); orologio indietro ${before.toFixed(2)} → ${back.toFixed(2)}`,
    nothing === 0 &&
      Math.abs(half - farm.rationsPerHour[0] / 2) < 1e-9 &&
      capped === farm.storage[0] &&
      got === farm.storage[0] &&
      rations === VILLAGE.start.rations + got &&
      p.village.levels.farm === 2 &&
      Math.abs(mixed - expected) < 1e-9 &&
      back === before,
  );
  check.done();
});

// 131. Cantieri: si paga, uno alla volta, finisce dopo i suoi minuti; l'acceleratore toglie i suoi minuti; la sfida si
// tenta una volta per cantiere e, vinta, toglie metà del tempo che resta; a cantiere già finito non toglie niente;
// al livello massimo non si sale più
test("131. Cantieri: si paga, uno alla volta, finisce dopo i suoi minuti; l'acceleratore tog...", async (t) => {
  const check = checker(t);
  const {
    canUpgrade,
    startUpgrade,
    settle,
    timeLeft,
    useAccelerator,
    canChallenge,
    startChallenge,
    winChallenge,
    upgradeCost,
  } = villageMeta;
  const p = createProfile();
  const t0 = 2_000_000_000_000;
  const startMaterials = p.resources.materials;
  const first = startUpgrade(p, 'barracks', t0);
  const paid = startMaterials - p.resources.materials;
  const second = canUpgrade(p, 'farm');
  settle(p, t0 + 60000);
  const still = p.village.levels.barracks;
  settle(p, t0 + VILLAGE.buildings.barracks.minutes[0] * MINUTE);
  const done = p.village.levels.barracks;
  p.resources.materials = 1000;
  p.resources.scrap = 1000;
  // La fattoria dal livello 3 al 4: un cantiere lungo
  p.village.levels.farm = 3;
  startUpgrade(p, 'farm', t0 + 10 * MINUTE);
  const full = timeLeft(p, 'farm', t0 + 10 * MINUTE);
  const accelerated = useAccelerator(p, 'farm', t0 + 10 * MINUTE) ? timeLeft(p, 'farm', t0 + 10 * MINUTE) : null;
  const withoutAccelerators = useAccelerator(p, 'farm', t0 + 10 * MINUTE);
  const challengeFirst = startChallenge(p, 'farm', t0 + 10 * MINUTE);
  const challengeAgain = canChallenge(p, 'farm', t0 + 10 * MINUTE);
  const leftBefore = timeLeft(p, 'farm', t0 + 11 * MINUTE);
  const saved = winChallenge(p, 'farm', t0 + 11 * MINUTE);
  const leftAfter = timeLeft(p, 'farm', t0 + 11 * MINUTE);
  const late = winChallenge(p, 'farm', t0 + 20 * HOUR);
  p.village.levels.forge = VILLAGE.buildings.forge.maxLevel;
  check(
    `cantieri: partito ${first}, pagati ${paid}, un altro insieme ${second}; dopo 1 min liv. ${still}, alla fine ${done}; fattoria al liv. 4 in ${full / MINUTE} min, con l'acceleratore ${accelerated === null ? '-' : Math.round(accelerated / MINUTE)} min, senza acceleratori ${withoutAccelerators}; sfida ${challengeFirst}, di nuovo ${challengeAgain}; vinta: da ${Math.round(leftBefore / 1000)} s a ${Math.round(leftAfter / 1000)} s (tolti ${Math.round(saved / 1000)} s); a cantiere finito ${late}; fucina al massimo ${upgradeCost(p, 'forge')}`,
    first &&
      paid === VILLAGE.buildings.barracks.costs[0].materials &&
      !second &&
      still === 0 &&
      done === 1 &&
      full === VILLAGE.buildings.farm.minutes[3] * MINUTE &&
      accelerated === full - VILLAGE.acceleratorMinutes * MINUTE &&
      !withoutAccelerators &&
      challengeFirst &&
      !challengeAgain &&
      Math.abs(leftAfter - leftBefore * (1 - VILLAGE.challenge.timeShare)) < 1 &&
      late === 0 &&
      p.village.levels.farm === 4 &&
      upgradeCost(p, 'forge') === null &&
      !canUpgrade(p, 'forge'),
  );
  check.done();
});

// 132. Profilo: chi comincia ha le risorse di partenza del villaggio e gli edifici da costruire; un salvataggio del
// 4.3 (senza villaggio, senza razioni, rottami e acceleratori) si carica con i valori di partenza e tiene il resto;
// i campi del villaggio sbagliati tornano quelli di partenza
test('132. Profilo: chi comincia ha le risorse di partenza del villaggio e gli edifici da cos...', async (t) => {
  const check = checker(t);
  const fresh = createProfile();
  const old = profileFrom({ resources: { materials: 7, dogTags: 2 }, heroes: {}, lineup: null });
  const broken = profileFrom({
    village: {
      levels: { farm: 9, barracks: -2, forge: 1.5 },
      sites: [{ building: 'tower', endsAt: 5 }],
      farm: { stored: -4, since: 'x' },
    },
  });
  const maxed = profileFrom({ village: { levels: { farm: 5 }, sites: [{ building: 'farm', endsAt: 5 }] } });
  const nan = profileFrom({ village: { sites: [{ building: 'forge', endsAt: 'domani' }] } });
  const good = profileFrom({
    village: {
      levels: { forge: 2 },
      sites: [{ building: 'forge', endsAt: 99, challenged: true }],
      farm: { stored: 3.5, since: 10 },
    },
  });
  check(
    `profilo del villaggio: da zero ${JSON.stringify(fresh.resources)} ${JSON.stringify(fresh.village.levels)}; dal 4.3 ${JSON.stringify(old.resources)}; sbagliato ${JSON.stringify(broken.village)}; cantiere su un edificio al massimo ${JSON.stringify(maxed.village.sites)}; fine non valida ${JSON.stringify(nan.village.sites)}; giusto ${JSON.stringify(good.village)}`,
    fresh.resources.rations === VILLAGE.start.rations &&
      fresh.resources.materials === VILLAGE.start.materials &&
      fresh.resources.scrap === VILLAGE.start.scrap &&
      fresh.resources.accelerators === VILLAGE.start.accelerators &&
      Object.values(fresh.village.levels).every((level) => level === 0) &&
      fresh.village.sites.length === 0 &&
      old.resources.materials === 7 &&
      old.resources.dogTags === 2 &&
      old.resources.rations === VILLAGE.start.rations &&
      old.resources.scrap === VILLAGE.start.scrap &&
      broken.village.levels.farm === 5 &&
      broken.village.levels.barracks === 0 &&
      broken.village.levels.forge === 0 &&
      broken.village.sites.length === 0 &&
      broken.village.farm.stored === 0 &&
      broken.village.farm.since === 0 &&
      maxed.village.sites.length === 0 &&
      nan.village.sites.length === 0 &&
      good.village.levels.forge === 2 &&
      good.village.sites[0]?.challenged === true &&
      good.village.farm.stored === 3.5,
  );
  check.done();
});

// 133. Il villaggio in battaglia: la caserma dà soldati di partenza in più; la fucina dà danno e cadenza ai soldati,
// non agli eroi (un soldato e un eroe col fucile che sparano per 60 s nel vuoto: colpi contati e danno di ognuno); la
// potenza lo conta
test('133. Il villaggio in battaglia: la caserma dà soldati di partenza in più; la fucina dà...', async (t) => {
  const check = checker(t);
  const p = createProfile();
  p.village.levels.barracks = 3;
  p.village.levels.forge = 5;
  const loadout = villageLoadout(p);
  const { soldiers, weapons } = villageMeta.villageBonus(p.village.levels);
  const fire = (bonus) => {
    const combat = createCombat(createEventBus());
    const shots = { soldier: [], hero: [] };
    const soldier = { x: 100, z: 0, size: 40, weapon: 'rifle', phase: 0.5, slot: { growth: 1 } };
    const hero = { x: 300, z: 0, size: 40, weapon: WEAPONS.rifle, phase: 0.5 };
    const army = {
      heroes: [hero],
      soldiers: [soldier],
      damageScale: 1,
      reserveBonus: 0,
      fireRateScale: 1,
      weapons: bonus,
    };
    const targets = { enemies: [], chests: [] };
    // Ogni colpo nuovo entra nella lista dei colpi in volo: lì si conta, con chi l'ha sparato
    combat.projectiles.push = function (shot) {
      shots[shot.hero === null ? 'soldier' : 'hero'].push(shot.damage);
      return Array.prototype.push.call(this, shot);
    };
    for (let frame = 0; frame < 3600; frame++) updateCombat(combat, army, targets, 1000 / 60, 0);
    return shots;
  };
  const plain = fire(STARTING_LOADOUT.weapons);
  const forged = fire({ ...weapons, autoAim: false });
  const sizes = [newBattle(11).army.size, newBattle(11, undefined, loadout).army.size];
  const rate = forged.soldier.length / plain.soldier.length;
  check(
    `villaggio in battaglia: soldati di partenza ${sizes[0]} → ${sizes[1]} (+${soldiers}); fucina ${JSON.stringify(weapons)}: colpi del soldato in 60 s ${plain.soldier.length} → ${forged.soldier.length} (×${rate.toFixed(2)}), danno ${plain.soldier[0]} → ${forged.soldier[0]}; eroe ${plain.hero.length} → ${forged.hero.length} colpi, danno ${plain.hero[0]} → ${forged.hero[0]}; potenza ${Math.round(armyPowerOf())} → ${Math.round(armyPowerOf({ ...STARTING_LOADOUT, soldiers }))} → ${Math.round(armyPowerOf(loadout))}`,
    sizes[1] === sizes[0] + VILLAGE.buildings.barracks.soldiers[2] &&
      weapons.autoAim &&
      Math.abs(forged.soldier[0] - plain.soldier[0] * (1 + weapons.damage)) < 1e-9 &&
      Math.abs(rate - (1 + weapons.fireRate)) < 0.03 &&
      forged.hero.length === plain.hero.length &&
      forged.hero[0] === plain.hero[0] &&
      armyPowerOf(loadout) > armyPowerOf({ ...STARTING_LOADOUT, soldiers }) &&
      armyPowerOf({ ...STARTING_LOADOUT, soldiers }) > armyPowerOf(),
  );
  check.done();
});

// 134. Il lanciatore che mira (fucina): la granata di un soldato va dove sarà il nemico più vicino davanti, anche in
// un'altra corsia, e lo prende; senza la fucina cade dritta in fondo alla gittata; quelle degli eroi non mirano
test('134. Il lanciatore che mira (fucina): la granata di un soldato va dove sarà il nemico p...', async (t) => {
  const check = checker(t);
  const launcher = WEAPONS.launcher;
  const throwAt = (autoAim, hero) => {
    const bus = createEventBus();
    const combat = createCombat(bus);
    const enemy = {
      type: ENEMY_TYPES.grunt,
      x: 420,
      z: Math.min(600, launcher.range - 50),
      size: 60,
      hp: 1e6,
      maxHp: 1e6,
      extraSpeed: 0,
      brake: 0,
      knock: 0,
    };
    const shooter = { x: 120, z: 0, size: 40, weapon: 'launcher', phase: 0.001, slot: { growth: 1 } };
    const heroShooter = { ...shooter, id: 'defender', weapon: launcher, ability: { kind: 'shield' } };
    const army = {
      heroes: hero ? [heroShooter] : [],
      soldiers: hero ? [] : [shooter],
      damageScale: 1,
      reserveBonus: 0,
      fireRateScale: 1,
      weapons: { damage: 0, fireRate: 0, autoAim },
    };
    let hits = 0;
    bus.on(EVENTS.ENEMY_HIT, ({ enemy: target }) => {
      if (target === enemy) hits += 1;
    });
    const targets = { enemies: [enemy], chests: [] };
    updateCombat(combat, army, targets, 16, 200);
    const grenade = combat.grenades[0];
    const aimed = grenade ? { x: grenade.toX, z: Math.round(grenade.toZ) } : null;
    army.soldiers.length = 0;
    army.heroes.length = 0;
    for (let frame = 0; frame < 300; frame++) {
      enemy.z -= (200 * 16) / 1000;
      updateCombat(combat, army, targets, 16, 200);
    }
    return { aimed, hits };
  };
  const aimed = throwAt(true, false);
  const straight = throwAt(false, false);
  const heroThrow = throwAt(true, true);
  check(
    `lanciatore che mira: mirata a ${JSON.stringify(aimed.aimed)}, colpito ${aimed.hits}; senza fucina a ${JSON.stringify(straight.aimed)}, colpito ${straight.hits}; eroe a ${JSON.stringify(heroThrow.aimed)}`,
    aimed.aimed?.x === 420 &&
      aimed.aimed.z < 600 &&
      aimed.hits === 1 &&
      straight.aimed?.x === 120 &&
      straight.aimed.z === launcher.range &&
      straight.hits === 0 &&
      heroThrow.aimed?.x === 120,
  );
  check.done();
});

// 135. La sfida in battaglia: i nemici hanno più vita (lo stesso fante, con lo stesso seme, ha enemyHpScale volte la
// vita), anche il boss; il resto del livello è quello normale; la potenza del livello lo conta
test('135. La sfida in battaglia: i nemici hanno più vita (lo stesso fante, con lo stesso sem...', async (t) => {
  const check = checker(t);
  const rules = VILLAGE.challenge.rules;
  const firstGrunt = (battleRules) => {
    const battle = newBattle(5, undefined, villageLoadout(createProfile(), battleRules));
    for (let frame = 0; frame < 60 * 30; frame++) {
      stepBattle(battle, 1000 / 60);
      const grunt = battle.spawner.enemies.find((e) => e.type === ENEMY_TYPES.grunt);
      if (grunt) return { battle, hp: grunt.maxHp };
    }
    return { battle, hp: null };
  };
  const hard = firstGrunt(rules);
  const soft = firstGrunt(null);
  const bossOf = (battleRules) => {
    const battle = newBattle(5, undefined, villageLoadout(createProfile(), battleRules));
    battle.spawner.headStart = false;
    battle.waves.index = battle.waves.count - 1;
    battle.waves.bossNext = true;
    for (let frame = 0; frame < 60 * 60 && !battle.spawner.boss; frame++) {
      battle.spawner.enemies.length = 0;
      battle.gates.list.length = 0;
      battle.chests.list.length = 0;
      stepBattle(battle, 1000 / 60);
    }
    return battle.spawner.boss?.maxHp ?? null;
  };
  const hardBoss = bossOf(rules);
  const softBoss = bossOf(null);
  check(
    `sfida in battaglia: vita del primo fante ${hard.hp} contro ${soft.hp}, del boss ${hardBoss} contro ${softBoss} (×${rules.enemyHpScale}); ondata ${hard.battle.waves.index + 1}, nemici ammessi ${hard.battle.mission.escaped}/${MISSION.maxEscaped}; potenza del livello ${Math.round(levelPowerOf(rules))} contro ${Math.round(levelPowerOf())}`,
    soft.hp !== null &&
      hard.hp === Math.max(1, Math.round(soft.hp * rules.enemyHpScale)) &&
      softBoss !== null &&
      hardBoss === Math.round(softBoss * rules.enemyHpScale) &&
      hard.battle.waves.index === soft.battle.waves.index &&
      levelPowerOf(rules) > levelPowerOf(),
  );
  check.done();
});

// 137. Premi nuovi: rottami e acceleratori dal bottino (metà se persa), nella sfida niente premio della vittoria; le
// durate a parole
test('137. Premi nuovi: rottami e acceleratori dal bottino (metà se persa), nella sfida nient...', async (t) => {
  const check = checker(t);
  const heroes = [{ id: 'leader', damageDealt: 1, damageTaken: 0, kills: 0 }];
  const loot = { materials: 4, xp: 0, scrap: 5, accelerators: 1, fragments: {} };
  const base = { distance: 1, wave: 4, boss: true, heroes, loot };
  const p = createProfile();
  const won = grantRewards(p, { ...base, completed: true });
  const q = createProfile();
  const lost = grantRewards(q, { ...base, completed: false });
  const r = createProfile();
  const challenge = grantRewards(r, { ...base, completed: true }, { prize: false });
  const words = [45 * 1000, 4 * MINUTE + 12000, 5 * MINUTE, 80 * MINUTE, 2 * HOUR, 200].map(durationText);
  check(
    `premi del villaggio: vinta rottami ${won.scrap}, acceleratori ${p.resources.accelerators}; persa tiene ${lost.kept.scrap} rottami, ${lost.kept.accelerators} acceleratori; sfida premio ${JSON.stringify(challenge.prize)}, materiali ${challenge.materials}; durate ${words.join(' | ')}; boss ${JSON.stringify(DROPS.boss.map((d) => d.kind))}`,
    won.scrap === VILLAGE.start.scrap + 5 &&
      p.resources.accelerators === VILLAGE.start.accelerators + 1 &&
      lost.kept.scrap === 2 &&
      lost.kept.accelerators === 0 &&
      challenge.prize.materials === 0 &&
      challenge.prize.dogTags === 0 &&
      challenge.materials === VILLAGE.start.materials + 4 &&
      words.join('|') === '45 s|4 min 12 s|5 min|1 h 20 min|2 h|1 s' &&
      DROPS.boss.some((d) => d.kind === 'scrap') &&
      DROPS.boss.some((d) => d.kind === 'accelerators'),
  );
  check.done();
});

// 138. Prossimo obiettivo: si sa sempre cosa costruire. Da zero la fattoria, pronta; con un cantiere aperto nessuno (la
// riga dice il cantiere); poi l'edificio più indietro, con quanto manca; tutto al massimo, nessuno
test('138. Prossimo obiettivo: si sa sempre cosa costruire. Da zero la fattoria, pronta; con...', async (t) => {
  const check = checker(t);
  const { nextGoal, startUpgrade, settle } = villageMeta;
  const p = createProfile();
  const first = nextGoal(p);
  startUpgrade(p, 'farm', 0);
  const during = nextGoal(p);
  settle(p, HOUR);
  p.resources.materials = 0;
  p.resources.scrap = 0;
  const second = nextGoal(p);
  for (const id of Object.keys(VILLAGE.buildings)) p.village.levels[id] = VILLAGE.buildings[id].maxLevel;
  const none = nextGoal(p);
  check(
    `prossimo obiettivo: da zero ${JSON.stringify(first)}; con il cantiere ${during}; dopo la fattoria ${JSON.stringify(second)}; tutto al massimo ${none}`,
    first.building === 'farm' &&
      first.level === 1 &&
      first.missing.materials === 0 &&
      during === null &&
      second.building === 'barracks' &&
      second.missing.materials === VILLAGE.buildings.barracks.costs[0].materials &&
      none === null,
  );
  check.done();
});

// 139. Revisione: la sfida non si offre a un cantiere che sta per finire (meno di minMinutes); la fascia conta la
// fucina anche senza caserma, e la mira del lanciatore; la granata mirata cade dove il nemico arriva
test('139. Revisione: la sfida non si offre a un cantiere che sta per finire (meno di minMinu...', async (t) => {
  const check = checker(t);
  const { startUpgrade, canChallenge } = villageMeta;
  const p = createProfile();
  startUpgrade(p, 'farm', 0);
  const short = canChallenge(p, 'farm', 0);
  p.resources.materials = 1000;
  p.resources.scrap = 1000;
  p.village.levels.farm = 3;
  p.village.sites = [];
  startUpgrade(p, 'farm', 0);
  const long = canChallenge(p, 'farm', 0);
  const lateAt = (VILLAGE.buildings.farm.minutes[3] - VILLAGE.challenge.minMinutes + 1) * MINUTE;
  const late = canChallenge(p, 'farm', lateAt);
  const forged = (level) => {
    const q = createProfile();
    q.village.levels.forge = level;
    return armyPowerOf(villageLoadout(q));
  };
  const powers = [0, 1, 2, 3, 5].map(forged);
  const { POWER } = await import(root + 'config/balance.js');
  // Un nemico veloce davanti, in un'altra corsia: la granata mirata cade entro il suo raggio
  const bus = createEventBus();
  const combat = createCombat(bus);
  const enemy = {
    type: ENEMY_TYPES.fast,
    x: 420,
    z: 500,
    size: 60,
    hp: 1e6,
    maxHp: 1e6,
    extraSpeed: ENEMY_TYPES.fast.extraSpeed,
    brake: 0,
    knock: 0,
  };
  const army = {
    heroes: [],
    soldiers: [{ x: 120, z: 0, size: 40, weapon: 'launcher', phase: 0.001, slot: { growth: 1 } }],
    damageScale: 1,
    reserveBonus: 0,
    fireRateScale: 1,
    weapons: { damage: 0, fireRate: 0, autoAim: true },
  };
  let hits = 0;
  bus.on(EVENTS.ENEMY_HIT, () => {
    hits += 1;
  });
  const targets = { enemies: [enemy], chests: [] };
  updateCombat(combat, army, targets, 16, 400);
  army.soldiers.length = 0;
  for (let frame = 0; frame < 300; frame++) {
    enemy.z -= ((400 + enemy.extraSpeed) * 16) / 1000;
    updateCombat(combat, army, targets, 16, 400);
  }
  check(
    `revisione del villaggio: sfida su un cantiere di 1 min ${short}, di 60 min ${long}, a ${VILLAGE.challenge.minMinutes - 1} min dalla fine ${late}; potenza con la fucina 0/1/2/3/5 senza caserma ${powers.map(Math.round).join('/')} (mira ×${POWER.autoAimScale}); granata mirata su un nemico veloce: colpito ${hits}`,
    !short &&
      long &&
      !late &&
      powers[1] > powers[0] &&
      powers[2] > powers[1] &&
      powers[3] > powers[2] * 1.3 &&
      powers[4] > powers[3] &&
      hits === 1,
  );
  check.done();
});

// Orologio del telefono tornato indietro, la fattoria: se l'ora in cui era arrivata (since) è nel futuro di più di
// quanto ci mette a riempirsi, riprende da adesso invece di restare ferma fino ad allora; un salto più corto lo aspetta
// come prima (niente razioni due volte); senza fattoria si riparte da adesso, così quella costruita poi non resta ferma
test('Orologio indietro, fattoria: un salto lungo riprende da adesso, uno corto si aspetta', (t) => {
  const check = checker(t);
  const { settle } = villageMeta;
  const farm = VILLAGE.buildings.farm;
  const t0 = 1_800_000_000_000;
  const farmAt = (level, since) => {
    const p = createProfile();
    p.village.levels.farm = level;
    p.village.farm = { stored: 0, since };
    return p;
  };
  const long = farmAt(2, t0 + 24 * HOUR);
  settle(long, t0);
  const longSince = long.village.farm.since - t0;
  settle(long, t0 + HOUR / 2);
  const longStored = long.village.farm.stored;
  const fill = (farm.storage[1] / farm.rationsPerHour[1]) * HOUR;
  const short = farmAt(2, t0 + 30 * MINUTE);
  settle(short, t0);
  const shortSince = short.village.farm.since - t0;
  settle(short, t0 + 20 * MINUTE);
  const shortWaiting = short.village.farm.stored;
  settle(short, t0 + HOUR);
  const shortStored = short.village.farm.stored;
  const none = farmAt(0, t0 + 24 * HOUR);
  settle(none, t0);
  const noneSince = none.village.farm.since - t0;
  check(
    `orologio indietro, fattoria liv. 2 (si riempie in ${fill / MINUTE} min): 24 h nel futuro → da adesso +${longSince / MINUTE} min, mezz'ora dopo ${longStored.toFixed(2)} razioni (attese ${farm.rationsPerHour[1] / 2}); 30 min nel futuro → resta +${shortSince / MINUTE} min, dopo 20 min ${shortWaiting}, dopo 1 h ${shortStored.toFixed(2)} (attese ${farm.rationsPerHour[1] / 2}); senza fattoria 24 h nel futuro → +${noneSince / MINUTE} min`,
    longSince === 0 &&
      Math.abs(longStored - farm.rationsPerHour[1] / 2) < 1e-9 &&
      fill > 30 * MINUTE &&
      shortSince === 30 * MINUTE &&
      shortWaiting === 0 &&
      Math.abs(shortStored - farm.rationsPerHour[1] / 2) < 1e-9 &&
      noneSince === 0,
  );
  check.done();
});

// Orologio del telefono tornato indietro, il cantiere: se finirebbe più in là della durata intera del suo livello,
// ricomincia da adesso con quella durata e finisce dopo i suoi minuti; uno che finisce prima resta com'è
test('Orologio indietro, cantiere: mai più lungo del suo livello intero', (t) => {
  const check = checker(t);
  const { settle, timeLeft } = villageMeta;
  const minutes = VILLAGE.buildings.barracks.minutes[0];
  const t0 = 1_800_000_000_000;
  const siteEnding = (endsAt) => {
    const p = createProfile();
    p.village.sites = [{ building: 'barracks', endsAt, challenged: false }];
    return p;
  };
  const far = siteEnding(t0 + 24 * HOUR);
  settle(far, t0);
  const farLeft = timeLeft(far, 'barracks', t0);
  settle(far, t0 + minutes * MINUTE);
  const farLevel = far.village.levels.barracks;
  const near = siteEnding(t0 + MINUTE);
  settle(near, t0);
  const nearLeft = timeLeft(near, 'barracks', t0);
  check(
    `orologio indietro, caserma liv. 1 (${minutes} min): finiva fra 24 h → fra ${farLeft / MINUTE} min, dopo i suoi minuti liv. ${farLevel}; finiva fra 1 min → fra ${nearLeft / MINUTE} min`,
    farLeft === minutes * MINUTE && farLevel === 1 && far.village.sites.length === 0 && nearLeft === MINUTE,
  );
  check.done();
});

// Orologio normale, che va solo avanti: la protezione non cambia niente. Fattoria al liv. 1 e un cantiere della
// fucina appena aperto, un controllo al minuto per 10 minuti come il mondo: il cantiere finisce all'ora decisa
// all'apertura, la fattoria produce tutto il tempo
test('Orologio normale: fattoria e cantiere vanno come prima', (t) => {
  const check = checker(t);
  const { settle, startUpgrade, siteOf } = villageMeta;
  const t0 = 1_800_000_000_000;
  const p = createProfile();
  p.resources.materials = 1000;
  p.resources.scrap = 1000;
  p.village.levels.farm = 1;
  p.village.farm = { stored: 0, since: t0 };
  startUpgrade(p, 'forge', t0);
  const endsAt = siteOf(p, 'forge').endsAt;
  const seen = new Set();
  let finishedAt = null;
  for (let minute = 0; minute <= 10; minute++) {
    settle(p, t0 + minute * MINUTE);
    const site = siteOf(p, 'forge');
    if (site !== null) seen.add(site.endsAt);
    else finishedAt ??= minute;
  }
  const expected = (VILLAGE.buildings.farm.rationsPerHour[0] * 10) / 60;
  const { stored, since } = p.village.farm;
  check(
    `orologio normale: fucina con fine a +${(endsAt - t0) / MINUTE} min, fini viste ${[...seen].map((at) => `+${(at - t0) / MINUTE}`).join(', ')}, finita al minuto ${finishedAt} (liv. ${p.village.levels.forge}); fattoria dopo 10 min ${stored.toFixed(2)} razioni (attese ${expected}), arrivata a +${(since - t0) / MINUTE} min`,
    seen.size === 1 &&
      seen.has(endsAt) &&
      endsAt - t0 === VILLAGE.buildings.forge.minutes[0] * MINUTE &&
      finishedAt === VILLAGE.buildings.forge.minutes[0] &&
      p.village.levels.forge === 1 &&
      Math.abs(stored - expected) < 1e-9 &&
      since === t0 + 10 * MINUTE,
  );
  check.done();
});

// I posti cantiere di una prova: VILLAGE.builders vale count mentre gira body, poi torna com'era
function withBuilders(count, body) {
  const original = VILLAGE.builders;
  VILLAGE.builders = count;
  try {
    return body();
  } finally {
    VILLAGE.builders = original;
  }
}

// Un profilo ricco con la fattoria e la caserma al livello level, già messe, e la fattoria che produce da since
function grownVillage(level, since = 0) {
  const p = createProfile();
  Object.assign(p.resources, { materials: 5000, scrap: 5000, accelerators: 3 });
  for (const id of ['farm', 'barracks']) {
    p.village.levels[id] = level;
    p.village.positions[id] = villageMeta.freeSpot(p.village.positions, id, 0);
  }
  p.village.farm = { stored: 0, since };
  return p;
}

// A1. Due posti cantiere: due edifici salgono insieme e il terzo aspetta un posto libero; ogni cantiere finisce alla
// sua ora, anche quello aperto dopo che finisce prima, uno dopo l'altro in ordine di fine; la fattoria produce al
// livello di prima fino alla fine del suo cantiere, anche se lo si guarda una volta sola dopo tutti e due
test('A1. Due posti cantiere: due edifici insieme, il terzo aspetta; ognuno finisce alla sua ora', (t) => {
  const check = checker(t);
  const { startUpgrade, canUpgrade, settle, freeSlots } = villageMeta;
  const farm = VILLAGE.buildings.farm;
  const t0 = 1_800_000_000_000;
  const open = (p) => p.village.sites.map((site) => site.building).join() || '-';
  const levels = (p) => Object.values(p.village.levels).join('/');
  const rows = withBuilders(2, () => {
    const p = grownVillage(1, t0);
    p.village.levels.barracks = 0;
    const started = [startUpgrade(p, 'farm', t0), startUpgrade(p, 'barracks', t0 + MINUTE)];
    const third = [canUpgrade(p, 'forge'), startUpgrade(p, 'forge', t0 + MINUTE)];
    const full = { free: freeSlots(p), open: open(p) };
    settle(p, t0 + 4 * MINUTE);
    const mid = { levels: levels(p), open: open(p), free: freeSlots(p), stored: p.village.farm.stored };
    const forge = startUpgrade(p, 'forge', t0 + 4 * MINUTE);
    settle(p, t0 + 10 * MINUTE);
    const end = { levels: levels(p), open: open(p), stored: p.village.farm.stored };
    const q = grownVillage(1, t0);
    q.village.levels.barracks = 0;
    startUpgrade(q, 'farm', t0);
    startUpgrade(q, 'barracks', t0 + MINUTE);
    settle(q, t0 + 10 * MINUTE);
    const once = { levels: levels(q), stored: q.village.farm.stored };
    return { started, third, full, mid, forge, end, once };
  });
  const { started, third, full, mid, forge, end, once } = rows;
  const midStored = (farm.rationsPerHour[0] * 4) / 60;
  const endStored = (farm.rationsPerHour[0] * farm.minutes[1] + farm.rationsPerHour[1] * 5) / 60;
  check(
    `due posti: fattoria e caserma aperte ${started.join('/')}, la fucina si può ${third[0]} e parte ${third[1]} (posti liberi ${full.free}, aperti ${full.open}); dopo 4 min livelli ${mid.levels} (finita prima la caserma, aperta dopo), aperti ${mid.open}, posti liberi ${mid.free}, fattoria ${mid.stored.toFixed(2)} razioni (attese ${midStored.toFixed(2)}); la fucina parte ${forge}; dopo 10 min livelli ${end.levels}, aperti ${end.open}, fattoria ${end.stored.toFixed(2)} (attese ${endStored.toFixed(2)}); guardato una volta sola dopo 10 min ${once.levels}, ${once.stored.toFixed(2)}`,
    started.every(Boolean) && !third[0] && !third[1] && full.free === 0 && full.open === 'farm,barracks' &&
      mid.levels === '1/1/0' && mid.open === 'farm' && mid.free === 1 && Math.abs(mid.stored - midStored) < 1e-9 &&
      forge && end.levels === '2/1/1' && end.open === '-' && Math.abs(end.stored - endStored) < 1e-9 &&
      once.levels === '2/1/0' && Math.abs(once.stored - endStored) < 1e-9,
  );
  check.done();
});

// A1. Acceleratore e sfida valgono per il cantiere dell'edificio scelto e per nessun altro; una sfida per cantiere
test('A1. Due cantieri aperti: acceleratore e sfida toccano solo il loro', (t) => {
  const check = checker(t);
  const { startUpgrade, useAccelerator, canChallenge, startChallenge, winChallenge } = villageMeta;
  const ends = (p) => p.village.sites.map((site) => `${site.building} ${site.endsAt / MINUTE}`).join(', ');
  const result = withBuilders(2, () => {
    const p = grownVillage(3);
    startUpgrade(p, 'farm', 0);
    startUpgrade(p, 'barracks', 0);
    const opened = ends(p);
    const accelerated = useAccelerator(p, 'barracks', 0);
    const afterAccelerator = ends(p);
    const challenge = startChallenge(p, 'farm', 0);
    const open = { farm: canChallenge(p, 'farm', 0), barracks: canChallenge(p, 'barracks', 0) };
    const saved = winChallenge(p, 'farm', 0);
    const afterChallenge = ends(p);
    const other = startChallenge(p, 'barracks', 0);
    const challenged = p.village.sites.map((site) => `${site.building} ${site.challenged}`).join(', ');
    const none = [useAccelerator(p, 'forge', 0), canChallenge(p, 'forge', 0), winChallenge(p, 'forge', 0)];
    return { opened, accelerated, afterAccelerator, challenge, open, saved, afterChallenge, other, challenged, none };
  });
  const { opened, accelerated, afterAccelerator, challenge, open, saved, afterChallenge, other, challenged, none } =
    result;
  check(
    `due cantieri (fine in minuti ${opened}): acceleratore sulla caserma ${accelerated} → ${afterAccelerator}; sfida della fattoria ${challenge}, di nuovo ${open.farm}, quella della caserma ancora da fare ${open.barracks}; vinta: tolti ${saved / MINUTE} min → ${afterChallenge}; poi la sfida della caserma ${other} (${challenged}); sulla fucina senza cantiere ${none.join('/')}`,
    opened === 'farm 60, barracks 90' && accelerated && afterAccelerator === 'farm 60, barracks 60' && challenge &&
      !open.farm && open.barracks && saved === 30 * MINUTE && afterChallenge === 'farm 30, barracks 60' && other &&
      challenged === 'farm true, barracks true' && none.join() === 'false,false,0',
  );
  check.done();
});

// A1. Il prossimo obiettivo è per un posto libero: senza contare gli edifici già in cantiere, con quanto manca; a posti
// tutti occupati nessuno, e la riga dice i posti e il cantiere che finisce per primo; con un posto solo come prima
test('A1. Prossimo obiettivo con i posti cantiere liberi e occupati', (t) => {
  const check = checker(t);
  const { nextGoal, startUpgrade } = villageMeta;
  const two = withBuilders(2, () => {
    const p = createProfile();
    const first = nextGoal(p);
    startUpgrade(p, 'farm', 0);
    const free = nextGoal(p);
    const freeText = goalText(p, 0);
    Object.assign(p.resources, { materials: 500, scrap: 500 });
    startUpgrade(p, 'barracks', 0);
    const busy = nextGoal(p);
    const busyText = goalText(p, 30000);
    const q = createProfile();
    q.village.levels.farm = VILLAGE.buildings.farm.maxLevel;
    q.village.levels.barracks = VILLAGE.buildings.barracks.maxLevel;
    q.resources.scrap = 50;
    startUpgrade(q, 'forge', 0);
    return { first, free, freeText, busy, busyText, rest: nextGoal(q), restText: goalText(q, 0) };
  });
  const one = withBuilders(1, () => {
    const p = createProfile();
    startUpgrade(p, 'farm', 0);
    return { goal: nextGoal(p), text: goalText(p, 0) };
  });
  const missing = VILLAGE.buildings.barracks.costs[0].materials -
    (VILLAGE.start.materials - VILLAGE.buildings.farm.costs[0].materials);
  check(
    `due posti: da zero ${two.first.building}; con la fattoria in cantiere ${JSON.stringify(two.free)} «${two.freeText}»; con anche la caserma ${two.busy} «${two.busyText}»; con l'ultimo edificio in cantiere ${two.rest} «${two.restText}»; un posto, con la fattoria in cantiere ${one.goal} «${one.text}»`,
    two.first.building === 'farm' &&
      two.free.building === 'barracks' &&
      two.free.missing.materials === missing &&
      two.freeText.startsWith('Prossimo: Caserma liv. 1') &&
      two.busy === null &&
      two.busyText === 'Cantieri: 2/2 · Fattoria liv. 1 finisce tra 30 s' &&
      two.rest === null &&
      two.restText === 'Cantieri: 1/2 · Fucina liv. 1 finisce tra 3 min' &&
      one.goal === null &&
      one.text === 'Cantieri: 1/1 · Fattoria liv. 1 finisce tra 1 min',
  );
  check.done();
});

// A1. I cantieri salvati, rimessi a posto: fuori quelli di edifici sconosciuti o al massimo, con una fine non valida,
// i doppioni dello stesso edificio e quelli oltre i posti cantiere, nel loro ordine; una lista che non è una lista è
// vuota. Ha un posto solo l'edificio che resta in cantiere (o è costruito)
test('A1. Cantieri salvati: uno per edificio, al massimo uno per posto cantiere', (t) => {
  const check = checker(t);
  const village = {
    levels: { farm: 1, barracks: 0, forge: VILLAGE.buildings.forge.maxLevel },
    sites: [
      { building: 'tower', endsAt: 5 },
      { building: 'farm', endsAt: 10, challenged: true },
      { building: 'forge', endsAt: 20 },
      { building: 'farm', endsAt: 30 },
      { building: 'barracks', endsAt: 'domani' },
      { building: 'barracks', endsAt: 40 },
      null,
    ],
  };
  const read = (count) => withBuilders(count, () => profileFrom({ village }).village);
  const [one, two, three] = [read(1), read(2), read(3)];
  const notList = profileFrom({ village: { sites: { building: 'farm', endsAt: 10 } } }).village.sites;
  const sitesOf = (v) => JSON.stringify(v.sites);
  const farmSite = '{"building":"farm","endsAt":10,"challenged":true}';
  check(
    `cantieri salvati: con 1 posto ${sitesOf(one)} (caserma al suo posto ${one.positions.barracks !== null}); con 2 ${sitesOf(two)} (caserma al suo posto ${two.positions.barracks !== null}); con 3 ${sitesOf(three)}; non una lista ${JSON.stringify(notList)}`,
    sitesOf(one) === `[${farmSite}]` &&
      one.positions.barracks === null &&
      sitesOf(two) === `[${farmSite},{"building":"barracks","endsAt":40,"challenged":false}]` &&
      two.positions.barracks !== null &&
      sitesOf(three) === sitesOf(two) &&
      notList.length === 0,
  );
  check.done();
});
