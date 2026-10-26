import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  CHESTS, CHEST_KINDS, EVENTS, FX, GATES, GATE_KINDS, HERO, MISSION, PLATOONS, WAVES, WEAPONS, arrivals, battle,
  battlePlan, bumpScale, count, dt, landable, laneCenters, placeChest, placeEnemy, weaponArena,
} from '../support/suite.js';

// 28. Ogni ricompensa delle ondate esiste; tra le armi degli scrigni nessuna che li sorvoli (i cancelli: il 59)
test('28. Ogni ricompensa delle ondate esiste; tra le armi degli scrigni nessuna che li sorvo...', async (t) => {
  const check = checker(t);
  const gateNames = WAVES.flatMap((w) => [...Object.keys(w.gates.singles), ...w.gates.pairs.flatMap((p) => p.kinds)]);
  const rewardNames = WAVES.flatMap((w) => Object.keys(w.chests.rewards));
  const hits = WAVES.map((w) => w.chests.hits);
  const weapons = [...new Set(rewardNames.filter((n) => CHEST_KINDS[n].effect === 'weapon').map((n) => CHEST_KINDS[n].weapon))];
  check(`tipi delle ondate esistenti ${gateNames.every((n) => GATE_KINDS[n])}, ricompense esistenti ${rewardNames.every((n) => CHEST_KINDS[n])}; colpi per ondata ${hits.join(' ')}; armi negli scrigni ${weapons.join(' ')}`,
    gateNames.every((n) => GATE_KINDS[n]) && rewardNames.every((n) => CHEST_KINDS[n]) &&
    weapons.every((w) => WEAPONS[w].kind !== 'lob'));
  check.done();
});

// 29. Gli scrigni arrivano a metà tra due arrivi di cancelli, uno ogni everyGates, solo durante le ondate
test('29. Gli scrigni arrivano a metà tra due arrivi di cancelli, uno ogni everyGates, solo d...', async (t) => {
  const check = checker(t);
  const { chestTimes, gateTimes, outside } = arrivals();
  const interval = GATES.spawnInterval;
  const expected = [];
  for (let t = CHESTS.firstAfterGates * interval; t < WAVES[0].duration; t += interval * CHESTS.everyGates) expected.push(t);
  const close = chestTimes.length === expected.length && chestTimes.every((t, i) => Math.abs(t - expected[i]) < 0.05);
  const halfway = chestTimes.every((t) => gateTimes.some((g) => Math.abs(t - (g + interval / 2)) < 0.05));
  check(`scrigni dell'ondata 1 a ${chestTimes.map((t) => t.toFixed(2)).join(', ')} s (attesi ${expected.join(', ')}), cancelli a ${gateTimes.map((t) => t.toFixed(1)).join(', ')}; a metà ${halfway}; fuori ondata ${outside}`,
    close && halfway && outside === 0);
  // Il ritmo segue il cursore dei cancelli
  const saved = GATES.spawnInterval;
  GATES.spawnInterval = 3;
  const faster = arrivals();
  GATES.spawnInterval = saved;
  check(`con i cancelli ogni 3 s gli scrigni a ${faster.chestTimes.map((t) => t.toFixed(2)).join(', ')} s`,
    faster.chestTimes.length > 1 && Math.abs(faster.chestTimes[0] - 3 * CHESTS.firstAfterGates) < 0.05 &&
    Math.abs(faster.chestTimes[1] - 3 * (CHESTS.firstAfterGates + CHESTS.everyGates)) < 0.05);
  check.done();
});

// 30. Ogni colpo dritto toglie uno; a zero lo scrigno si apre una volta sola, sparisce e dà la sua ricompensa
test('30. Ogni colpo dritto toglie uno; a zero lo scrigno si apre una volta sola, sparisce e...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 20 });
  const chest = placeChest(b, 'damage', 1, 700, 12);
  let hits = 0;
  let opened = 0;
  let wrong = 0;
  b.bus.on(EVENTS.CHEST_HIT, (p) => { if (p.chest === chest) hits += 1; });
  b.bus.on(EVENTS.CHEST_OPENED, (c) => { if (c === chest) opened += 1; });
  for (let i = 0; i < 180; i++) {
    b.step();
    if (b.chests.list.includes(chest)) {
      chest.z = 700;
      if (chest.hits !== 12 - hits) wrong += 1;
    }
  }
  check(`scrigno a 12 colpi: ${hits} colpi, aperto ${opened} volta, ancora in strada ${b.chests.list.includes(chest)}, frame sbagliati ${wrong}; danno ${b.army.damageScale.toFixed(2)}`,
    hits === 12 && opened === 1 && !b.chests.list.includes(chest) && wrong === 0 && Math.abs(b.army.damageScale - 1.1) < 1e-9);
  check.done();
});

// 31. Ogni pallino della raffica conta uno; le granate volano sopra gli scrigni
test('31. Ogni pallino della raffica conta uno; le granate volano sopra gli scrigni', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = weaponArena({ size: 2 });
  const soldier = b.army.soldiers[0];
  soldier.weapon = 'burst';
  soldier.phase = 1;
  const chest = placeChest(b, 'damage', 1, 300, 1e6);
  chest.x = soldier.x;
  let hits = 0;
  b.bus.on(EVENTS.CHEST_HIT, (p) => { if (p.chest === chest) hits += 1; });
  for (let i = 0; i < 60 && hits === 0; i++) { b.step(); chest.z = 300; }
  for (let i = 0; i < 6; i++) { b.step(); chest.z = 300; }
  const firstVolley = hits;
  soldier.weapon = 'launcher';
  b.chests.list.length = 0;
  const lobbed = placeChest(b, 'damage', 1, WEAPONS.launcher.range, 1e6);
  lobbed.x = soldier.x;
  let grenadeHits = 0;
  b.bus.on(EVENTS.CHEST_HIT, (p) => { if (p.chest === lobbed) grenadeHits += 1; });
  for (let i = 0; i < 180; i++) { b.step(); lobbed.z = WEAPONS.launcher.range; }
  HERO.fireRate = undefined;
  check(`raffica sullo scrigno: prima raffica ${firstVolley} colpi (pallini ${WEAPONS.burst.pellets}); granate ${grenadeHits}`,
    firstVolley === WEAPONS.burst.pellets && grenadeHits === 0);
  check.done();
});

// 32. Lo scrigno chiuso ferma i colpi: il nemico dietro non viene colpito finché lo scrigno non si apre
test('32. Lo scrigno chiuso ferma i colpi: il nemico dietro non viene colpito finché lo scrig...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = weaponArena({ size: 2 });
  const soldier = b.army.soldiers[0];
  soldier.weapon = 'rifle';
  const chest = placeChest(b, 'fireRate', 1, 500, 6);
  chest.x = soldier.x;
  const enemy = placeEnemy(b, soldier.x, 800, 1e9);
  let enemyHitsBefore = 0;
  let enemyHitsAfter = 0;
  b.bus.on(EVENTS.ENEMY_HIT, (p) => {
    if (p.enemy !== enemy) return;
    if (b.chests.list.includes(chest)) enemyHitsBefore += 1;
    else enemyHitsAfter += 1;
  });
  for (let i = 0; i < 600; i++) { b.step(); if (b.chests.list.includes(chest)) chest.z = 500; enemy.z = 800; }
  HERO.fireRate = undefined;
  check(`scrigno davanti al nemico: colpi al nemico prima dell'apertura ${enemyHitsBefore}, dopo ${enemyHitsAfter}; cadenza ${b.army.fireRateScale.toFixed(2)}`,
    enemyHitsBefore === 0 && enemyHitsAfter > 0 && Math.abs(b.army.fireRateScale - 1.1) < 1e-9);
  check.done();
});

// 33. La cadenza in più vale per tutti: soldati ed eroi sparano amount più in fretta
test('33. La cadenza in più vale per tutti: soldati ed eroi sparano amount più in fretta', async (t) => {
  const check = checker(t);
  const countShots = (scale) => {
    const b = weaponArena({ size: 30 });
    b.army.fireRateScale = scale;
    let shots = 0;
    let grenades = 0;
    const acquire = b.combat.pool.acquire;
    b.combat.pool.acquire = () => { shots += 1; return acquire(); };
    const lob = b.combat.grenadePool.acquire;
    b.combat.grenadePool.acquire = () => { grenades += 1; return lob(); };
    for (let i = 0; i < 60 * 40; i++) b.step();
    return shots + grenades;
  };
  const normal = countShots(1);
  const faster = countShots(1 + CHEST_KINDS.fireRate.amount);
  const ratio = faster / normal;
  check(`cadenza degli scrigni: ${normal} colpi in 40 s, con +${100 * CHEST_KINDS.fireRate.amount}% ${faster} (×${ratio.toFixed(3)})`,
    Math.abs(ratio - (1 + CHEST_KINDS.fireRate.amount)) < 0.015);
  check.done();
});

// 34. Lo scrigno d'arma dà l'arma ai posti della folla davanti a lui, larghi CHESTS.armWidth; gli altri restano com'erano
test('34. Lo scrigno d\'arma dà l\'arma ai posti della folla davanti a lui, larghi CHESTS.arm...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 80 });
  const x = b.army.x + 150;
  const before = new Map(b.army.soldiers.map((s) => [s, s.weapon]));
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.burst, x, z: 700 });
  const reach = CHESTS.armWidth / 2 + PLATOONS.soldierSize / 2;
  let wrong = 0;
  let changed = 0;
  let kept = 0;
  for (const s of b.army.soldiers) {
    const inFront = Math.abs(b.army.x + s.slot.dx - x) < reach;
    const expected = inFront ? 'burst' : before.get(s);
    if (s.weapon !== expected) wrong += 1;
    if (inFront) changed += 1;
    else kept += 1;
  }
  check(`scrigno d'arma: ${changed} soldati con la raffica, ${kept} con l'arma di prima, sbagliati ${wrong}`, wrong === 0 && changed > 0 && kept > 0);
  check.done();
});

// 35. Uno scrigno chiuso che arriva alla folla è perso: sparisce senza ricompensa
test('35. Uno scrigno chiuso che arriva alla folla è perso: sparisce senza ricompensa', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 20 });
  const chest = placeChest(b, 'damage', 1, 900, 1e6);
  let opened = 0;
  let removed = 0;
  b.bus.on(EVENTS.CHEST_OPENED, () => { opened += 1; });
  b.bus.on(EVENTS.CHEST_REMOVED, (c) => { if (c === chest) removed += 1; });
  for (let i = 0; i < 60 * 8 && removed === 0; i++) b.step();
  check(`scrigno arrivato chiuso: sparito ${removed}, aperto ${opened}, danno ${b.army.damageScale}`,
    removed === 1 && opened === 0 && b.army.damageScale === 1 && !b.chests.list.includes(chest));
  check.done();
});

// 36. Effetti: lampo e scatto a ogni colpo, che si spengono quando lo scrigno sparisce; la ricompensa che sale dura
// FX.chestOpen.durationMs e poi torna nella pool
test('36. Effetti: lampo e scatto a ogni colpo, che si spengono quando lo scrigno sparisce; l...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 20 });
  const chest = placeChest(b, 'damage', 1, 700, 3);
  let flashed = false;
  let bumped = false;
  for (let i = 0; i < 120 && b.chests.list.includes(chest); i++) {
    b.step();
    if (b.chests.list.includes(chest)) chest.z = 700;
    if (b.chestFx.flashes.has(chest)) flashed = true;
    if (bumpScale(b.chestFx, chest) > 1) bumped = true;
  }
  const openNow = b.chestFx.opens.length;
  const leftover = b.chestFx.flashes.has(chest) || b.chestFx.bumps.has(chest);
  for (let i = 0; i < Math.ceil(FX.chestOpen.durationMs / dt) + 1; i++) b.step();
  check(`effetti dello scrigno: lampo ${flashed}, scatto ${bumped}, dopo l'apertura effetti rimasti ${leftover}, ricompensa che sale ${openNow} poi ${b.chestFx.opens.length}`,
    flashed && bumped && !leftover && openNow === 1 && b.chestFx.opens.length === 0);
  check.done();
});

// 37. Livello intero: tre scrigni a ondata, la pool non cresce, nessuno scrigno resta in strada a fine livello
test('37. Livello intero: tre scrigni a ondata, la pool non cresce, nessuno scrigno resta in...', async (t) => {
  const check = checker(t);
  const b = battle({ size: 40, seed: 11 });
  for (const hero of b.army.heroes) hero.hp = hero.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  const ids = new Set();
  let opened = 0;
  let removed = 0;
  let maxList = 0;
  b.bus.on(EVENTS.CHEST_OPENED, () => { opened += 1; });
  b.bus.on(EVENTS.CHEST_REMOVED, () => { removed += 1; });
  for (let i = 0; i < 60 * 900 && !b.log.over; i++) {
    // Come un giocatore, segue il boss nella sua corsia
    if (i % 30 === 0 && b.boss.enemy) b.bus.emit(EVENTS.STEER, b.boss.enemy.x - b.army.x);
    b.step();
    for (const c of b.chests.list) ids.add(c);
    maxList = Math.max(maxList, b.chests.list.length);
  }
  MISSION.maxEscaped = 3;
  const expected = WAVES.slice(0, battlePlan().waves).reduce((n, w) => n + Math.floor((w.duration / GATES.spawnInterval - CHESTS.firstAfterGates) / CHESTS.everyGates) + 1, 0);
  check(`livello intero: ${removed} scrigni (attesi ${expected}), aperti ${opened}; oggetti usati ${ids.size} (pool ${CHESTS.poolSize}), al massimo ${maxList} in strada, alla fine ${b.chests.list.length}; partita ${b.log.over}`,
    removed === expected && ids.size <= CHESTS.poolSize && b.chests.list.length === 0 && b.log.over === 'completata');
  check.done();
});

// 38. In ogni ondata una folla centrata sullo scrigno fa in tempo a dargli i colpi che servono, con un margine: almeno
// 1.25 volte, ma non più del doppio (non si apre per caso, passandogli davanti di sfuggita)
test('38. In ogni ondata una folla centrata sullo scrigno fa in tempo a dargli i colpi che se...', async (t) => {
  const check = checker(t);
  const sizes = [10, 40, 60, 80, 100, 120];
  const results = WAVES.map((w, i) => ({ wave: i + 1, size: sizes[i], need: w.chests.hits, got: landable(i, sizes[i]) }));
  check(`scrigni apribili: ${results.map((r) => `ondata ${r.wave} con ${r.size}: ${r.got} colpi per ${r.need} (x${(r.got / r.need).toFixed(1)})`).join('; ')}`,
    results.every((r) => r.got >= 1.25 * r.need && r.got <= 2 * r.need));
  check.done();
});

// 39. Dopo uno scrigno d'arma la folla apre ancora gli scrigni: la raffica colpisce anche loro
test('39. Dopo uno scrigno d\'arma la folla apre ancora gli scrigni: la raffica colpisce anch...', async (t) => {
  const check = checker(t);
  const after = landable(2, 60, (b) => b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.burst, x: b.army.x, z: 700 }));
  const need = WAVES[2].chests.hits;
  check(`dopo la raffica: ${after} colpi sullo scrigno dell'ondata 3 (servono ${need})`, after >= 1.5 * need);
  check.done();
});

// 40. Uno scrigno d'arma aperto quando la folla si è già spostata dà l'arma alla sua parte più vicina; il ritmo degli
// scrigni resta a metà tra i cancelli anche se il cursore cambia a ondata in corso
test('40. Uno scrigno d\'arma aperto quando la folla si è già spostata dà l\'arma alla sua pa...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 30, x: laneCenters[0] });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.burst, x: laneCenters[1], z: 700 });
  const armed = b.army.soldiers.filter((s) => s.weapon === 'burst').length;
  HERO.fireRate = 0;
  const c = battle({ size: 1 });
  c.army.leader.hp = c.army.leader.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  let waveStart = null;
  c.bus.on(EVENTS.WAVE_STARTED, () => { waveStart ??= c.log.t; });
  let prev = new Set();
  const times = [];
  const savedEvery = CHESTS.everyGates;
  for (let i = 0; i < 60 * 25; i++) {
    if (waveStart !== null && (c.log.t - waveStart) / 1000 > 7 && CHESTS.everyGates === savedEvery) CHESTS.everyGates = savedEvery + 1;
    c.step();
    for (const chest of c.chests.list) if (!prev.has(chest)) times.push((c.log.t - waveStart) / 1000);
    prev = new Set(c.chests.list);
  }
  CHESTS.everyGates = savedEvery;
  MISSION.maxEscaped = 3;
  HERO.fireRate = undefined;
  const phases = times.map((t) => ((t / GATES.spawnInterval) % 1).toFixed(2));
  check(`scrigno d'arma aperto a una corsia di distanza: ${armed} soldati con la raffica; con il cursore da 2 a 1 a metà ondata scrigni a ${times.map((t) => t.toFixed(1)).join(', ')} s (fase ${phases.join(' ')})`,
    armed > 0 && times.length >= 4 && phases.every((p) => p === '0.50'));
  check.done();
});

// 71. I colpi per aprire uno scrigno sono quelli dell'ondata per il valore della ricompensa
test('71. I colpi per aprire uno scrigno sono quelli dell\'ondata per il valore della ricompensa', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = battle({ size: 1 });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  let previous = new Set();
  const seen = [];
  for (let i = 0; i < 60 * 130 && !b.log.over && !b.waves.bossNext; i++) {
    b.step();
    for (const chest of b.chests.list) if (!previous.has(chest)) seen.push({ wave: b.waves.index, kind: chest.kind, hits: chest.hits });
    previous = new Set(b.chests.list);
  }
  HERO.fireRate = undefined;
  MISSION.maxEscaped = 3;
  const wrong = seen.filter((c) => c.hits !== Math.max(1, Math.round(WAVES[c.wave].chests.hits * c.kind.value)));
  const elites = seen.filter((c) => c.kind === CHEST_KINDS.elite);
  check(`colpi degli scrigni in proporzione al valore: ${seen.length} scrigni, ${elites.length} d'élite (${elites.map((c) => c.hits).join(' ')}), sbagliati ${wrong.length}`,
    seen.length > 0 && elites.length > 0 && wrong.length === 0 && Object.values(CHEST_KINDS).every((k) => k.value > 0));
  check.done();
});

// 74. Scrigno di vita: ogni eroe vivo riprende amount di vita, fino alla sua vita piena; i caduti non tornano
test('74. Scrigno di vita: ogni eroe vivo riprende amount di vita, fino alla sua vita piena;...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 10 });
  const [first, second] = b.army.heroes;
  first.hp = 1;
  second.hp = second.maxHp - 1;
  const others = b.army.heroes.length;
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.heal, x: b.army.x, z: 600 });
  const { amount } = CHEST_KINDS.heal;
  check(`scrigno di vita +${amount}: eroe da 1 a ${first.hp}, eroe quasi pieno a ${second.hp}/${second.maxHp}, eroi in campo ${others} -> ${b.army.heroes.length}`,
    first.hp === Math.min(first.maxHp, 1 + amount) && second.hp === second.maxHp && b.army.heroes.length === others);
  check.done();
});

// 75. Le ricompense forti (+20% di danno, tante élite) arrivano solo dalla terza ondata e chiedono più colpi delle
// stesse più deboli; ogni ricompensa delle ondate esiste e ha un valore
test('75. Le ricompense forti (+20% di danno, tante élite) arrivano solo dalla terza ondata e...', async (t) => {
  const check = checker(t);
  const early = WAVES.slice(0, 2).flatMap((w) => Object.keys(w.chests.rewards));
  const strong = ['bigDamage', 'bigElite'];
  const values = Object.entries(CHEST_KINDS).map(([name, kind]) => `${name} ${kind.value}`).join(', ');
  check(`ricompense forti solo dalla terza ondata: ${!early.some((n) => strong.includes(n))}; valori ${values}`,
    !early.some((n) => strong.includes(n)) && CHEST_KINDS.bigDamage.value > CHEST_KINDS.damage.value &&
    CHEST_KINDS.bigElite.value > CHEST_KINDS.elite.value && CHEST_KINDS.bigElite.count > CHEST_KINDS.elite.count &&
    CHEST_KINDS.bigDamage.amount > CHEST_KINDS.damage.amount);
  check.done();
});

// 76. Uno scrigno a ogni intervallo dei cancelli durante le ondate: in un livello intero tanti quanti gli intervalli
test('76. Uno scrigno a ogni intervallo dei cancelli durante le ondate: in un livello intero...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = battle({ size: 1 });
  for (const hero of b.army.heroes) hero.hp = hero.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  let previous = new Set();
  const perWave = WAVES.slice(0, battlePlan().waves).map(() => 0);
  for (let i = 0; i < 60 * 130 && !b.log.over && !b.waves.bossNext; i++) {
    b.step();
    for (const chest of b.chests.list) if (!previous.has(chest)) perWave[b.waves.index] += 1;
    previous = new Set(b.chests.list);
  }
  HERO.fireRate = undefined;
  MISSION.maxEscaped = 3;
  const expected = WAVES.slice(0, battlePlan().waves).map((w) => Math.floor((w.duration / GATES.spawnInterval - CHESTS.firstAfterGates) / CHESTS.everyGates) + 1);
  check(`scrigni per ondata: ${perWave.join(' ')} (attesi ${expected.join(' ')})`, perWave.join() === expected.join());
  check.done();
});

// 77. Gli eroi caduti non tornano con la vita dello scrigno
test('77. Gli eroi caduti non tornano con la vita dello scrigno', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 10 });
  const fallen = b.army.heroes.find((h) => !h.leader);
  b.bus.emit(EVENTS.HERO_HIT, { hero: fallen, damage: 1e9 });
  const before = b.army.heroes.length;
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.heal, x: b.army.x, z: 600 });
  check(`vita a un esercito con un eroe caduto: eroi ${before} -> ${b.army.heroes.length}, il caduto ha ${fallen.hp} di vita`,
    b.army.heroes.length === before && fallen.hp === 0 && !b.army.heroes.includes(fallen));
  check.done();
});
