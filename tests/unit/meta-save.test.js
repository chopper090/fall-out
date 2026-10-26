import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  ROAD_TILES,
  SAVE,
  areaRect,
  clearSave,
  conqueredAreas,
  conquestAreas,
  createProfile,
  lastOf,
  loadSave,
  profileFrom,
  put,
  recordBattle,
  root,
  same,
  storage,
  stored,
  writeSave,
} from '../support/suite.js';

// 100. Senza salvataggio si parte da zero; una battaglia finita, scritta e riletta, torna uguale
test('100. Senza salvataggio si parte da zero; una battaglia finita, scritta e riletta, torna...', async (t) => {
  const check = checker(t);
  storage.items.clear();
  const fresh = loadSave();
  const zero = same(fresh.profile, createProfile()) && !fresh.readOnly;
  recordBattle(fresh.profile, { completed: false, distance: 12345, wave: 3, boss: false });
  recordBattle(fresh.profile, { completed: true, distance: 40000, wave: 4, boss: true });
  writeSave(fresh);
  const again = loadSave();
  const raw = JSON.parse(stored());
  check(
    `salvataggio: da zero ${zero}; dopo due battaglie riletto uguale ${same(again.profile, fresh.profile)} (${JSON.stringify(again.profile.stats)}), versione scritta ${raw.version}`,
    zero &&
      same(again.profile, fresh.profile) &&
      again.profile.stats.played === 2 &&
      again.profile.stats.won === 1 &&
      again.profile.stats.bestDistance === 40000 &&
      raw.version === SAVE.version &&
      !again.readOnly,
  );
  check.done();
});

// 101. Salvataggio rotto (non si legge, senza versione, versione non valida): si parte da zero e la prossima scrittura
// lo sostituisce
test('101. Salvataggio rotto (non si legge, senza versione, versione non valida): si parte da...', async (t) => {
  const check = checker(t);
  const cases = [
    '{rotto',
    'null',
    '42',
    JSON.stringify({ profile: {} }),
    JSON.stringify({ version: 0, profile: {} }),
    JSON.stringify({ version: '1', profile: {} }),
    JSON.stringify({ version: 1.5, profile: {} }),
  ];
  const results = cases.map((value) => {
    put(value);
    const save = loadSave();
    const ok = same(save.profile, createProfile()) && !save.readOnly;
    writeSave(save);
    return ok && JSON.parse(stored()).version === SAVE.version;
  });
  check(
    `salvataggi rotti: da zero e poi sostituiti ${results.filter(Boolean).length}/${cases.length}`,
    results.every(Boolean),
  );
  check.done();
});

// 102. Campi che mancano o non vanno bene prendono il valore di partenza, quelli sconosciuti restano fuori
test('102. Campi che mancano o non vanno bene prendono il valore di partenza, quelli sconosci...', async (t) => {
  const check = checker(t);
  put({
    version: SAVE.version,
    profile: { stats: { played: 5, won: 9, bestDistance: -3, last: { completed: 'sì' }, extra: 1 }, other: true },
  });
  const a = loadSave().profile;
  put({
    version: SAVE.version,
    profile: { stats: { played: 'tre', last: { completed: false, distance: 800, wave: 2, boss: false } } },
  });
  const b = loadSave().profile;
  put({ version: SAVE.version });
  const c = loadSave().profile;
  check(
    `campi sistemati: ${JSON.stringify(a)}; ${JSON.stringify(b)}; senza profilo ${JSON.stringify(c)}`,
    same(a.stats, { played: 5, won: 5, bestDistance: 0, last: null }) &&
      same(b.stats, {
        played: 0,
        won: 0,
        bestDistance: 0,
        last: { completed: false, distance: 800, wave: 2, boss: false },
      }) &&
      same(c, createProfile()),
  );
  check.done();
});

// 103. Salvataggio di una versione più nuova: si legge ma non si sovrascrive; cancellandolo si riparte da zero e si
// torna a scrivere
test('103. Salvataggio di una versione più nuova: si legge ma non si sovrascrive; cancellando...', async (t) => {
  const check = checker(t);
  const newer = JSON.stringify({
    version: SAVE.version + 1,
    profile: { stats: { played: 7, won: 3, bestDistance: 900, last: null } },
  });
  put(newer);
  const save = loadSave();
  const atLoad = { readOnly: save.readOnly, played: save.profile.stats.played };
  recordBattle(save.profile, { completed: true, distance: 1000, wave: 4, boss: true });
  writeSave(save);
  const untouched = stored() === newer;
  clearSave(save);
  const after = JSON.parse(stored());
  // Sul telefono il profilo da zero è com'è salvato (storedProfile)
  const { storedProfile } = await import(root + 'meta/profile.js');
  const zero = storedProfile(createProfile());
  check(
    `versione più nuova: sola lettura ${atLoad.readOnly}, giocate lette ${atLoad.played}, non sovrascritta ${untouched}; cancellata: versione ${after.version}, profilo da zero ${same(after.profile, zero)}, scrivibile ${!save.readOnly}`,
    atLoad.readOnly &&
      atLoad.played === 7 &&
      untouched &&
      after.version === SAVE.version &&
      same(after.profile, zero) &&
      !save.readOnly,
  );
  check.done();
});

// 104. Storage che rifiuta (navigazione privata): si parte da zero, scrivere e cancellare non danno errore
test('104. Storage che rifiuta (navigazione privata): si parte da zero, scrivere e cancellare...', async (t) => {
  const check = checker(t);
  storage.broken = true;
  let error = null;
  let save = null;
  try {
    save = loadSave();
    recordBattle(save.profile, { completed: false, distance: 10, wave: 1, boss: false });
    writeSave(save);
    clearSave(save);
  } catch (e) {
    error = e.message;
  }
  storage.broken = false;
  check(
    `storage che rifiuta: errore ${error ?? 'nessuno'}, profilo da zero ${save !== null && same(save.profile, createProfile())}`,
    error === null && same(save.profile, createProfile()),
  );
  check.done();
});

// 106. Due finestre del gioco aperte insieme: chi registra una battaglia rilegge prima il salvataggio, così non
// cancella le battaglie dell'altra; e non scrive sopra un salvataggio più nuovo scritto nel frattempo
test('106. Due finestre del gioco aperte insieme: chi registra una battaglia rilegge prima il...', async (t) => {
  const check = checker(t);
  const { refreshSave } = await import(root + 'core/save.js');
  storage.items.clear();
  const a = loadSave();
  const b = loadSave();
  const play = (save, completed) => {
    refreshSave(save);
    recordBattle(save.profile, { completed, distance: 100, wave: 1, boss: false });
    writeSave(save);
  };
  play(b, true);
  play(b, false);
  play(b, false);
  play(a, true);
  const both = JSON.parse(stored()).profile.stats;
  const newer = JSON.stringify({
    version: SAVE.version + 1,
    profile: { stats: { played: 50, won: 20, bestDistance: 9, last: null } },
  });
  put(newer);
  play(a, true);
  const kept = stored() === newer;
  storage.items.clear();
  const c = loadSave();
  recordBattle(c.profile, { completed: false, distance: 5, wave: 1, boss: false });
  refreshSave(c);
  check(
    `due finestre: giocate ${both.played} (attese 4), vinte ${both.won}; salvataggio più nuovo tenuto ${kept}; senza niente di salvato resta il profilo in memoria (${c.profile.stats.played})`,
    both.played === 4 && both.won === 2 && kept && c.profile.stats.played === 1,
  );
  check.done();
});

// Migrazione 1 → 2: un salvataggio 1 scritto dal 4.8 in poi (il cammino con la casella at) si porta alla versione 2 e
// si rilegge come lo leggeva la versione 1, con le stesse aree conquistate e la fattoria fuori dal villaggio al suo
// posto; riscritto, sul telefono il cammino è l'area e il posto nell'area, e si rilegge di nuovo uguale
test('Migrazione 1 → 2: un salvataggio con la strada si porta alla 2 e si rilegge uguale', (t) => {
  const check = checker(t);
  const east = areaRect(conquestAreas()[0]);
  const farm = { col: east.col + 3, row: east.row + 1 };
  const battle = ROAD_TILES.find((tile) => tile.area === 2 && tile.kind === 'battle');
  const roads = [
    { at: 0, done: true },
    { at: battle.index, done: false },
    { at: lastOf(4).index, done: true },
    { at: ROAD_TILES.length - 1, done: true },
  ];
  const placeOf = ({ at, done }) => {
    const { area } = ROAD_TILES[at];
    return { area, offset: at - ROAD_TILES.find((tile) => tile.area === area).index, done };
  };
  const rows = roads.map((road) => {
    const p = createProfile();
    recordBattle(p, { completed: true, distance: 900, wave: 2, boss: false });
    p.resources.materials = 77;
    p.village.levels.farm = 1;
    p.village.positions.farm = farm;
    p.road = road;
    const v1 = JSON.parse(JSON.stringify(p));
    put({ version: 1, profile: v1 });
    const migrated = loadSave();
    writeSave(migrated);
    const raw = JSON.parse(stored());
    const again = loadSave();
    return {
      at: road.at,
      status: `${migrated.status} → ${again.status}`,
      same:
        same(migrated.profile, profileFrom(v1)) &&
        same(migrated.profile.road, road) &&
        same(again.profile, migrated.profile),
      conquered: conqueredAreas(migrated.profile.road),
      expected: conqueredAreas(road),
      farm: same(migrated.profile.village.positions.farm, farm),
      version: raw.version,
      stored: raw.profile.road,
      place: same(raw.profile.road, placeOf(road)),
    };
  });
  check(
    `migrazione 1 → 2: ${rows.map((r) => `casella ${r.at} → ${JSON.stringify(r.stored)} (${r.status}, aree ${r.conquered}, fattoria al suo posto ${r.farm})`).join('; ')}; come nella versione 1 e riletto uguale ${rows.every((r) => r.same)}, versione scritta ${rows[0].version}`,
    rows.every(
      (r) =>
        r.status === 'migrated → ok' &&
        r.same &&
        r.place &&
        r.conquered === r.expected &&
        r.version === SAVE.version &&
        !('at' in r.stored),
    ) &&
      rows.map((r) => r.conquered).join(' ') === '0 2 5 24' &&
      rows.slice(1).every((r) => r.farm),
  );
  check.done();
});

// Una migrazione che si rompe o che manca (SAVE.version salito senza la sua): il gioco parte lo stesso, da zero, e lo
// dice (status corrupt); il salvataggio sul telefono resta com'è finché non si scrive, rileggerlo non cancella il
// profilo in memoria, e con la migrazione al suo posto si legge di nuovo
test('Migrazione che si rompe o manca: si parte da zero senza errori, rileggendo resta il profilo in memoria', async (t) => {
  const check = checker(t);
  const { MIGRATIONS, refreshSave } = await import(root + 'core/save.js');
  const original = [...MIGRATIONS];
  const text = JSON.stringify({
    version: 1,
    profile: { stats: { played: 4, won: 1, bestDistance: 50, last: null }, road: { at: 5, done: true } },
  });
  const broken = () => {
    throw new Error('migrazione rotta');
  };
  const results = [];
  let error = null;
  try {
    for (const migrations of [[broken], []]) {
      MIGRATIONS.splice(0, MIGRATIONS.length, ...migrations);
      put(text);
      const save = loadSave();
      const fresh = same(save.profile, createProfile()) && !save.readOnly;
      recordBattle(save.profile, { completed: true, distance: 10, wave: 1, boss: false });
      refreshSave(save);
      results.push({ status: save.status, fresh, kept: save.profile.stats.played === 1, untouched: stored() === text });
    }
  } catch (e) {
    error = e.message;
  } finally {
    MIGRATIONS.splice(0, MIGRATIONS.length, ...original);
  }
  const healed = loadSave();
  const describe = (r) =>
    r ? `stato ${r.status}, da zero ${r.fresh}, in memoria dopo la rilettura ${r.kept}, sul telefono com'era ${r.untouched}` : '-';
  check(
    `migrazione che si rompe: ${describe(results[0])}; che manca: ${describe(results[1])}; errore ${error ?? 'nessuno'}; con la migrazione: stato ${healed.status}, giocate ${healed.profile.stats.played}, casella ${healed.profile.road.at}`,
    error === null &&
      results.length === 2 &&
      results.every((r) => r.status === 'corrupt' && r.fresh && r.kept && r.untouched) &&
      healed.status === 'migrated' &&
      healed.profile.stats.played === 4 &&
      healed.profile.road.at === 5,
  );
  check.done();
});

// Un cammino salvato rotto (area o posto che non sono numeri interi, un'area prima della porta, un cammino che non è un
// oggetto) riparte dalla porta, anche letto dal telefono, in un salvataggio 2 o in uno 1 portato alla 2
test('Strada salvata rotta: si riparte dalla porta', (t) => {
  const check = checker(t);
  const bad = [
    { area: 'due', offset: 1, done: true },
    { area: 2, offset: 1.5, done: true },
    { area: 2, done: true },
    { area: -2, offset: 0, done: true },
    { area: 2.5, offset: 0, done: true },
    { area: 3, offset: '4', done: true },
    { area: null, offset: 3, done: true },
    [],
    'strada',
    7,
  ];
  const read = bad.map((road) => profileFrom({ road }).road);
  const gate = { at: 0, done: true };
  put({ version: SAVE.version, profile: { road: { area: 'x', offset: 2, done: true } } });
  const fromTwo = loadSave();
  put({ version: 1, profile: { road: { at: 9999, done: true } } });
  const fromOne = loadSave();
  const wrong = read.filter((road) => !same(road, gate)).length;
  check(
    `strade rotte: fuori dalla porta ${wrong}/${bad.length}; dal telefono, versione 2 ${JSON.stringify(fromTwo.profile.road)} (${fromTwo.status}), versione 1 ${JSON.stringify(fromOne.profile.road)} (${fromOne.status})`,
    wrong === 0 &&
      same(fromTwo.profile.road, gate) &&
      fromTwo.status === 'ok' &&
      same(fromOne.profile.road, gate) &&
      fromOne.status === 'migrated',
  );
  check.done();
});
