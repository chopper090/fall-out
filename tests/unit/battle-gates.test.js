import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  EVENTS,
  FX,
  GATES,
  GATE_KINDS,
  HERO,
  MISSION,
  WAVES,
  battle,
  dt,
  heroById,
  isMalus,
  laneCenters,
  laneOf,
  placeEnemy,
  placeGate,
  quietBattle,
  restore,
  root,
  run,
  stepBattle,
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
  restore(HERO, 'fireRate');
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
  restore(HERO, 'fireRate');
  restore(MISSION, 'maxEscaped');
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

// 62. Di una coppia vale quella più vicina al centro degli eroi (il centro della loro fila, dal bordo del primo a
// quello dell'ultimo, non il punto guidato); con il centro esattamente in mezzo vale la peggiore
test('62. Di una coppia vale quella più vicina al centro degli eroi; esattamente in mezzo val...', async (t) => {
  const check = checker(t);
  const passed = (center) => {
    const b = weaponArena({ size: 1 });
    const x = center - (b.army.heroRight - b.army.heroLeft) / 2;
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
  const middle = (laneCenters[0] + laneCenters[1]) / 2;
  const left = passed(laneCenters[0]);
  const atMiddle = passed(middle);
  const nearGood = passed(middle - 1);
  const nearBad = passed(middle + 1);
  check(
    `coppia +10 / −8: davanti al +10 vale ${left}; centro degli eroi in mezzo ${atMiddle}, un'unità verso il +10 ${nearGood}, verso il −8 ${nearBad}`,
    left === 10 && atMiddle === -8 && nearGood === 10 && nearBad === -8,
  );
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

// 184. Cancelli solo per gli eroi: un cancello sotto cui passano solo i soldati non vale niente, va avanti mancato
// oltre gli eroi e sparisce sotto lo schermo, a GATES.despawnZ
test('184. Cancelli solo per gli eroi: sotto i soldati da soli non vale niente, va avanti e s...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 100 });
  const { army } = b;
  const start = army.size;
  const plus = placeGate(b, 'plus', 0, 300, 10);
  const minus = placeGate(b, 'minus', 2, 450, -8);
  const half = GATES.width / 2;
  const crowdOver = army.x - army.left < plus.x + half && army.x + army.right > minus.x - half;
  const heroesOver = army.x - army.heroLeft < plus.x + half || army.x + army.heroRight > minus.x - half;
  let passed = 0;
  b.bus.on(EVENTS.GATE_PASSED, () => {
    passed += 1;
  });
  const lowest = new Map();
  let frames = 0;
  for (; frames < 600 && b.gates.list.length > 0; frames++) {
    b.step();
    for (const gate of b.gates.list) lowest.set(gate, Math.min(lowest.get(gate) ?? Infinity, gate.z));
  }
  const lows = [plus, minus].map((gate) => lowest.get(gate));
  const down = lows.every((z) => z >= GATES.despawnZ && z < GATES.despawnZ + 10);
  check(
    `folla di ${start} al centro: copre i cancelli ai lati ${crowdOver}, gli eroi ${heroesOver}; presi ${passed}, esercito ${army.size}; scesi fino a ${lows.map((z) => z.toFixed(0)).join(' e ')} (eroi a ${army.heroFront.toFixed(0)}, spariscono a ${GATES.despawnZ}); in strada dopo ${((frames * dt) / 1000).toFixed(1)} s: ${b.gates.list.length}`,
    crowdOver && !heroesOver && passed === 0 && army.size === start && down && b.gates.list.length === 0,
  );
  check.done();
});

// 185. La linea dei cancelli è quella degli eroi, anche dentro una folla grande: un cancello si giudica quando arriva
// al fronte degli eroi, non a quello della folla, e fino ad allora ci si può spostare per prenderlo
test('185. La linea dei cancelli è quella degli eroi, anche dentro una folla grande: ci si pu...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 100 });
  const { army } = b;
  const crowdFront = army.front;
  const line = army.heroFront + GATES.depth / 2;
  const step = (b.scroll.speed * dt) / 1000;
  const gate = placeGate(b, 'plus', 0, 600, 10);
  let taken = null;
  b.bus.on(EVENTS.GATE_PASSED, (g) => {
    taken = { value: g.value, z: g.z };
  });
  let movedAt = null;
  for (let i = 0; i < 300 && taken === null; i++) {
    b.step();
    if (movedAt !== null || gate.z >= crowdFront) continue;
    movedAt = gate.z;
    army.x = laneCenters[0];
  }
  check(
    `folla di 100: fronte della folla ${crowdFront.toFixed(0)}, degli eroi ${army.heroFront.toFixed(0)}; eroi spostati sotto il cancello quando era a ${movedAt?.toFixed(0)}; preso ${taken?.value} a ${taken?.z.toFixed(1)} (linea ${line.toFixed(1)}, un frame ${step.toFixed(1)}), esercito ${army.size}`,
    movedAt !== null &&
      taken?.value === 10 &&
      taken.z <= line &&
      taken.z > line - step - 1e-9 &&
      crowdFront - line > 100 &&
      army.size === 110,
  );
  check.done();
});

// 186. Basta il bordo di un eroe: con la fila degli eroi che entra di un'unità nel cancello lo si prende, fermi a
// un'unità prima no; un eroe caduto non conta più
test("186. Basta il bordo di un eroe: dentro il cancello di un'unità lo si prende, fuori di u...", async (t) => {
  const check = checker(t);
  const take = (overlap, fallen = null) => {
    const b = weaponArena({ size: 1 });
    const gate = placeGate(b, 'plus', 2, 300, 10);
    const x = gate.x - GATES.width / 2 - b.army.heroRight + overlap;
    if (fallen !== null) b.bus.emit(EVENTS.HERO_HIT, { hero: heroById(b, fallen), damage: 1e9 });
    let value = null;
    b.bus.on(EVENTS.GATE_PASSED, (g) => {
      value = g.value;
    });
    for (let i = 0; i < 180 && value === null && !gate.missed; i++) {
      b.army.x = x;
      b.step();
    }
    return { value, missed: gate.missed, reach: b.army.heroRight };
  };
  const inside = take(1);
  const outside = take(-1);
  const fallen = take(1, 'defender');
  check(
    `ultimo eroe a destra dentro il cancello di 1: ${inside.value}; fuori di 1: ${outside.value} (mancato ${outside.missed}); dentro di 1 ma con il difensore caduto (fila fino a ${fallen.reach} invece di ${inside.reach}): ${fallen.value}`,
    inside.value === 10 && outside.value === null && outside.missed && fallen.value === null && fallen.missed,
  );
  check.done();
});

// 187. Il bot del simulatore porta gli eroi sotto il cancello che vuole: un +N in un'altra corsia lo va a prendere,
// di una coppia prende il migliore, da un −N davanti agli eroi si sposta (con dei soldati da perdere: al solo capo un
// −N non toglie niente)
test('187. Il bot porta gli eroi sotto il cancello che vuole: va a prendere un +N, di una cop...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const play = (gates, startLane = 1) => {
    const b = quietBattle();
    b.army.x = laneCenters[startLane];
    b.bus.emit(EVENTS.GATE_PASSED, { kind: GATE_KINDS.plus, value: 20 });
    const placed = gates.map(([name, lane, value]) => placeGate(b, name, lane, 900, value));
    if (placed.length === 2) [placed[0].partner, placed[1].partner] = [placed[1], placed[0]];
    let value = null;
    b.bus.on(EVENTS.GATE_PASSED, (g) => {
      value = g.value;
    });
    const bot = createBot(dt);
    const start = b.army.size;
    for (let i = 0; i < 60 * 6 && value === null && !placed.every((g) => g.missed); i++) {
      updateBot(bot, b);
      stepBattle(b, dt);
    }
    return { value, start, size: b.army.size };
  };
  const far = play([['plus', 0, 12]]);
  const pair = play([
    ['minus', 1, -6],
    ['plus', 2, 10],
  ]);
  const dodged = play([['minus', 0, -8]], 0);
  check(
    `bot con un esercito di ${far.start}: +12 nella corsia accanto ${far.value} (esercito ${far.size}); coppia −6 davanti e +10 accanto ${pair.value} (${pair.size}); −8 davanti agli eroi ${dodged.value ?? 'schivato'} (${dodged.size})`,
    far.value === 12 &&
      far.size === far.start + 12 &&
      pair.value === 10 &&
      pair.size === pair.start + 10 &&
      dodged.value === null &&
      dodged.size === dodged.start,
  );
  check.done();
});

// Revisione. Due cancelli messi a mano uno dopo l'altro nella stessa battaglia, davanti agli eroi: il secondo esce
// dalla pool già usato dal primo (che a passaggio fatto era segnato come mancato), e vale lo stesso
test("Cancelli messi a mano uno dopo l'altro: il secondo, riusato dalla pool, vale anche lui", (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 5 });
  const passed = [];
  b.bus.on(EVENTS.GATE_PASSED, ({ value }) => passed.push(value));
  const lane = laneOf(b.army.x);
  const first = placeGate(b, 'plus', lane, 300, 10);
  run(b, 4, () => passed.length > 0);
  const second = placeGate(b, 'plus', lane, 300, 7);
  run(b, 4, () => passed.length > 1);
  check(
    `due cancelli di fila: passati ${passed.join(', ')}, esercito ${b.army.size}; il secondo è lo stesso oggetto del primo ${second === first}`,
    passed.join() === '10,7' && b.army.size === 22,
  );
  check.done();
});
