import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  CHESTS,
  CHEST_KINDS,
  EVENTS,
  GATE_KINDS,
  LEVEL_LIMITS,
  clashEnemies,
  placeEnemy,
  root,
  weaponArena,
} from '../support/suite.js';

// 64. Scrigno d'élite: tre élite in più, nei primi posti della folla, con la loro arma e le loro vite
test("64. Scrigno d'élite: tre élite in più, nei primi posti della folla, con la loro arma e...", async (t) => {
  const check = checker(t);
  const { ELITE } = await import(root + 'data/units.js');
  const b = weaponArena({ size: 30 });
  const before = b.army.size;
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  const elites = b.army.soldiers.filter((s) => s.elite);
  const firstSlots = elites.every((s) => b.army.soldiers.every((o) => o.elite || o.slot.platoon >= s.slot.platoon));
  check(
    `scrigno d'élite: esercito ${before} -> ${b.army.size}, élite ${b.army.elites} (${elites.length} in campo), arma ${[...new Set(elites.map((s) => s.weapon))].join()}, vite ${elites.map((s) => s.lives).join(' ')}, nei primi plotoni ${firstSlots}`,
    b.army.size === before + CHEST_KINDS.elite.count &&
      b.army.elites === CHEST_KINDS.elite.count &&
      elites.length === CHEST_KINDS.elite.count &&
      elites.every((s) => s.weapon === ELITE.weapon && s.lives === ELITE.lives) &&
      firstSlots,
  );
  check.done();
});

// 65. Un'élite regge ELITE.lives colpi e muore all'ultimo, una volta sola; un soldato normale muore al primo
test("65. Un'élite regge ELITE.lives colpi e muore all'ultimo, una volta sola; un soldato n...", async (t) => {
  const check = checker(t);
  const { ELITE } = await import(root + 'data/units.js');
  const b = weaponArena({ size: 10 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  const elite = b.army.soldiers.find((s) => s.elite);
  const normal = b.army.soldiers.find((s) => !s.elite);
  let deaths = 0;
  b.bus.on(EVENTS.SOLDIER_KILLED, () => {
    deaths += 1;
  });
  const sizes = [];
  for (let n = 0; n < ELITE.lives; n++) {
    b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: elite });
    sizes.push(b.army.size);
  }
  const eliteGone = !b.army.soldiers.includes(elite) && elite.slot === null;
  b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: elite });
  const afterExtra = deaths;
  b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: normal });
  check(
    `élite colpita ${ELITE.lives} volte: esercito ${sizes.join(' -> ')}, morta ${eliteGone}, morti contati ${afterExtra} (un colpo in più non conta); normale al primo colpo: morti ${deaths}`,
    eliteGone &&
      afterExtra === 1 &&
      deaths === 2 &&
      sizes[ELITE.lives - 2] === 10 + CHEST_KINDS.elite.count &&
      sizes[ELITE.lives - 1] === 9 + CHEST_KINDS.elite.count,
  );
  check.done();
});

// 66. Scontro: un nemico con 2 di vita che tocca solo un'élite le toglie due vite e non uccide nessuno
test("66. Scontro: un nemico con 2 di vita che tocca solo un'élite le toglie due vite e non...", async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  const target = b.army.soldiers[0];
  const lives = target.lives;
  const size = b.army.size;
  for (const s of b.army.soldiers) if (s !== target) s.x += 1000;
  const enemy = placeEnemy(b, target.x, target.z, 2);
  for (const h of b.army.heroes) h.x += 1000;
  clashEnemies(b.spawner, b.army);
  check(
    `scontro con un'élite: vite ${lives} -> ${target.lives}, esercito ${size} -> ${b.army.size}, nemico sparito ${!b.spawner.enemies.includes(enemy)}`,
    target.lives === lives - 2 && b.army.size === size && !b.spawner.enemies.includes(enemy),
  );
  check.done();
});

// 67. Lo scrigno d'arma dà l'arma solo ai soldati normali davanti a lui: le élite tengono la loro
test("67. Lo scrigno d'arma dà l'arma solo ai soldati normali davanti a lui: le élite tengo...", async (t) => {
  const check = checker(t);
  const { ELITE } = await import(root + 'data/units.js');
  const b = weaponArena({ size: 30 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.burst, x: b.army.x, z: 600 });
  const elites = b.army.soldiers.filter((s) => s.elite).map((s) => s.weapon);
  const normals = b.army.soldiers
    .filter((s) => !s.elite && Math.abs(s.slot.dx) < CHESTS.armWidth / 2)
    .map((s) => s.weapon);
  check(
    `scrigno d'arma con élite davanti: élite ${[...new Set(elites)].join()}, normali davanti ${[...new Set(normals)].join()}`,
    elites.length > 0 &&
      elites.every((w) => w === ELITE.weapon) &&
      normals.length > 0 &&
      normals.every((w) => w === 'burst'),
  );
  check.done();
});

// 68. Folla piena: l'élite prende il posto di un soldato normale, che torna tra le riserve
test("68. Folla piena: l'élite prende il posto di un soldato normale, che torna tra le riserve", async (t) => {
  const check = checker(t);
  const cap = LEVEL_LIMITS.maxArmy;
  const b = weaponArena({ size: cap });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  check(
    `folla piena e élite: esercito ${b.army.size}, in campo ${b.army.soldiers.length + 1}/${cap}, élite ${b.army.elites}, riserve ${b.army.reserves}`,
    b.army.size === cap + CHEST_KINDS.elite.count &&
      b.army.soldiers.length === cap - 1 &&
      b.army.elites === CHEST_KINDS.elite.count &&
      b.army.reserves === CHEST_KINDS.elite.count,
  );
  check.done();
});

// 69. Un −N toglie prima le riserve, poi i soldati normali, le élite per ultime
test('69. Un −N toglie prima le riserve, poi i soldati normali, le élite per ultime', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 8 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.minus, value: -8, x: b.army.x });
  const k = CHEST_KINDS.elite.count;
  check(
    `−8 su 7 normali e ${k} élite: esercito ${b.army.size}, élite ${b.army.elites}, normali ${b.army.soldiers.filter((s) => !s.elite).length}`,
    b.army.size === k && b.army.elites === k - 1 && b.army.soldiers.every((s) => s.elite),
  );
  check.done();
});

// 70. Morta un'élite, una riserva prende il suo posto
test("70. Morta un'élite, una riserva prende il suo posto", async (t) => {
  const check = checker(t);
  const cap = LEVEL_LIMITS.maxArmy;
  const b = weaponArena({ size: cap + 5 });
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  const elite = b.army.soldiers.find((s) => s.elite);
  const slot = elite.slot;
  const lives = elite.lives;
  for (let n = 0; n < lives; n++) b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: elite });
  check(
    `élite morta con riserve: posto ripreso ${slot.soldier !== null && !slot.soldier.elite}, in campo ${b.army.soldiers.length + 1}/${cap}, riserve ${b.army.reserves}, élite ${b.army.elites}`,
    slot.soldier !== null &&
      !slot.soldier.elite &&
      b.army.soldiers.length === cap - 1 &&
      b.army.reserves === 4 + CHEST_KINDS.elite.count &&
      b.army.elites === CHEST_KINDS.elite.count - 1,
  );
  check.done();
});

// 73. Lampo dell'élite: solo su un'élite che resta in piedi, mai sulla riserva che prende il posto di un caduto
test("73. Lampo dell'élite: solo su un'élite che resta in piedi, mai sulla riserva che pren...", async (t) => {
  const check = checker(t);
  const cap = LEVEL_LIMITS.maxArmy;
  const b = weaponArena({ size: cap + 5 });
  const normal = b.army.soldiers[0];
  b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: normal });
  const afterNormal = b.armyFx.hits.size;
  b.bus.emit(EVENTS.CHEST_OPENED, { kind: CHEST_KINDS.elite, x: b.army.x, z: 600 });
  const elite = b.army.soldiers.find((s) => s.elite);
  b.bus.emit(EVENTS.SOLDIER_HIT, { soldier: elite });
  check(
    `lampo dell'élite: dopo un soldato normale caduto con riserve ${afterNormal} lampi, dopo un'élite colpita ${b.armyFx.hits.size} (lei ${b.armyFx.hits.has(elite)})`,
    afterNormal === 0 && b.armyFx.hits.size === 1 && b.armyFx.hits.has(elite),
  );
  check.done();
});
