// Il codice comune delle prove senza grafica: gli import del gioco e gli aiuti per costruire battaglie,
// villaggi e strade di prova. Ogni file di test ne prende solo quello che usa
const root = new URL('../../src/', import.meta.url).href;
const { ARMY, LEVEL, MISSION, ENEMIES, FX, HUD, ENEMY_SHOT, HERO, GATES, CHESTS, PLATOONS } = await import(root + 'config/balance.js');
const { CHEST_KINDS } = await import(root + 'data/chests.js');
const { createChests, reachChests, updateChests } = await import(root + 'systems/chests.js');
const { WEAPONS } = await import(root + 'data/units.js');
const WEAPON = WEAPONS.rifle;
const { grenadeHeight } = await import(root + 'systems/combat.js');
const { createHeroes, updateHeroes, cooldownShare } = await import(root + 'systems/heroes.js');
const { HEROES, LINEUP } = await import(root + 'data/heroes.js');
const { GATE_KINDS } = await import(root + 'data/gates.js');
const { LIMITS } = await import(root + 'data/waves.js');
const { isMalus } = await import(root + 'systems/gates.js');
const { WAVES, BOSS, LIMITS: LEVEL_LIMITS } = await import(root + 'data/waves.js');
const { ENEMY_TYPES, SWARM } = await import(root + 'data/enemies.js');
const { createEventBus, EVENTS } = await import(root + 'core/events.js');
const { createRng } = await import(root + 'core/rng.js');
const { createLanes } = await import(root + 'systems/lanes.js');
const { createScroll, updateScroll } = await import(root + 'systems/scroll.js');
const { createWaves, updateWaves, WAVE_PHASES, battlePlan } = await import(root + 'systems/waves.js');
const { createArmy, updateArmy } = await import(root + 'systems/army.js');
const { clashEnemies, createSpawner, updateSpawner } = await import(root + 'systems/spawn.js');
const { createGates, reachGates, updateGates } = await import(root + 'systems/gates.js');
const { createCombat, updateCombat } = await import(root + 'systems/combat.js');
const { createMission } = await import(root + 'systems/mission.js');
const { createBoss, updateBoss, layersLeft, layerFill, BOSS_PHASES, warnProgress } = await import(root + 'systems/boss.js');
const { createEnemyFx, updateEnemyFx, layerPulseScale } = await import(root + 'fx/enemyFx.js');
const { createEnemyFire, updateEnemyFire } = await import(root + 'systems/enemyFire.js');
const { createArmyFx, updateArmyFx } = await import(root + 'fx/armyFx.js');
const { createHeroFx, updateHeroFx } = await import(root + 'fx/heroFx.js');
const { createChestFx, updateChestFx, bumpScale } = await import(root + 'fx/chestFx.js');

const laneCenters = createLanes(3, 720).map((lane) => lane.centerX);
const laneOf = (x) => laneCenters.reduce((best, c, i) => (Math.abs(c - x) < Math.abs(laneCenters[best] - x) ? i : best), 0);
let dt = 1000 / 60;
const BOSS0 = JSON.parse(JSON.stringify(BOSS));
const resetBoss = () => Object.assign(BOSS, JSON.parse(JSON.stringify(BOSS0)));

function battle({ size = 1, x = laneCenters[1], seed = 3, startWave = 1, startWithBoss = false, length = 'medium' } = {}) {
  const bus = createEventBus();
  const rng = createRng(seed);
  ARMY.startSize = size;
  LEVEL.startWave = startWave;
  LEVEL.startWithBoss = startWithBoss;
  const scroll = createScroll(bus);
  const waves = createWaves(bus, battlePlan({ length }));
  const army = createArmy(bus, rng, { startX: x, laneCenters });
  if (HERO.fireRate === 0) for (const h of army.heroes) h.weapon = { ...h.weapon, fireRate: 0 };
  const spawner = createSpawner(bus, rng, laneCenters);
  const boss = createBoss(bus, rng, laneCenters);
  const fire = createEnemyFire(bus, rng);
  const heroesState = createHeroes(bus, army);
  const gates = createGates(bus, rng, laneCenters);
  const chests = createChests(bus, rng, laneCenters);
  const combat = createCombat(bus);
  const mission = createMission(bus);
  const enemyFx = createEnemyFx(bus);
  const armyFx = createArmyFx(bus);
  const chestFx = createChestFx(bus);
  ARMY.startSize = 1;
  LEVEL.startWave = 1;
  LEVEL.startWithBoss = false;
  const targets = { enemies: spawner.enemies, chests: chests.list };
  const log = { t: 0, frames: 0, events: [], born: [], over: null, lost: 0 };
  const note = (name) => (payload) => log.events.push({ name, t: log.t, payload });
  for (const name of ['WAVE_ANNOUNCED', 'WAVE_STARTED', 'WAVE_ENDED', 'BOSS_ANNOUNCED', 'BOSS_STARTED', 'BOSS_SPAWNED', 'BOSS_LAYER_BROKEN', 'BOSS_ENDED', 'BOSS_SMASHED', 'BOSS_ESCORT', 'ENEMY_FIRED', 'HERO_HIT', 'SOLDIER_KILLED', 'LEVEL_COMPLETED', 'MISSION_FAILED', 'MISSION_COMPLETED', 'ENEMY_ESCAPED', 'HERO_DAMAGED']) {
    bus.on(EVENTS[name], note(name));
  }
  bus.on(EVENTS.MISSION_FAILED, () => { log.over ??= 'fallita'; });
  bus.on(EVENTS.MISSION_COMPLETED, () => { log.over ??= 'completata'; });
  bus.on(EVENTS.SOLDIER_KILLED, () => { log.lost += 1; });
  const step = (bot) => {
    log.t += dt;
    log.frames += 1;
    if (bot && log.frames % 30 === 0) bot(bus, army, spawner);
    updateWaves(waves, dt, spawner.enemies.length + gates.list.length + chests.list.length);
    updateEnemyFx(enemyFx, dt, scroll.speed);
    updateArmyFx(armyFx, dt);
    updateChestFx(chestFx, dt, scroll.speed);
    updateScroll(scroll, dt);
    updateArmy(army, dt);
    const fresh = new Set(spawner.enemies);
    updateSpawner(spawner, dt, scroll.speed);
    updateBoss(boss, dt, army);
    updateEnemyFire(fire, spawner.enemies, army, dt, scroll.speed);
    updateHeroes(heroesState, army, spawner.enemies, fire.shots, dt);
    const born = spawner.enemies.filter((e) => !fresh.has(e));
    if (born.length) {
      log.born.push({ t: log.t, phase: waves.phase, boss: spawner.boss && { x: spawner.boss.x, z: spawner.boss.z, size: spawner.boss.size, lane: boss.lane, phase: boss.phase }, enemies: born.map((e) => ({ type: e.type, x: e.x, z: e.z, hp: e.hp, swarm: e.swarm })) });
    }
    updateGates(gates, dt, scroll.speed);
    updateChests(chests, dt, scroll.speed);
    if (HERO.fireRate === 0) for (const h of army.heroes) if (h.weapon.fireRate !== 0) h.weapon = { ...h.weapon, fireRate: 0 };
    updateCombat(combat, army, targets, dt, scroll.speed);
    clashEnemies(spawner, army);
    if (!log.over) reachGates(gates, army);
    reachChests(chests, army);
  };
  return { bus, scroll, waves, army, spawner, boss, fire, heroesState, gates, chests, mission, combat, enemyFx, armyFx, chestFx, log, step };
}
const run = (b, seconds, until = () => false) => {
  for (let i = 0; i < seconds * 60 && !b.log.over && !until(); i++) b.step();
};
const firstEvent = (b, name) => b.log.events.find((e) => e.name === name);
const events = (b, name) => b.log.events.filter((e) => e.name === name);

// Battaglia senza nemici né cancelli che arrivano da soli
function weaponArena({ size = 1, x = laneCenters[1], seed = 3 } = {}) {
  const headStartZ = LEVEL.headStartZ;
  LEVEL.headStartZ = Infinity;
  const b = battle({ size, x, startWave: 2, seed });
  LEVEL.headStartZ = headStartZ;
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  run(b, 1, () => b.waves.phase === WAVE_PHASES.wave);
  b.spawner.wave = null;
  b.spawner.enemies.length = 0;
  b.gates.wave = null;
  b.gates.list.length = 0;
  b.chests.wave = null;
  b.chests.list.length = 0;
  return b;
}
function placeChest(b, name, lane, z, hits) {
  const chest = b.chests.pool.acquire();
  Object.assign(chest, { kind: CHEST_KINDS[name], x: laneCenters[lane], z, hits });
  b.chests.list.push(chest);
  return chest;
}
function placeGate(b, name, lane, z, value) {
  const gate = b.gates.pool.acquire();
  Object.assign(gate, { kind: GATE_KINDS[name], x: laneCenters[lane], z, value, partner: null });
  b.gates.list.push(gate);
  return gate;
}
function placeEnemy(b, x, z, hp = 1e9, type = ENEMY_TYPES.grunt) {
  const e = b.spawner.pool.acquire();
  Object.assign(e, { type, x, z, size: type.size, hp, maxHp: hp, extraSpeed: 0, swarm: null });
  b.spawner.enemies.push(e);
  return e;
}
const count = (list, f) => list.filter(f).length;
const weaponsOf = (army) => Object.fromEntries(Object.keys(WEAPONS).map((w) => [w, count(army.soldiers, (s) => s.weapon === w)]));

const heroById = (b, id) => b.army.heroes.find((h) => h.id === id);
const heroNames = (b) => b.army.heroes.map((h) => h.id).join(' ');




















// Momenti (s dall'inizio dell'ondata) in cui compaiono scrigni e cancelli nella prima ondata, e scrigni fuori ondata
function arrivals() {
  HERO.fireRate = 0;
  const b = battle({ size: 1 });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  let waveStart = null;
  let waveOn = false;
  b.bus.on(EVENTS.WAVE_STARTED, () => { waveStart ??= b.log.t; waveOn = true; });
  b.bus.on(EVENTS.WAVE_ENDED, () => { waveOn = false; });
  // Un oggetto nuovo in strada, anche riusato dalla pool, è uno che nel frame prima non c'era
  let prevChests = new Set();
  let prevGates = new Set(b.gates.list);
  const chestTimes = [];
  const gateTimes = [];
  let outside = 0;
  for (let i = 0; i < 60 * 60; i++) {
    b.step();
    for (const c of b.chests.list) if (!prevChests.has(c)) {
      if (b.waves.index === 0 && waveOn) chestTimes.push((b.log.t - waveStart) / 1000);
      if (!waveOn) outside += 1;
    }
    for (const g of b.gates.list) if (!prevGates.has(g) && b.waves.index === 0) gateTimes.push((b.log.t - waveStart) / 1000);
    prevChests = new Set(b.chests.list);
    prevGates = new Set(b.gates.list);
    if (b.waves.index > 0) break;
  }
  HERO.fireRate = undefined;
  MISSION.maxEscaped = 3;
  return { chestTimes, gateTimes, outside };
}










// Colpi che una folla centrata sullo scrigno gli dà prima che arrivi, alla velocità vera dell'ondata, senza nemici
function landable(waveIndex, size, prepare = () => {}) {
  const b = battle({ size, startWave: waveIndex + 1, length: 'long' });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  run(b, 1, () => b.waves.phase === WAVE_PHASES.wave);
  for (const list of [b.spawner.enemies, b.gates.list, b.chests.list]) list.length = 0;
  b.spawner.wave = null;
  b.gates.wave = null;
  b.chests.wave = null;
  prepare(b);
  const chest = placeChest(b, 'damage', 1, CHESTS.spawnDistance, 1e6);
  chest.x = b.army.x;
  let hits = 0;
  b.bus.on(EVENTS.CHEST_HIT, (p) => { if (p.chest === chest) hits += 1; });
  run(b, 30, () => !b.chests.list.includes(chest));
  return hits;
}




// Battaglia che parte dal boss, con l'esercito al centro e il capo immortale
function bossBattle({ size = 40, seed = 5 } = {}) {
  const b = battle({ size, seed, startWithBoss: true });
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  return b;
}













































const { FORMATION, LANES } = await import(root + 'config/balance.js');



// Stato della folla: ogni soldato in un posto aperto e dentro la strada, i posti occupati sono i primi aperti
// (tanti quanti i soldati), quanti soldati in campo dovrebbero esserci
function crowdState(army) {
  const half = PLATOONS.soldierSize / 2;
  const n = army.soldiers.length;
  let open = 0;
  let firstOk = true;
  for (const slot of army.slots) {
    if (!slot.open) {
      if (slot.soldier !== null) firstOk = false;
      continue;
    }
    if ((open < n) !== (slot.soldier !== null)) firstOk = false;
    open += 1;
  }
  return {
    firstOk,
    inRoad: army.soldiers.every((s) => s.x >= half - 1e-9 && s.x <= LANES.fieldWidth - half + 1e-9),
    count: n === Math.min(army.size, army.maxSize) - 1,
    paired: army.soldiers.every((s) => s.slot.soldier === s),
  };
}










// ---- Fase 4 · step 4.1: salvataggio versionato ----
// Uno storage finto al posto di quello del browser: getItem/setItem come localStorage, e un interruttore per farlo
// rifiutare come in navigazione privata
const storage = { items: new Map(), broken: false };
globalThis.localStorage = {
  getItem(key) {
    if (storage.broken) throw new Error('storage negato');
    return storage.items.has(key) ? storage.items.get(key) : null;
  },
  setItem(key, value) {
    if (storage.broken) throw new Error('storage negato');
    storage.items.set(key, String(value));
  },
};
const { SAVE } = await import(root + 'config/balance.js');
const { loadSave, writeSave, clearSave } = await import(root + 'core/save.js');
const { createProfile, recordBattle } = await import(root + 'meta/profile.js');
const { battleResult } = await import(root + 'systems/battle.js');
const stored = () => storage.items.get(SAVE.storageKey);
const put = (value) => storage.items.set(SAVE.storageKey, typeof value === 'string' ? value : JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);








// ---- Fase 4 · step 4.2: premi dei nemici, stelle, riepilogo di fine battaglia ----
const { LOOT } = await import(root + 'config/balance.js');
const { DROPS, REWARDS } = await import(root + 'data/rewards.js');
const { grantRewards } = await import(root + 'meta/rewards.js');
const { profileFrom } = await import(root + 'meta/profile.js');
const { createBattle: newBattle, updateBattle: stepBattle } = await import(root + 'systems/battle.js');

// Battaglia vera senza arrivi: solo quello che ci si mette a mano
function quietBattle(seed = 5) {
  const battle = newBattle(seed);
  for (const h of battle.army.heroes) h.hp = h.maxHp = 1e9;
  for (let i = 0; i < 90; i++) stepBattle(battle, dt);
  for (const list of [battle.spawner.enemies, battle.gates.list, battle.chests.list, battle.loot.list]) list.length = 0;
  battle.spawner.wave = null;
  battle.gates.wave = null;
  battle.chests.wave = null;
  return battle;
}
function killAt(battle, type, x, z) {
  const enemy = battle.spawner.pool.acquire();
  Object.assign(enemy, { type, x, z, size: type.size, hp: 10, maxHp: 10, extraSpeed: 0, brake: 0, knock: 0, swarm: null });
  battle.spawner.enemies.push(enemy);
  battle.bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: 1e9, hero: null });
}
const withAllDrops = (fn) => {
  const saved = Object.values(DROPS).flat().map((drop) => drop.chance);
  for (const drop of Object.values(DROPS).flat()) drop.chance = 1;
  try { return fn(); } finally { Object.values(DROPS).flat().forEach((drop, i) => { drop.chance = saved[i]; }); }
};






// ---- Fase 4 · step 4.3: eroi con livelli, stelle e reclutamento; schieramento scelto ----
const { GROWTH, RECRUIT } = await import(root + 'data/growth.js');
const { RARITIES } = await import(root + 'data/heroes.js');
const { STARTING_LOADOUT } = await import(root + 'data/loadout.js');
const heroesMeta = await import(root + 'meta/heroes.js');
const { levelOf, heroData, placeHero, starUp, recruit, starCost, pullsToRare } = heroesMeta;
const { loadoutFrom } = await import(root + 'meta/loadout.js');
const { armyPower } = await import(root + 'systems/power.js');










// ---- Fase 4 · step 4.4: villaggio con risorse, edifici, cantieri, sfida e acceleratori ----
const { VILLAGE } = await import(root + 'data/village.js');
const villageModule = await import(root + 'meta/village.js');
const villageMeta = {
  ...villageModule,
  startUpgrade: (p, id, now) => (p.village.positions[id] === null
    ? villageModule.placeBuilding(p, id, villageModule.freeSpot(p.village.positions, id, 0), now)
    : villageModule.startUpgrade(p, id, now)),
};
const { loadoutFrom: villageLoadout } = await import(root + 'meta/loadout.js');
const { levelPower: levelPowerOf, armyPower: armyPowerOf } = await import(root + 'systems/power.js');
const { durationText } = await import(root + 'view/words.js');
const MINUTE = 60000;
const HOUR = 60 * MINUTE;











// ---- Fase 4 · step 4.7: mondo isometrico con il villaggio, la porta e gli edifici da mettere ----
const { WORLD } = await import(root + 'data/world.js');
const worldMeta = await import(root + 'meta/world.js');
const { WORLD_CELLS, areaRect, villageRect, inTerritory, gateCells, overlaps } = worldMeta;
const lockedAreas = () => worldMeta.conquestAreas();
const hasCell = (rect, cell) => overlaps(rect, { col: cell.col, row: cell.row, cols: 1, rows: 1 });
const iso = await import(root + 'view/iso.js');
const { WORLD_VIEW } = await import(root + 'config/balance.js');
const placing = {
  ...villageModule,
  canPlace: (positions, id, cell) => villageModule.canPlace(positions, id, cell, 0),
  freeSpot: (positions, id, near = null) => villageModule.freeSpot(positions, id, 0, near),
};






// ---- Fase 4 · step 4.8: strada unica dalla porta, caselle, aree da conquistare ----
const { ROAD } = await import(root + 'data/road.js');
const roadMeta = await import(root + 'meta/road.js');
const { ROAD_TILES, roadTileAt, conqueredAreas, step: roadStep, winRoadTile, canStep, conquestReward, areaProgress, kindKnown } = roadMeta;
const { conquestAreas } = worldMeta;
const { loadoutFrom: roadLoadout } = await import(root + 'meta/loadout.js');
const villageTools = villageMeta;
// Un profilo sulla casella at della strada, fatta o no
const onRoad = (at, done = true) => {
  const p = createProfile();
  p.road = { at, done };
  return p;
};
const lastOf = (area) => ROAD_TILES.filter((tile) => tile.area === area).at(-1);










// ---- Fase 4 · step 4.9: velocità quasi costante, più nemici, materiali dai nemici normali ----



// ---- Fase 4 · step 4.10: battaglie corte, medie e lunghe sulla strada, difficoltà di prova ----
const { LENGTHS } = await import(root + 'data/waves.js');
const { TEST_BATTLE } = await import(root + 'config/balance.js');
const powerModule = await import(root + 'systems/power.js');

export {
  ARMY,
  BOSS,
  BOSS0,
  BOSS_PHASES,
  CHESTS,
  CHEST_KINDS,
  DROPS,
  ENEMIES,
  ENEMY_SHOT,
  ENEMY_TYPES,
  EVENTS,
  FORMATION,
  FX,
  GATES,
  GATE_KINDS,
  GROWTH,
  HERO,
  HEROES,
  HOUR,
  HUD,
  LANES,
  LENGTHS,
  LEVEL,
  LEVEL_LIMITS,
  LIMITS,
  LINEUP,
  LOOT,
  MINUTE,
  MISSION,
  PLATOONS,
  RARITIES,
  RECRUIT,
  REWARDS,
  ROAD,
  ROAD_TILES,
  SAVE,
  STARTING_LOADOUT,
  SWARM,
  TEST_BATTLE,
  VILLAGE,
  WAVES,
  WAVE_PHASES,
  WEAPON,
  WEAPONS,
  WORLD,
  WORLD_CELLS,
  WORLD_VIEW,
  areaProgress,
  areaRect,
  armyPower,
  armyPowerOf,
  arrivals,
  battle,
  battlePlan,
  battleResult,
  bossBattle,
  bumpScale,
  canStep,
  clashEnemies,
  clearSave,
  conqueredAreas,
  conquestAreas,
  conquestReward,
  cooldownShare,
  count,
  createArmy,
  createArmyFx,
  createBoss,
  createChestFx,
  createChests,
  createCombat,
  createEnemyFire,
  createEnemyFx,
  createEventBus,
  createGates,
  createHeroFx,
  createHeroes,
  createLanes,
  createMission,
  createProfile,
  createRng,
  createScroll,
  createSpawner,
  createWaves,
  crowdState,
  dt,
  durationText,
  events,
  firstEvent,
  gateCells,
  grantRewards,
  grenadeHeight,
  hasCell,
  heroById,
  heroData,
  heroNames,
  heroesMeta,
  inTerritory,
  isMalus,
  iso,
  killAt,
  kindKnown,
  landable,
  laneCenters,
  laneOf,
  lastOf,
  layerFill,
  layerPulseScale,
  layersLeft,
  levelOf,
  levelPowerOf,
  loadSave,
  loadoutFrom,
  lockedAreas,
  newBattle,
  onRoad,
  overlaps,
  placeChest,
  placeEnemy,
  placeGate,
  placeHero,
  placing,
  powerModule,
  profileFrom,
  pullsToRare,
  put,
  quietBattle,
  reachChests,
  reachGates,
  recordBattle,
  recruit,
  resetBoss,
  roadLoadout,
  roadMeta,
  roadStep,
  roadTileAt,
  root,
  run,
  same,
  starCost,
  starUp,
  stepBattle,
  storage,
  stored,
  updateArmy,
  updateArmyFx,
  updateBoss,
  updateChestFx,
  updateChests,
  updateCombat,
  updateEnemyFire,
  updateEnemyFx,
  updateGates,
  updateHeroFx,
  updateHeroes,
  updateScroll,
  updateSpawner,
  updateWaves,
  villageLoadout,
  villageMeta,
  villageModule,
  villageRect,
  villageTools,
  warnProgress,
  weaponArena,
  weaponsOf,
  winRoadTile,
  withAllDrops,
  worldMeta,
  writeSave,
};
