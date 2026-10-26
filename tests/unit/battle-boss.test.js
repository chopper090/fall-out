import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  BOSS,
  BOSS_PHASES,
  ENEMIES,
  ENEMY_TYPES,
  EVENTS,
  FX,
  HERO,
  LEVEL,
  MISSION,
  WAVES,
  WEAPONS,
  battle,
  bossBattle,
  dt,
  laneCenters,
  placeEnemy,
  restore,
  run,
  weaponArena,
} from '../support/suite.js';

// 41. All'arrivo del boss il campo si ferma; il boss cammina da solo a BOSS.walkSpeed fino a holdZ e lì si pianta
test("41. All'arrivo del boss il campo si ferma; il boss cammina da solo a BOSS.walkSpeed fi...", async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = bossBattle({ size: 1 });
  run(b, 1, () => b.boss.enemy !== null);
  const enemy = b.boss.enemy;
  const z0 = enemy.z;
  // Frame in cui il campo scende, nei 2 s della camminata
  let fieldMoved = 0;
  for (let i = 0; i < 120; i++) {
    b.step();
    if (b.scroll.speed !== 0) fieldMoved += 1;
  }
  const walked = (z0 - enemy.z) / 2;
  run(b, 30, () => b.boss.phase !== BOSS_PHASES.walk);
  const planted = enemy.z;
  run(b, 3);
  restore(HERO, 'fireRate');
  check(
    `boss a campo fermo: campo ${b.scroll.speed} (frame in moto ${fieldMoved}), il boss cammina a ${walked.toFixed(0)}/s (atteso ${BOSS.walkSpeed}), si pianta a ${planted} (holdZ ${BOSS.holdZ}) e resta a ${enemy.z}`,
    b.scroll.speed === 0 &&
      fieldMoved === 0 &&
      Math.abs(walked - BOSS.walkSpeed) < 1 &&
      planted === BOSS.holdZ &&
      enemy.z === BOSS.holdZ,
  );
  check.done();
});

// 42. Il boss arriva solo a strada libera: aspetta che passino cancelli, scrigni e nemici rimasti dall'ultima ondata
test('42. Il boss arriva solo a strada libera: aspetta che passino cancelli, scrigni e nemici...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = battle({ size: 1, startWave: WAVES.length });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  let waveEnd = null;
  let bossStart = null;
  let leftAtEnd = null;
  b.bus.on(EVENTS.WAVE_ENDED, () => {
    waveEnd = b.log.t;
  });
  b.bus.on(EVENTS.BOSS_STARTED, () => {
    bossStart = b.log.t;
    // Il boss è appena entrato: conta tutto il resto
    leftAtEnd = b.spawner.enemies.filter((e) => e !== b.boss.enemy).length + b.gates.list.length + b.chests.list.length;
  });
  let lastItem = null;
  for (let i = 0; i < 60 * 60 && bossStart === null; i++) {
    b.step();
    const left =
      b.spawner.enemies.filter((e) => e !== b.boss.enemy).length + b.gates.list.length + b.chests.list.length;
    if (waveEnd !== null && bossStart === null && left > 0) lastItem = b.log.t;
  }
  restore(MISSION, 'maxEscaped');
  restore(HERO, 'fireRate');
  const pause = (bossStart - waveEnd) / 1000;
  check(
    `boss a strada libera: dalla fine dell'ultima ondata ${pause.toFixed(1)} s (pausa ${LEVEL.breakSeconds} s), in strada al suo arrivo ${leftAtEnd}, ultimo oggetto passato ${((lastItem - waveEnd) / 1000).toFixed(1)} s dopo la fine`,
    bossStart !== null && leftAtEnd === 0 && pause >= LEVEL.breakSeconds && bossStart > lastItem,
  );
  check.done();
});

// 43. La scorta cammina da sola verso gli eroi a escort.walkSpeed
test('43. La scorta cammina da sola verso gli eroi a escort.walkSpeed', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = bossBattle({ size: 1 });
  let escort = null;
  for (let i = 0; i < 60 * 20 && !escort; i++) {
    b.step();
    escort = b.spawner.enemies.find((e) => e.type === ENEMY_TYPES.swarm) ?? null;
  }
  const z0 = escort.z;
  for (let i = 0; i < 30; i++) b.step();
  const speed = (z0 - escort.z) / 0.5;
  restore(HERO, 'fireRate');
  check(
    `scorta a campo fermo: cammina a ${speed.toFixed(0)}/s (attesa ${BOSS.escort.walkSpeed})`,
    Math.abs(speed - BOSS.escort.walkSpeed) < 1,
  );
  check.done();
});

// 44. Il boss non si scontra mai, anche piantato a ridosso della folla
test('44. Il boss non si scontra mai, anche piantato a ridosso della folla', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const holdZ = BOSS.holdZ;
  BOSS.holdZ = 60;
  const b = bossBattle({ size: 60 });
  let clashed = 0;
  b.bus.on(EVENTS.ENEMY_CLASHED, (e) => {
    if (e === b.boss.enemy) clashed += 1;
  });
  run(b, 25, () => b.boss.phase === BOSS_PHASES.rest && b.boss.enemy?.z === 60);
  run(b, 3);
  BOSS.holdZ = holdZ;
  restore(HERO, 'fireRate');
  check(
    `boss a ridosso della folla (holdZ 60, fronte della folla ${b.army.front.toFixed(0)}): scontri ${clashed}, ancora in strada ${b.boss.enemy !== null}`,
    clashed === 0 && b.boss.enemy !== null,
  );
  check.done();
});

// 45. Piantato schiaccia ogni pochi secondi; le granate scoppiano su di lui
test('45. Piantato schiaccia ogni pochi secondi; le granate scoppiano su di lui', async (t) => {
  const check = checker(t);
  const b = bossBattle({ size: 60 });
  MISSION.maxEscaped = 1e9;
  for (const s of b.army.soldiers) s.weapon = 'launcher';
  run(b, 1, () => b.boss.enemy !== null);
  b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
  run(b, 30, () => b.boss.phase !== BOSS_PHASES.walk);
  let smashes = 0;
  let blastHits = 0;
  // Colpi delle granate dei soldati: il danno del lanciatore, con quello in più delle riserve
  const grenadeDamage = () => WEAPONS.launcher.damage * b.army.damageScale * (1 + b.army.reserveBonus);
  b.bus.on(EVENTS.BOSS_SMASHED, () => {
    smashes += 1;
  });
  b.bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
    if (enemy === b.boss.enemy && Math.abs(damage - grenadeDamage()) < 1e-9) blastHits += 1;
  });
  run(b, 20);
  restore(MISSION, 'maxEscaped');
  const cycle = BOSS.restSeconds + BOSS.smash.warnSeconds;
  check(
    `boss piantato: ${smashes} schiacciamenti in 20 s (pausa + avviso ${cycle.toFixed(1)} s più il cambio di corsia), granate dei soldati arrivate sul boss ${blastHits}`,
    smashes >= 3 && blastHits > 0,
  );
  check.done();
});

// 46. Livello intero: il boss arriva, cammina, si pianta e viene abbattuto; il campo riparte solo con un nuovo livello
test('46. Livello intero: il boss arriva, cammina, si pianta e viene abbattuto; il campo ripa...', async (t) => {
  const check = checker(t);
  const b = battle({ size: 80, seed: 21 });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  let bossStart = null;
  let bossEnd = null;
  let movedDuringBoss = 0;
  b.bus.on(EVENTS.BOSS_STARTED, () => {
    bossStart = b.log.t;
  });
  b.bus.on(EVENTS.BOSS_ENDED, () => {
    bossEnd = b.log.t;
  });
  for (let i = 0; i < 60 * 900 && !b.log.over; i++) {
    if (i % 30 === 0 && b.boss.enemy) b.bus.emit(EVENTS.STEER, b.boss.enemy.x - b.army.x);
    b.step();
    if (bossStart !== null && b.scroll.speed !== 0) movedDuringBoss += 1;
  }
  restore(MISSION, 'maxEscaped');
  check(
    `livello con il boss a campo fermo: boss abbattuto in ${((bossEnd - bossStart) / 1000).toFixed(1)} s, frame con il campo in moto dopo il suo arrivo ${movedDuringBoss}, partita ${b.log.over}`,
    bossEnd !== null && movedDuringBoss === 0 && b.log.over === 'completata',
  );
  check.done();
});

// 47. La scritta "Boss" compare quando il boss arriva, non durante l'attesa della strada libera
test('47. La scritta "Boss" compare quando il boss arriva, non durante l\'attesa della strada...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = battle({ size: 1, startWave: WAVES.length });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  const bannerMs = LEVEL.bannerSeconds * 1000;
  let bannerWhileWaiting = 0;
  let sinceAtArrival = null;
  let waveEnded = false;
  b.bus.on(EVENTS.WAVE_ENDED, () => {
    waveEnded = true;
  });
  b.bus.on(EVENTS.BOSS_SPAWNED, () => {
    sinceAtArrival = b.waves.sinceAnnounceMs;
  });
  for (let i = 0; i < 60 * 60 && sinceAtArrival === null; i++) {
    b.step();
    if (waveEnded && sinceAtArrival === null && b.waves.bossNext && b.waves.sinceAnnounceMs < bannerMs)
      bannerWhileWaiting += 1;
  }
  restore(MISSION, 'maxEscaped');
  restore(HERO, 'fireRate');
  check(
    `scritta del boss: frame con la scritta durante l'attesa ${bannerWhileWaiting}, all'arrivo del boss sinceAnnounceMs ${sinceAtArrival}`,
    bannerWhileWaiting === 0 && sinceAtArrival === 0,
  );
  check.done();
});

// 48. Anche con il boss piantato la scorta esce davanti a lui, nella sua corsia
test('48. Anche con il boss piantato la scorta esce davanti a lui, nella sua corsia', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = bossBattle({ size: 1 });
  MISSION.maxEscaped = 1e9;
  let frontCalls = 0;
  let frontSpawned = 0;
  let calls = 0;
  // Il sistema dei nemici risponde prima: se la scorta è uscita, le sue pedine sono già davanti al boss
  b.bus.on(EVENTS.BOSS_ESCORT, ({ lane, front }) => {
    calls += 1;
    if (!front || b.boss.phase === BOSS_PHASES.walk) return;
    frontCalls += 1;
    const boss = b.boss.enemy;
    const fresh = b.spawner.enemies.some(
      (e) => e.swarm && Math.abs(e.x - laneCenters[lane]) < 120 && e.z < boss.z && e.z > BOSS.escort.minZ - 1,
    );
    if (fresh) frontSpawned += 1;
  });
  for (let i = 0; i < 60 * 120; i++) b.step();
  restore(MISSION, 'maxEscaped');
  restore(HERO, 'fireRate');
  check(
    `scorta davanti al boss piantato: ${frontSpawned} uscite su ${frontCalls} chiamate (in tutto ${calls}, minZ ${BOSS.escort.minZ})`,
    frontCalls > 0 && frontSpawned === frontCalls,
  );
  check.done();
});

// 49. Durante le ondate, con il campo che scorre, i colpi non frenano nessuno
test('49. Durante le ondate, con il campo che scorre, i colpi non frenano nessuno', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 30 });
  const enemy = placeEnemy(b, b.army.x, 700, 1e6);
  let hits = 0;
  let maxBrake = 0;
  b.bus.on(EVENTS.ENEMY_HIT, (p) => {
    if (p.enemy === enemy) hits += 1;
  });
  for (let i = 0; i < 120; i++) {
    b.step();
    enemy.z = 700;
    maxBrake = Math.max(maxBrake, enemy.brake);
  }
  check(`campo in moto (${b.scroll.speed}/s): ${hits} colpi, freno massimo ${maxBrake}`, hits > 0 && maxBrake === 0);
  check.done();
});

// 50. A campo fermo un colpo frena di strength volte la parte di vita che toglie; il freno si dimezza in halfLifeMs
test('50. A campo fermo un colpo frena di strength volte la parte di vita che toglie; il fren...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = bossBattle({ size: 1 });
  run(b, 1, () => b.boss.enemy !== null);
  b.step();
  const pawn = placeEnemy(b, laneCenters[0], 1500, 100, ENEMY_TYPES.swarm);
  pawn.extraSpeed = BOSS.escort.walkSpeed;
  b.bus.emit(EVENTS.ENEMY_HIT, { enemy: pawn, damage: 2 });
  const expected = Math.min(1, (ENEMIES.brake.strength * 2) / 100);
  const afterHit = pawn.brake;
  const frames = Math.round(ENEMIES.brake.halfLifeMs / dt);
  for (let i = 0; i < frames; i++) b.step();
  const ratio = pawn.brake / afterHit;
  restore(HERO, 'fireRate');
  check(
    `freno di un colpo da 2 su 100 di vita: ${afterHit.toFixed(3)} (atteso ${expected.toFixed(3)}); dopo ${ENEMIES.brake.halfLifeMs} ms ne resta ${(100 * ratio).toFixed(0)}%`,
    Math.abs(afterHit - expected) < 1e-9 && Math.abs(ratio - 0.5) < 0.03,
  );
  check.done();
});

// 51. Una raffica fitta tiene ferma la scorta, con la sua vita vera: dal primo colpo alla morte una pedina non avanza
// quasi più
test('51. Una raffica fitta tiene ferma la scorta, con la sua vita vera: dal primo colpo alla...', async (t) => {
  const check = checker(t);
  const b = bossBattle({ size: 60 });
  MISSION.maxEscaped = 1e9;
  for (const s of b.army.soldiers) s.weapon = 'burst';
  run(b, 1, () => b.boss.enemy !== null);
  b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
  // Uno sciame di scorta nella corsia dell'esercito, che sta per entrare a tiro della raffica
  const pawnHp = Math.max(1, Math.round(BOSS.enemyHp * ENEMY_TYPES.swarm.hpScale));
  const pawns = new Map();
  for (let n = 0; n < 5; n++) {
    const pawn = placeEnemy(b, b.army.x - 64 + n * 32, 760, pawnHp, ENEMY_TYPES.swarm);
    pawn.extraSpeed = BOSS.escort.walkSpeed;
    pawns.set(pawn, { hitZ: null, hitT: null, endZ: null, endT: null });
  }
  b.bus.on(EVENTS.ENEMY_HIT, ({ enemy }) => {
    const r = pawns.get(enemy);
    if (r && r.hitZ === null) Object.assign(r, { hitZ: enemy.z, hitT: b.log.t });
  });
  b.bus.on(EVENTS.ENEMY_KILLED, (enemy) => {
    const r = pawns.get(enemy);
    if (r && r.endZ === null) Object.assign(r, { endZ: enemy.z, endT: b.log.t });
  });
  for (let i = 0; i < 120; i++) b.step();
  restore(MISSION, 'maxEscaped');
  const held = [...pawns.values()].filter((r) => r.hitZ !== null && r.endZ !== null && r.endT > r.hitT);
  const speeds = held.map((r) => (r.hitZ - r.endZ) / ((r.endT - r.hitT) / 1000));
  check(
    `raffica sulla scorta (${pawnHp} di vita): dal primo colpo alla morte le pedine avanzano a ${speeds.map((v) => v.toFixed(0)).join(', ')}/s (senza freno ${BOSS.escort.walkSpeed})`,
    held.length >= 3 && speeds.every((v) => v < 0.2 * BOSS.escort.walkSpeed),
  );
  check.done();
});

// 52. Il boss sotto il fuoco rallenta, ma mai oltre maxBrake: non si ferma mai del tutto, nemmeno dietro una pedina
// della sua scorta ferma
test('52. Il boss sotto il fuoco rallenta, ma mai oltre maxBrake: non si ferma mai del tutto,...', async (t) => {
  const check = checker(t);
  const b = bossBattle({ size: 100 });
  MISSION.maxEscaped = 1e9;
  run(b, 1, () => b.boss.enemy !== null);
  const boss = b.boss.enemy;
  boss.hp = boss.maxHp = BOSS.hp;
  const blocker = placeEnemy(b, boss.x, boss.z - 130, 1e9, ENEMY_TYPES.swarm);
  blocker.brake = 1;
  let maxBrake = 0;
  let minSpeed = Infinity;
  let prevZ = boss.z;
  while (b.boss.phase === BOSS_PHASES.walk && b.spawner.enemies.includes(boss)) {
    b.step();
    if (b.boss.phase !== BOSS_PHASES.walk) break;
    minSpeed = Math.min(minSpeed, (prevZ - boss.z) / (dt / 1000));
    prevZ = boss.z;
    maxBrake = Math.max(maxBrake, boss.brake);
    boss.hp = Math.max(boss.hp, 1);
    blocker.brake = 1;
  }
  restore(MISSION, 'maxEscaped');
  const floor = BOSS.walkSpeed * (1 - ENEMY_TYPES.boss.maxBrake);
  check(
    `boss sotto il fuoco: freno massimo ${maxBrake.toFixed(2)} (limite ${ENEMY_TYPES.boss.maxBrake}), passo più lento ${minSpeed.toFixed(0)}/s (mai sotto ${floor.toFixed(0)})`,
    maxBrake > 0.3 && maxBrake <= ENEMY_TYPES.boss.maxBrake + 1e-9 && minSpeed >= floor - 1e-6,
  );
  check.done();
});

// 53. Il boss piantato resta fermo anche frenato
test('53. Il boss piantato resta fermo anche frenato', async (t) => {
  const check = checker(t);
  const b = bossBattle({ size: 80 });
  MISSION.maxEscaped = 1e9;
  run(b, 1, () => b.boss.enemy !== null);
  b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
  run(b, 30, () => b.boss.phase !== BOSS_PHASES.walk);
  let drift = 0;
  for (let i = 0; i < 300; i++) {
    b.step();
    drift = Math.max(drift, Math.abs(b.boss.enemy.z - BOSS.holdZ));
  }
  restore(MISSION, 'maxEscaped');
  check(`boss piantato sotto il fuoco: si sposta al massimo di ${drift}`, drift === 0);
  check.done();
});

// 57. Il boss piantato non accumula freno (non cammina): sotto di lui niente disco
test('57. Il boss piantato non accumula freno (non cammina): sotto di lui niente disco', async (t) => {
  const check = checker(t);
  const b = bossBattle({ size: 80 });
  MISSION.maxEscaped = 1e9;
  run(b, 1, () => b.boss.enemy !== null);
  b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
  run(b, 30, () => b.boss.phase !== BOSS_PHASES.walk);
  run(b, 1);
  let maxBrake = 0;
  for (let i = 0; i < 300; i++) {
    b.step();
    maxBrake = Math.max(maxBrake, b.boss.enemy.brake);
  }
  restore(MISSION, 'maxEscaped');
  check(
    `boss piantato sotto il fuoco: freno massimo ${maxBrake.toFixed(3)} (il disco compare da ${FX.brake.minBrake})`,
    maxBrake < FX.brake.minBrake,
  );
  check.done();
});

// R. Due boss insieme non si attraversano mai: cambiando corsia un boss non passa per quella dell'altro (né per quella
// dove l'altro sta andando), e i due corpi restano sempre lontani almeno la loro larghezza; uno chiuso al bordo resta
// fermo finché non si libera la strada
test('R. Due boss insieme non si attraversano mai: cambiando corsia un boss non passa per que...', async (t) => {
  const check = checker(t);
  let closest = Infinity;
  let moves = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const b = battle({ size: 1, seed, startWithBoss: true, type: 'double' });
    for (const hero of b.army.heroes) hero.hp = hero.maxHp = 1e9;
    MISSION.maxEscaped = 1e9;
    run(b, 2, () => b.bosses.list.length === 2);
    for (const boss of b.bosses.list) boss.enemy.hp = boss.enemy.maxHp = 1e9;
    let lanes = b.bosses.list.map((boss) => boss.lane).join();
    for (let i = 0; i < 60 * 40 && b.bosses.list.length === 2; i++) {
      b.step();
      const [one, two] = b.bosses.list;
      closest = Math.min(closest, Math.abs(one.enemy.x - two.enemy.x));
      const now = b.bosses.list.map((boss) => boss.lane).join();
      if (now !== lanes) moves += 1;
      lanes = now;
    }
    restore(MISSION, 'maxEscaped');
  }
  check(
    `due boss: cambi di corsia ${moves}, distanza più piccola tra i centri ${closest.toFixed(0)} (larghi ${ENEMY_TYPES.boss.size})`,
    moves > 0 && closest >= ENEMY_TYPES.boss.size,
  );
  check.done();
});
