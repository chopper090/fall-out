import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  ARMY, CHEST_KINDS, EVENTS, FORMATION, HERO, LANES, LIMITS, LINEUP, PLATOONS, battle, count, createArmy,
  createEventBus, createRng, crowdState, dt, laneCenters, root, run, updateArmy, weaponArena, weaponsOf,
} from '../support/suite.js';

// 85. Posti della folla: in ordine dal centro degli eroi (spostato di frontBias), ognuno a non più di jitter dal suo
// punto della griglia e quasi nessuno esattamente lì, nessuno oltre back dietro; molti più del tetto; vicini
// reciproci, al massimo sei, tutti accanto
test('85. Posti della folla: in ordine dal centro degli eroi (spostato di frontBias), ognuno...', async (t) => {
  const check = checker(t);
  const { createFormation } = await import(root + 'systems/formation.js');
  const heroes = HERO.slots.map(({ dx, dz }) => ({ dx, dz }));
  const { slots } = createFormation(createRng(7), heroes);
  const cx = heroes.reduce((sum, h) => sum + h.dx, 0) / heroes.length;
  const cz = heroes.reduce((sum, h) => sum + h.dz, 0) / heroes.length + FORMATION.frontBias;
  const dist = (slot) => Math.hypot(slot.dx - cx, slot.dz - cz);
  const ordered = slots.every((slot, i) => i === 0 || dist(slot) >= dist(slots[i - 1]) - 1e-9);
  const rowStep = (FORMATION.spacing * Math.sqrt(3)) / 2;
  let worst = 0;
  let onGrid = 0;
  for (const slot of slots) {
    const row = Math.round(slot.dz / rowStep);
    const shift = Math.abs(row) % 2 === 1 ? FORMATION.spacing / 2 : 0;
    const column = Math.round((slot.dx - shift) / FORMATION.spacing);
    const ox = slot.dx - (column * FORMATION.spacing + shift);
    const oz = slot.dz - row * rowStep;
    worst = Math.max(worst, Math.abs(ox), Math.abs(oz));
    if (Math.abs(ox) < 0.5 && Math.abs(oz) < 0.5) onGrid += 1;
  }
  const behind = slots.filter((slot) => slot.dz < -FORMATION.back).length;
  const mutual = slots.every((slot) => slot.neighbors.length <= 6 && slot.neighbors.every((n) => n.neighbors.includes(slot)));
  const farthest = Math.max(...slots.flatMap((slot) => slot.neighbors.map((n) => Math.hypot(n.dx - slot.dx, n.dz - slot.dz))));
  const indexed = slots.every((slot, i) => slot.index === i && slot.open);
  check(`posti della folla: ${slots.length} (tetto ${LIMITS.maxArmy - 1}), in ordine dal centro degli eroi ${ordered}, spostamento massimo dalla griglia ${worst.toFixed(1)} (jitter ${FORMATION.jitter}), esattamente sulla griglia ${onGrid}, dietro il limite ${behind}; vicini reciproci ${mutual}, il più lontano a ${farthest.toFixed(1)}`,
    slots.length >= 2 * (LIMITS.maxArmy - 1) && ordered && worst <= FORMATION.jitter + 1e-9 && onGrid <= slots.length * 0.02 &&
    behind === 0 && mutual && farthest < FORMATION.spacing + 2 * Math.SQRT2 * FORMATION.jitter && indexed);
  check.done();
});

// 86. Eroi fuori riga: di lato restano al loro posto (le misure per i colpi al centro e per i centri delle corsie),
// avanti o indietro si spostano di al massimo slotJitter, diversamente a ogni partita
test('86. Eroi fuori riga: di lato restano al loro posto (le misure per i colpi al centro e p...', async (t) => {
  const check = checker(t);
  const lineups = new Set();
  let sideOk = true;
  let depthOk = true;
  for (let seed = 1; seed <= 6; seed++) {
    const b = battle({ size: 1, seed });
    for (const h of b.army.heroes) {
      const slot = HERO.slots[LINEUP.find((e) => e.hero === h.id).slot];
      sideOk &&= h.dx === slot.dx;
      depthOk &&= Math.abs(h.dz - slot.dz) <= HERO.slotJitter;
    }
    lineups.add(b.army.heroes.map((h) => h.dz.toFixed(2)).join(','));
  }
  check(`eroi fuori riga: di lato al loro posto ${sideOk}, avanti o indietro entro ${HERO.slotJitter} ${depthOk}, schieramenti diversi in 6 partite ${lineups.size}`,
    sideOk && depthOk && lineups.size === 6);
  check.done();
});

// 87. Goccia contro il bordo: la folla piena va fino in fondo con gli eroi al centro della corsia esterna (e oltre,
// fino al loro limite), i soldati restano in strada, scorrono nei posti liberi e si fermano; ognuno tiene la sua arma
// e le élite le loro vite. Tornando in mezzo la folla riprende la sua forma libera
test('87. Goccia contro il bordo: la folla piena va fino in fondo con gli eroi al centro dell...', async (t) => {
  const check = checker(t);
  const { ELITE } = await import(root + 'data/units.js');
  const b = weaponArena({ size: 100 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 200 });
  run(b, 2);
  const weaponsOf = (army) => army.soldiers.map((s) => s.weapon).sort().join(',');
  const before = weaponsOf(b.army);
  const elitesBefore = b.army.soldiers.filter((s) => s.elite).length;
  const middleRight = b.army.right;
  const reachOuter = laneCenters.every((c) => b.army.snapPoints.includes(c));
  b.bus.emit(EVENTS.STEER, -1000);
  run(b, 2);
  const wall = crowdState(b.army);
  const settled = b.army.soldiers.every((s) => Math.abs(s.offsetX) < 0.5 && Math.abs(s.offsetZ) < 0.5);
  const atWall = { x: b.army.x, minX: b.army.minX, right: b.army.right, closed: b.army.slots.filter((s) => !s.open).length };
  b.bus.emit(EVENTS.STEER, laneCenters[0] + 10 - b.army.x);
  b.bus.emit(EVENTS.STEER_END);
  run(b, 1);
  const snapped = b.army.x;
  b.bus.emit(EVENTS.STEER, laneCenters[1] - b.army.x);
  run(b, 2);
  const back = crowdState(b.army);
  const free = b.army.slots.slice(0, b.army.soldiers.length).every((slot) => slot.soldier !== null);
  const elites = b.army.soldiers.filter((s) => s.elite);
  check(`goccia: centri delle corsie con la folla piena ${reachOuter}; contro il bordo x ${atWall.x.toFixed(0)} (limite ${atWall.minX.toFixed(0)}), posti chiusi ${atWall.closed}, a destra degli eroi ${middleRight.toFixed(0)} → ${atWall.right.toFixed(0)}, soldati in posti aperti e primi ${wall.firstOk}, in strada ${wall.inRoad}, tutti ${wall.count}, fermi ${settled}; aggancio al centro della corsia esterna ${snapped.toFixed(0)}; di nuovo in mezzo forma libera ${free && back.firstOk}, armi uguali ${weaponsOf(b.army) === before}, élite ${elitesBefore} → ${elites.length} con tutte le vite ${elites.every((s) => s.lives === ELITE.lives)}`,
    reachOuter && atWall.x === atWall.minX && atWall.minX <= laneCenters[0] && atWall.closed > 0 && atWall.right > middleRight + 30 &&
    wall.firstOk && wall.inRoad && wall.count && wall.paired && settled && snapped === laneCenters[0] && free && back.firstOk &&
    back.count && weaponsOf(b.army) === before && elitesBefore > 0 && elites.length === elitesBefore && elites.every((s) => s.lives === ELITE.lives));
  check.done();
});

// 88. Partite intere con il bot: a ogni frame la folla è a posto (soldati nei primi posti aperti, in strada, quanti ne
// servono), e rimodellarla costa poco
test('88. Partite intere con il bot: a ogni frame la folla è a posto (soldati nei primi posti...', async (t) => {
  const check = checker(t);
  const { createBattle, updateBattle } = await import(root + 'systems/battle.js');
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  let frames = 0;
  let bad = 0;
  let closedFrames = 0;
  let ms = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const battle = createBattle(seed, createEventBus());
    const bot = createBot(1000 / 60);
    while (!battle.over && battle.ms < 400000) {
      updateBot(bot, battle);
      const t0 = performance.now();
      updateArmy(battle.army, 0);
      ms += performance.now() - t0;
      updateBattle(battle, 1000 / 60);
      frames += 1;
      const state = crowdState(battle.army);
      if (!(state.firstOk && state.inRoad && state.count && state.paired)) bad += 1;
      if (battle.army.slots.some((s) => !s.open)) closedFrames += 1;
    }
  }
  check(`partite col bot: ${frames} frame, folla fuori posto in ${bad}, contro il bordo in ${closedFrames} (${Math.round((100 * closedFrames) / frames)}%); folla rimodellata in ${(1000 * ms / frames).toFixed(1)} µs a frame`,
    frames > 0 && bad === 0 && closedFrames > 0 && ms / frames < 0.3);
  check.done();
});

// 91. Folla a riposo con lo schieramento vero, su 300 partite: ogni soldato sta esattamente al suo posto (nessun
// fianco spinto via dagli eroi) e nessun posto occupato ha spazio negativo verso gli eroi che ha di fianco
test('91. Folla a riposo con lo schieramento vero, su 300 partite: ogni soldato sta esattamen...', async (t) => {
  const check = checker(t);
  let away = 0;
  let negative = 0;
  let armies = 0;
  ARMY.startSize = 100;
  for (let seed = 1; seed <= 300; seed++) {
    const bus = createEventBus();
    const army = createArmy(bus, createRng(seed), { startX: laneCenters[1], laneCenters });
    for (let i = 0; i < 30; i++) updateArmy(army, dt);
    const half = PLATOONS.soldierSize / 2;
    const placed = (s) => Math.min(LANES.fieldWidth - half, Math.max(half, army.x + s.slot.dx));
    const off = army.soldiers.filter((s) => Math.abs(s.x - placed(s)) > 0.5).length;
    const bad = army.soldiers.filter((s) => s.slot.besideReach !== null && Math.abs(s.slot.dx) < s.slot.besideReach).length;
    if (off > 0) away += 1;
    if (bad > 0) negative += 1;
    armies += 1;
  }
  ARMY.startSize = 1;
  check(`folla a riposo in ${armies} partite: con soldati fuori posto ${away}, con posti a spazio negativo verso gli eroi ${negative}`,
    away === 0 && negative === 0);
  check.done();
});

// 92. Posti tutti legati tra loro con qualunque schieramento (ogni gruppo di posti degli eroi, 40 partite ciascuno): la
// folla trova sempre la sua catena
test('92. Posti tutti legati tra loro con qualunque schieramento (ogni gruppo di posti degli...', async (t) => {
  const check = checker(t);
  const { createFormation } = await import(root + 'systems/formation.js');
  let formations = 0;
  let broken = 0;
  for (let mask = 1; mask < 1 << HERO.slots.length; mask++) {
    const heroes = HERO.slots.filter((_, i) => mask & (1 << i)).map(({ dx, dz }) => ({ dx, dz }));
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      const jittered = heroes.map((h) => ({ dx: h.dx, dz: h.dz + (rng.float() * 2 - 1) * HERO.slotJitter }));
      const { slots } = createFormation(rng, jittered);
      const reached = new Set([slots[0]]);
      const queue = [slots[0]];
      for (let head = 0; head < queue.length; head++) {
        for (const n of queue[head].neighbors) if (!reached.has(n)) { reached.add(n); queue.push(n); }
      }
      formations += 1;
      if (reached.size !== slots.length || slots.some((s, i) => s.index !== i)) broken += 1;
    }
  }
  check(`posti legati tra loro: ${formations} schieramenti, spezzati ${broken}`, broken === 0);
  check.done();
});

// 93. Tetti: con la folla piena e tutta d'élite un'élite in più resta tra le riserve; con il tetto più alto del
// pannello, contro il bordo, tutti i soldati stanno in campo e uno scrigno d'élite non rompe niente
test('93. Tetti: con la folla piena e tutta d\'élite un\'élite in più resta tra le riserve; c...', async (t) => {
  const check = checker(t);
  LIMITS.maxArmy = 30;
  const small = weaponArena({ size: 1 });
  for (let i = 0; i < 4; i++) small.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.bigElite, x: small.army.x, z: 200 });
  run(small, 1);
  const elitesOnly = { field: small.army.soldiers.length, cap: small.army.maxSize - 1, elites: small.army.elites, reserves: small.army.reserves };
  LIMITS.maxArmy = 150;
  const big = weaponArena({ size: 160 });
  big.bus.emit(EVENTS.STEER, -1000);
  run(big, 2);
  let crashed = null;
  try {
    big.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: big.army.x, z: 200 });
    run(big, 1);
  } catch (error) {
    crashed = error.message;
  }
  const bigState = crowdState(big.army);
  LIMITS.maxArmy = 100;
  check(`tetti: tetto 30 e 40 élite, in campo ${elitesOnly.field} (tetto ${elitesOnly.cap}), élite in campo ${elitesOnly.elites}, riserve ${elitesOnly.reserves}; tetto 150 contro il bordo: in campo ${big.army.soldiers.length}, tutti ${bigState.count}, primi posti aperti ${bigState.firstOk}, errore ${crashed ?? 'nessuno'}`,
    elitesOnly.field === elitesOnly.cap && elitesOnly.elites === elitesOnly.cap && elitesOnly.reserves === 40 + 1 - 30 &&
    crashed === null && bigState.count && bigState.firstOk);
  check.done();
});
