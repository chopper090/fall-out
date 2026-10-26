import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  EVENTS,
  FX,
  GATE_KINDS,
  HERO,
  MISSION,
  WAVES,
  battle,
  dt,
  isMalus,
  laneCenters,
  laneOf,
  placeEnemy,
  placeGate,
  root,
  run,
  weaponArena,
} from '../support/suite.js';

// 58. Porte fisse: i colpi attraversano il cancello e arrivano al nemico dietro; il numero non cambia mai
test('58. Porte fisse: i colpi attraversano il cancello e arrivano al nemico dietro; il numer...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  const b = weaponArena({ size: 2 });
  const soldier = b.army.soldiers[0];
  soldier.weapon = 'rifle';
  const gate = placeGate(b, 'plus', 1, 500, 8);
  gate.x = soldier.x;
  const enemy = placeEnemy(b, soldier.x, 800, 1e9);
  let enemyHits = 0;
  let changed = 0;
  b.bus.on(EVENTS.ENEMY_HIT, (p) => {
    if (p.enemy === enemy) enemyHits += 1;
  });
  for (let i = 0; i < 180; i++) {
    b.step();
    gate.z = 500;
    enemy.z = 800;
    if (gate.value !== 8) changed += 1;
  }
  HERO.fireRate = undefined;
  check(
    `porta fissa: colpi arrivati al nemico dietro ${enemyHits}, frame con il numero cambiato ${changed}`,
    enemyHits > 0 && changed === 0,
  );
  check.done();
});

// 59. Solo +N e −N: i tipi esistono, i +N danno, i −N tolgono; niente più eventi dei cancelli che si caricano
test('59. Solo +N e −N: i tipi esistono, i +N danno, i −N tolgono; niente più eventi dei canc...', async (t) => {
  const check = checker(t);
  const kinds = Object.keys(GATE_KINDS).sort().join(' ');
  const names = WAVES.flatMap((w) => [...Object.keys(w.gates.singles), ...w.gates.pairs.flatMap((p) => p.kinds)]);
  const signs = WAVES.every((w) => w.gates.plus.every((v) => v > 0) && w.gates.minus.every((v) => v < 0));
  const gone = ['GATE_HIT', 'GATE_VALUE_CHANGED', 'GATE_REMOVED'].filter((name) => EVENTS[name] !== undefined);
  const malus = Object.entries(GATE_KINDS)
    .map(([name, kind]) => `${name} ${kind.malus}`)
    .join(', ');
  check(
    `tipi di porta: ${kinds} (rossa: ${malus}); tipi delle ondate esistenti ${names.every((n) => GATE_KINDS[n])}, segni giusti ${signs}, eventi rimasti ${gone.join(' ') || 'nessuno'}`,
    kinds === 'minus plus' &&
      names.every((n) => GATE_KINDS[n]) &&
      signs &&
      gone.length === 0 &&
      GATE_KINDS.minus.malus &&
      !GATE_KINDS.plus.malus,
  );
  check.done();
});

// 60. Livello intero: ogni porta che compare ha un numero tra quelli della sua ondata per il suo tipo, ed è rossa solo
// se toglie
test('60. Livello intero: ogni porta che compare ha un numero tra quelli della sua ondata per...', async (t) => {
  const check = checker(t);
  HERO.fireRate = 0;
  MISSION.maxEscaped = 1e9;
  const seen = [];
  for (const seed of [3, 4, 5, 6]) {
    const b = battle({ size: 1, seed });
    b.army.leader.hp = b.army.leader.maxHp = 1e9;
    let previous = new Set(b.gates.list);
    for (let i = 0; i < 60 * 130 && !b.log.over && !b.waves.bossNext; i++) {
      b.step();
      for (const gate of b.gates.list)
        if (!previous.has(gate))
          seen.push({
            wave: b.waves.index,
            name: gate.kind === GATE_KINDS.plus ? 'plus' : 'minus',
            value: gate.value,
            malus: isMalus(gate),
            lane: laneOf(gate.x),
            single: gate.partner === null,
          });
      previous = new Set(b.gates.list);
    }
  }
  HERO.fireRate = undefined;
  MISSION.maxEscaped = 3;
  const wrong = seen.filter((g) => !WAVES[g.wave].gates[g.name].includes(g.value) || g.malus !== g.value < 0);
  const perWave = WAVES.map((_, i) => seen.filter((g) => g.wave === i).length);
  const lonelyMalus = seen.filter((g) => g.single && g.malus);
  const inMiddle = lonelyMalus.filter((g) => g.lane === 1).length;
  check(
    `porte nel livello: ${seen.length} (per ondata ${perWave.join(' ')}), con numero o colore sbagliato ${wrong.length}; −N da soli ${lonelyMalus.length}, nella corsia di mezzo ${inMiddle}`,
    seen.length > 20 && wrong.length === 0 && lonelyMalus.length > 0 && inMiddle === 0,
  );
  check.done();
});

// 61. Il +N aggiunge esattamente N soldati; il −N li toglie, ma mai il capo
test('61. Il +N aggiunge esattamente N soldati; il −N li toglie, ma mai il capo', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 20 });
  b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.plus, value: 12, x: b.army.x });
  const afterPlus = b.army.size;
  b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.minus, value: -10, x: b.army.x });
  const afterMinus = b.army.size;
  b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.minus, value: -50, x: b.army.x });
  check(
    `+12 e −10 su 20 soldati: ${afterPlus}, ${afterMinus}; −50: ${b.army.size} (resta il capo)`,
    afterPlus === 32 && afterMinus === 22 && b.army.size === 1,
  );
  check.done();
});

// 62. Di una coppia vale quella più vicina al centro degli eroi; esattamente in mezzo vale la peggiore
test('62. Di una coppia vale quella più vicina al centro degli eroi; esattamente in mezzo val...', async (t) => {
  const check = checker(t);
  const passed = (x) => {
    const b = weaponArena({ size: 1, x });
    b.army.x = x;
    const good = placeGate(b, 'plus', 0, 300, 10);
    const bad = placeGate(b, 'minus', 1, 300, -8);
    good.partner = bad;
    bad.partner = good;
    let value = null;
    b.bus.on(EVENTS.GATE_PASSED, (g) => {
      value = g.value;
    });
    for (let i = 0; i < 120 && value === null && b.gates.list.length > 0; i++) {
      b.step();
      b.army.x = x;
    }
    return value;
  };
  const left = passed(laneCenters[0]);
  const middle = passed((laneCenters[0] + laneCenters[1]) / 2);
  check(`coppia +10 / −8: davanti al +10 vale ${left}, in mezzo ${middle}`, left === 10 && middle === -8);
  check.done();
});

// 90. Scritta del cancello passato: compare con il suo numero e il suo colore; con due cancelli vicini (una coppia)
// solo quello preso; nessuna se il cancello si manca o con gli effetti spenti; finisce dopo durationMs
test('90. Scritta del cancello passato: compare con il suo numero e il suo colore; con due ca...', async (t) => {
  const check = checker(t);
  const { createGateFx, updateGateFx, gatePassProgress } = await import(root + 'fx/gateFx.js');
  const pass = (gates, prepare = () => {}) => {
    const b = weaponArena({ size: 5 });
    const fx = createGateFx(b.bus);
    const lane = laneOf(b.army.x);
    const placed = gates.map(([name, offset, value]) => placeGate(b, name, lane + offset, 300, value));
    if (placed.length === 2) [placed[0].partner, placed[1].partner] = [placed[1], placed[0]];
    prepare();
    run(b, 4, () => b.gates.list.length === 0);
    FX.enabled = true;
    return fx;
  };
  const idle = gatePassProgress(pass([]));
  const plus = pass([['plus', 0, 12]]);
  const plusState = { value: plus.value, malus: plus.malus, progress: gatePassProgress(plus) };
  for (let i = 0; i < Math.ceil(FX.gatePass.durationMs / dt) + 1; i++) updateGateFx(plus, dt);
  const ended = gatePassProgress(plus);
  const pair = pass([
    ['minus', 0, -6],
    ['plus', 1, 10],
  ]);
  const missed = gatePassProgress(pass([['plus', 1, 10]]));
  const off = gatePassProgress(
    pass([['plus', 0, 8]], () => {
      FX.enabled = false;
    }),
  );
  check(
    `scritta del cancello: senza cancelli ${idle}, passando un +12 ${plusState.value} (rossa ${plusState.malus}, a ${plusState.progress}), dopo ${FX.gatePass.durationMs} ms ${ended}; coppia −6 davanti e +10 accanto ${pair.value} (rossa ${pair.malus}); cancello mancato ${missed}; effetti spenti ${off}`,
    idle === 1 &&
      plusState.value === 12 &&
      !plusState.malus &&
      plusState.progress === 0 &&
      ended === 1 &&
      pair.value === -6 &&
      pair.malus &&
      gatePassProgress(pair) === 0 &&
      missed === 1 &&
      off === 1,
  );
  check.done();
});
