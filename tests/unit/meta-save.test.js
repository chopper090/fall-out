import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  ROAD_TILES,
  SAVE,
  VILLAGE,
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
import { storedProfile } from '../../src/meta/profile.js';

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
// posto; riscritto, sul telefono il cammino è l'area, il posto nell'area e il tipo della casella, e si rilegge di nuovo
// uguale
test('Migrazione 1 → 2: un salvataggio con la strada si porta alla 2 e si rilegge uguale', (t) => {
  const check = checker(t);
  const east = areaRect(conquestAreas()[0]);
  const farm = { col: east.col + 3, row: east.row + 1 };
  const battle = ROAD_TILES.find((tile) => tile.area === 2 && tile.kind === 'battle');
  const roads = [
    { at: 0, done: true, lost: false },
    { at: battle.index, done: false, lost: false },
    { at: lastOf(4).index, done: true, lost: false },
    { at: ROAD_TILES.length - 1, done: true, lost: false },
  ];
  const placeOf = ({ at, done, lost }) => {
    const { area, kind } = ROAD_TILES[at];
    return { area, offset: at - ROAD_TILES.find((tile) => tile.area === area).index, done, lost, kind };
  };
  const rows = roads.map((road) => {
    const p = createProfile();
    recordBattle(p, { completed: true, distance: 900, wave: 2, boss: false });
    p.resources.dogTags = 77;
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

// Migrazione 2 → 3 (A1): il cantiere aperto di un salvataggio 2 (construction) diventa la lista dei cantieri con lui
// solo, nessun cantiere una lista vuota; un cantiere che non va (edificio al massimo, fine non valida) resta fuori come
// prima. Riscritto, sul telefono c'è la lista e non più construction, e si rilegge uguale. Anche un salvataggio 1 ci
// arriva, passando dalle due migrazioni
test('A1. Migrazione 2 → 3: il cantiere aperto diventa la lista dei cantieri', (t) => {
  const check = checker(t);
  const village = (construction, levels = { farm: 1, barracks: 0, forge: 0 }) => ({
    levels,
    positions: { farm: { col: 16, row: 16 }, barracks: null, forge: null },
    construction,
    farm: { stored: 2, since: 50 },
  });
  const open = { building: 'farm', endsAt: 1234, challenged: true };
  const cases = [
    ['aperto', 2, village(open)],
    ['nessuno', 2, village(null)],
    ['al massimo', 2, village(open, { farm: VILLAGE.buildings.farm.maxLevel, barracks: 0, forge: 0 })],
    ['fine non valida', 2, village({ building: 'farm', endsAt: 'domani' })],
    ['dalla versione 1', 1, village(open)],
  ];
  const rows = cases.map(([label, version, saved]) => {
    put({ version, profile: { ...storedProfile(createProfile()), village: saved } });
    const migrated = loadSave();
    writeSave(migrated);
    const raw = JSON.parse(stored());
    const again = loadSave();
    const read = migrated.profile.village;
    return {
      label,
      status: `${migrated.status} → ${again.status}`,
      sites: JSON.stringify(read.sites),
      kept: read.farm.stored === 2 && same(read.positions.farm, saved.positions.farm),
      written: raw.version === SAVE.version && !('construction' in raw.profile.village) && same(raw.profile.village.sites, read.sites),
      same: same(again.profile, migrated.profile),
    };
  });
  const expected = [JSON.stringify([open]), '[]', '[]', '[]', JSON.stringify([open])];
  check(
    `migrazione 2 → 3: ${rows.map((r) => `${r.label} ${r.sites} (${r.status})`).join('; ')}; fattoria e posti tenuti ${rows.every((r) => r.kept)}, scritto alla ${SAVE.version} con la lista ${rows.every((r) => r.written)}, riletto uguale ${rows.every((r) => r.same)}`,
    rows.every((r, index) => r.sites === expected[index] && r.status === 'migrated → ok' && r.kept && r.written && r.same),
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
// oggetto) riparte dalla porta, anche letto dal telefono, in un salvataggio di oggi o in uno 1 portato a oggi
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
  const gate = { at: 0, done: true, lost: false };
  put({ version: SAVE.version, profile: { road: { area: 'x', offset: 2, done: true } } });
  const fromTwo = loadSave();
  put({ version: 1, profile: { road: { at: 9999, done: true } } });
  const fromOne = loadSave();
  const wrong = read.filter((road) => !same(road, gate)).length;
  check(
    `strade rotte: fuori dalla porta ${wrong}/${bad.length}; dal telefono, versione ${SAVE.version} ${JSON.stringify(fromTwo.profile.road)} (${fromTwo.status}), versione 1 ${JSON.stringify(fromOne.profile.road)} (${fromOne.status})`,
    wrong === 0 &&
      same(fromTwo.profile.road, gate) &&
      fromTwo.status === 'ok' &&
      same(fromOne.profile.road, gate) &&
      fromOne.status === 'migrated',
  );
  check.done();
});

// Il testo di un salvataggio della versione version: un profilo da zero con tags piastrine
async function savedText(tags, version = SAVE.version) {
  const { storedProfile } = await import(root + 'meta/profile.js');
  const profile = createProfile();
  profile.resources.dogTags = tags;
  return JSON.stringify({ version, profile: storedProfile(profile) });
}
const backup = () => storage.items.get(SAVE.backupKey);
const broken = () => storage.items.get(SAVE.brokenKey);

// Copia di riserva a un passo: prima di ogni scrittura il salvataggio che c'era, se si legge, passa nella copia; una
// scrittura uguale non la tocca, un salvataggio rotto non ci entra; cancellando ci va quello di prima, anche di una
// versione più nuova; uno di una versione vecchia, letto, non cambia niente sul telefono, e alla prima scrittura ci va
// lui, com'era
test('Copia di riserva: prima di ogni scrittura ci va il salvataggio di prima, se si legge', async (t) => {
  const check = checker(t);
  storage.items.clear();
  const save = loadSave();
  writeSave(save);
  const first = stored();
  const empty = backup() === undefined;
  recordBattle(save.profile, { completed: true, distance: 500, wave: 2, boss: false });
  writeSave(save);
  const second = stored();
  const rolled = backup() === first;
  writeSave(save);
  const unchanged = backup() === first && stored() === second;
  recordBattle(save.profile, { completed: false, distance: 200, wave: 1, boss: false });
  writeSave(save);
  const third = stored();
  const rolledAgain = backup() === second;
  put('{rotto');
  writeSave(save);
  const skipped = backup() === second && stored() === third;
  clearSave(save);
  const cleared = backup() === third && JSON.parse(stored()).profile.stats.played === 0;
  const newer = await savedText(9, SAVE.version + 1);
  put(newer);
  const readOnly = loadSave();
  clearSave(readOnly);
  const newerKept = backup() === newer;
  const old = JSON.stringify({ version: 1, profile: { resources: { dogTags: 33 }, road: { at: 5, done: true } } });
  put(old);
  const migrated = loadSave();
  const quiet = backup() === newer && stored() === old;
  writeSave(migrated);
  const oldKept = backup() === old && JSON.parse(stored()).version === SAVE.version;
  check(
    `copia di riserva: vuota alla prima scrittura ${empty}; dopo la seconda è la prima ${rolled}; una scrittura uguale la lascia ${unchanged}; dopo la terza è la seconda ${rolledAgain}; sopra un salvataggio rotto resta la seconda ${skipped}; cancellando ci va la terza ${cleared}; ci va anche uno più nuovo ${newerKept}; letto uno della versione 1 (${migrated.status}) il telefono resta com'era ${quiet}, e alla prima scrittura ci va lui com'era ${oldKept}`,
    empty && rolled && unchanged && rolledAgain && skipped && cleared && newerKept && quiet && oldKept &&
      migrated.status === 'migrated',
  );
  check.done();
});

// Salvataggio rovinato (non si legge, senza versione, senza un profilo, una migrazione che si rompe) con la copia di
// riserva buona: si riprende la copia (status restored), anche di una versione vecchia; leggendo il telefono non
// cambia; la prima scrittura tiene da parte il rovinato com'era (brokenKey) e lo sostituisce, e la copia resta quella
// buona (un rovinato che ha una versione non ci entra: non la si potrebbe riprendere)
test('Salvataggio rovinato con la copia buona: si riprende la copia, il rovinato resta da parte', async (t) => {
  const check = checker(t);
  const { MIGRATIONS } = await import(root + 'core/save.js');
  const original = [...MIGRATIONS];
  storage.items.clear();
  const good = await savedText(321);
  const cases = [
    '{rotto',
    'null',
    JSON.stringify({ profile: {} }),
    JSON.stringify({ version: SAVE.version, profile: 5 }),
    JSON.stringify({ version: 1, profile: {} }),
  ];
  const failing = () => {
    throw new Error('migrazione rotta');
  };
  const rows = [];
  try {
    for (const [i, text] of cases.entries()) {
      storage.items.set(SAVE.backupKey, good);
      // L'ultimo è della versione 1, con la migrazione che si rompe
      if (i === cases.length - 1) MIGRATIONS.splice(0, MIGRATIONS.length, failing);
      put(text);
      storage.items.delete(SAVE.brokenKey);
      const save = loadSave();
      const untouched = stored() === text && broken() === undefined && backup() === good;
      const wrote = writeSave(save);
      rows.push({
        status: save.status,
        dogTags: save.profile.resources.dogTags,
        untouched,
        written: wrote && broken() === text && backup() === good,
        readOnly: save.readOnly,
      });
    }
  } finally {
    MIGRATIONS.splice(0, MIGRATIONS.length, ...original);
  }
  const old = await savedText(45, 1);
  storage.items.set(SAVE.backupKey, old);
  put('{rotto');
  const fromOld = loadSave();
  storage.items.set(SAVE.backupKey, good);
  const save = loadSave();
  const wrote = writeSave(save);
  const again = loadSave();
  check(
    `rovinato con la copia buona: ${rows.map((r) => `${r.status}, piastrine ${r.dogTags}, sul telefono com'era ${r.untouched}, scritto con il rovinato da parte e la copia buona ${r.written}`).join('; ')}; copia della versione 1: ${fromOld.status}, piastrine ${fromOld.profile.resources.dogTags}; scritto ${wrote}, riletto ${again.status} con piastrine ${again.profile.resources.dogTags}, copia ancora quella buona ${backup() === good}`,
    rows.length === cases.length &&
      rows.every((r) => r.status === 'restored' && r.dogTags === 321 && r.written && r.untouched && !r.readOnly) &&
      fromOld.status === 'restored' &&
      fromOld.profile.resources.dogTags === 45 &&
      wrote &&
      again.status === 'ok' &&
      again.profile.resources.dogTags === 321 &&
      backup() === good,
  );
  check.done();
});

// Salvataggio rovinato e copia di riserva rovinata o che manca: si riparte da zero (status corrupt) e leggendo il
// telefono non cambia; la prima scrittura tiene da parte il rovinato com'era e mette il profilo nuovo, e la copia
// resta com'era
test('Salvataggio e copia rovinati: si riparte da zero, il rovinato resta da parte', (t) => {
  const check = checker(t);
  const rows = [undefined, '{rotta', '[]', JSON.stringify({ version: -3 })].map((copy) => {
    storage.items.clear();
    if (copy !== undefined) storage.items.set(SAVE.backupKey, copy);
    put('{rotto');
    const save = loadSave();
    const quiet = stored() === '{rotto' && broken() === undefined && backup() === copy;
    const wrote = writeSave(save);
    return {
      status: save.status,
      fresh: same(save.profile, createProfile()) && !save.readOnly,
      quiet,
      after: wrote && loadSave().status === 'ok' && broken() === '{rotto' && backup() === copy,
    };
  });
  check(
    `rovinati tutti e due: ${rows.map((r) => `${r.status}, da zero ${r.fresh}, sul telefono com'era ${r.quiet}, poi scritto con il rovinato da parte e riletto ${r.after}`).join('; ')}`,
    rows.every((r) => r.status === 'corrupt' && r.fresh && r.quiet && r.after),
  );
  check.done();
});

// Ogni stato del salvataggio letto, con gli avvisi per il giocatore (saveWarnings, ognuno con il suo testo in
// HUD.world.saveNotices) e se la rilettura (refreshSave) prende il salvataggio al posto del profilo in memoria: solo se
// il salvataggio stesso si legge ed è della versione di oggi o di una più nuova (ok, newer); non se è di una versione
// vecchia (lo ha scritto un gioco più vecchio, il profilo in memoria è più nuovo), se si riprende la copia, si riparte
// da zero o il browser non lascia leggere
test('Stati del salvataggio: avvisi per il giocatore e rilettura', async (t) => {
  const check = checker(t);
  const { refreshSave, saveWarnings } = await import(root + 'core/save.js');
  const { HUD } = await import(root + 'config/balance.js');
  const good = await savedText(77);
  const setups = {
    new: () => {},
    ok: () => put(good),
    migrated: async () => put(await savedText(77, 1)),
    newer: async () => put(await savedText(77, SAVE.version + 1)),
    restored: () => {
      storage.items.set(SAVE.backupKey, good);
      put('{rotto');
    },
    corrupt: () => put('{rotto'),
    unavailable: () => {
      storage.broken = true;
    },
  };
  const rows = [];
  try {
    for (const [expected, setup] of Object.entries(setups)) {
      storage.items.clear();
      await setup();
      const save = loadSave();
      const memory = { ...save, profile: createProfile() };
      memory.profile.stats.played = 1;
      refreshSave(memory);
      storage.broken = false;
      rows.push({
        expected,
        status: save.status,
        readOnly: save.readOnly,
        warnings: saveWarnings(save),
        kept: memory.profile.stats.played === 1,
      });
    }
  } finally {
    storage.broken = false;
  }
  const want = {
    new: [[], true],
    ok: [[], false],
    migrated: [[], true],
    newer: [['newer'], false],
    restored: [['restored'], true],
    corrupt: [['corrupt'], true],
    unavailable: [['writeFailed'], true],
  };
  const texts = rows.flatMap((r) => r.warnings).map((id) => HUD.world.saveNotices[id]);
  check(
    `stati: ${rows.map((r) => `${r.expected} → ${r.status}${r.readOnly ? ' (sola lettura)' : ''}, avvisi [${r.warnings.join(', ')}], rileggendo resta la memoria ${r.kept}`).join('; ')}; testi degli avvisi ${texts.filter((text) => typeof text === 'string' && text.length > 0).length}/${texts.length}`,
    rows.every(
      (r) =>
        r.status === r.expected &&
        r.readOnly === (r.expected === 'newer') &&
        same(r.warnings, want[r.expected][0]) &&
        r.kept === want[r.expected][1],
    ) && texts.every((text) => typeof text === 'string' && text.length > 0),
  );
  check.done();
});

// Revisione. Un gioco più vecchio (versione 1, che non rilegge prima di scrivere) aperto in un'altra finestra scrive il
// suo profilo vecchio sopra quello di oggi. La rilettura di questa finestra non lo prende e non scrive niente (né il
// salvataggio né la copia di riserva cambiano, come a ogni secondo del mondo); la prossima scrittura mette il profilo
// in memoria e quello vecchio nella copia di riserva, da dove si può ancora riprendere
test('Salvataggio vecchio scritto da un\'altra finestra: la rilettura tiene il profilo in memoria', async (t) => {
  const check = checker(t);
  const { refreshSave } = await import(root + 'core/save.js');
  storage.items.clear();
  const save = loadSave();
  save.profile.resources.dogTags = 510;
  writeSave(save);
  save.profile.resources.dogTags = 1010;
  writeSave(save);
  const before = backup();
  const old = JSON.stringify({ version: 1, profile: { resources: { dogTags: 11 } } });
  put(old);
  refreshSave(save);
  const kept = save.profile.resources.dogTags === 1010;
  const quiet = backup() === before && stored() === old && broken() === undefined;
  const wrote = writeSave(save);
  const main = JSON.parse(stored());
  const fromBackup = JSON.parse(backup()).profile.resources.dogTags;
  check(
    `salvataggio della versione 1 da un'altra finestra: in memoria piastrine ${save.profile.resources.dogTags} (tenuti ${kept}), rileggendo il telefono resta com'era ${quiet}; scritto ${wrote}: salvataggio alla versione ${main.version} con piastrine ${main.profile.resources.dogTags}, copia di riserva con quello vecchio ${backup() === old} (piastrine ${fromBackup})`,
    kept && quiet && wrote && main.version === SAVE.version && main.profile.resources.dogTags === 1010 &&
      backup() === old,
  );
  check.done();
});

// writeSave dice se ha scritto e lo segna (writeFailed): sì di solito; no quando il browser rifiuta, con l'avviso; di
// nuovo sì quando torna a scrivere; in sola lettura no, ma non è un errore
test('Scrittura che non riesce: writeSave dice di no e lo segna, con il suo avviso', async (t) => {
  const check = checker(t);
  const { saveWarnings } = await import(root + 'core/save.js');
  storage.items.clear();
  const save = loadSave();
  const first = { wrote: writeSave(save), failed: save.writeFailed };
  storage.broken = true;
  let refused;
  try {
    refused = { wrote: writeSave(save), failed: save.writeFailed, warnings: saveWarnings(save) };
  } finally {
    storage.broken = false;
  }
  const back = { wrote: writeSave(save), failed: save.writeFailed };
  put(await savedText(5, SAVE.version + 1));
  const readOnly = loadSave();
  const wrote = writeSave(readOnly);
  const locked = { wrote, failed: readOnly.writeFailed === true, warnings: saveWarnings(readOnly) };
  const describe = (r) => `scritto ${r.wrote}, segnato ${r.failed}`;
  check(
    `scritture: di solito ${describe(first)}; rifiutata ${describe(refused)}, avvisi [${refused.warnings.join(', ')}]; di nuovo ${describe(back)}; in sola lettura ${describe(locked)}, avvisi [${locked.warnings.join(', ')}]`,
    first.wrote &&
      !first.failed &&
      !refused.wrote &&
      refused.failed &&
      same(refused.warnings, ['writeFailed']) &&
      back.wrote &&
      !back.failed &&
      !locked.wrote &&
      !locked.failed &&
      same(locked.warnings, ['newer']),
  );
  check.done();
});

// Il salvataggio copiato (exportSave) e incollato (importSave) su un telefono da zero torna uguale, in memoria e sul
// telefono, e si rilegge uguale; uno della versione 1 incollato passa dalla sua migrazione
test('Salvataggio copiato e incollato: torna uguale, anche su un telefono da zero', async (t) => {
  const check = checker(t);
  const { exportSave, importSave } = await import(root + 'core/save.js');
  const { storedProfile } = await import(root + 'meta/profile.js');
  storage.items.clear();
  const save = loadSave();
  recordBattle(save.profile, { completed: true, distance: 900, wave: 3, boss: false });
  save.profile.resources.dogTags = 321;
  save.profile.road = { at: ROAD_TILES.find((tile) => tile.area === 1).index, done: true, lost: false };
  writeSave(save);
  const text = exportSave(save);
  const copied = JSON.parse(text);
  const exact = copied.version === SAVE.version && same(copied.profile, storedProfile(save.profile));
  storage.items.clear();
  const other = loadSave();
  const result = importSave(other, text);
  const onPhone = stored() === text;
  const reread = loadSave();
  const old = JSON.stringify({ version: 1, profile: { resources: { dogTags: 44 }, road: { at: 5, done: true } } });
  const fromOld = loadSave();
  const oldResult = importSave(fromOld, old);
  check(
    `copiato: versione ${copied.version}, profilo com'è in memoria ${exact}; incollato su un telefono da zero ${result}, uguale in memoria ${same(other.profile, save.profile)} (stato ${other.status}, sola lettura ${other.readOnly}), sul telefono ${onPhone}, riletto uguale ${same(reread.profile, save.profile)}; uno della versione 1 ${oldResult}, piastrine ${fromOld.profile.resources.dogTags}, casella ${fromOld.profile.road.at}, scritto alla ${JSON.parse(stored()).version}`,
    exact &&
      result === 'imported' &&
      same(other.profile, save.profile) &&
      other.status === 'ok' &&
      !other.readOnly &&
      onPhone &&
      same(reread.profile, save.profile) &&
      oldResult === 'imported' &&
      fromOld.profile.resources.dogTags === 44 &&
      fromOld.profile.road.at === 5 &&
      JSON.parse(stored()).version === SAVE.version,
  );
  check.done();
});

// Un testo incollato che non è un salvataggio (non si legge, senza versione o con una versione non valida, senza
// profilo, con una migrazione che si rompe) o è di una versione più nuova si rifiuta: niente cambia, né in memoria né
// sul telefono (né il salvataggio né la sua copia di riserva)
test('Salvataggio incollato che non va: si rifiuta e non cambia niente', async (t) => {
  const check = checker(t);
  const { MIGRATIONS, importSave } = await import(root + 'core/save.js');
  const original = [...MIGRATIONS];
  storage.items.clear();
  const save = loadSave();
  save.profile.resources.gears = 17;
  writeSave(save);
  writeSave({ ...save, profile: { ...save.profile, resources: { ...save.profile.resources, gears: 18 } } });
  const before = { main: stored(), backup: storage.items.get(SAVE.backupKey), memory: JSON.stringify(save) };
  const profile = (version, data = {}) => JSON.stringify({ version, profile: data });
  const invalid = [
    '',
    'ciao',
    '{rotto',
    'null',
    '42',
    '[]',
    JSON.stringify({ profile: {} }),
    profile(0),
    profile('2'),
    profile(1.5),
    JSON.stringify({ version: SAVE.version }),
    profile(SAVE.version, null),
    profile(SAVE.version, 'profilo'),
  ];
  const results = invalid.map((text) => importSave(save, text));
  const newer = importSave(save, await savedText(9, SAVE.version + 1));
  let broken;
  try {
    MIGRATIONS.splice(0, MIGRATIONS.length, () => {
      throw new Error('migrazione rotta');
    });
    broken = importSave(save, profile(1, { resources: { gears: 3 } }));
  } finally {
    MIGRATIONS.splice(0, MIGRATIONS.length, ...original);
  }
  const untouched =
    stored() === before.main &&
    storage.items.get(SAVE.backupKey) === before.backup &&
    JSON.stringify(save) === before.memory;
  check(
    `incollati: ${results.filter((result) => result === 'invalid').length}/${invalid.length} non validi, uno più nuovo ${newer}, con la migrazione rotta ${broken}; salvataggio, copia di riserva e memoria come prima ${untouched}`,
    results.every((result) => result === 'invalid') && newer === 'newer' && broken === 'invalid' && untouched,
  );
  check.done();
});

// Prima di incollare, il salvataggio di adesso passa nella copia di riserva, anche uno di una versione più nuova (che
// si copia com'è sul telefono, non come lo conosce questa versione); se il telefono non lascia scrivere niente cambia
test('Salvataggio incollato: quello di prima va nella copia di riserva', async (t) => {
  const check = checker(t);
  const { exportSave, importSave } = await import(root + 'core/save.js');
  storage.items.clear();
  const save = loadSave();
  save.profile.resources.dogTags = 11;
  writeSave(save);
  const first = stored();
  const second = await savedText(22);
  const result = importSave(save, second);
  const rolled = storage.items.get(SAVE.backupKey) === first && stored() === second;
  const memory = save.profile.resources.dogTags;
  storage.broken = true;
  let refused;
  try {
    refused = importSave(save, await savedText(33));
  } finally {
    storage.broken = false;
  }
  const kept = save.profile.resources.dogTags === 22 && stored() === second && !save.writeFailed;
  const newerText = JSON.stringify({ version: SAVE.version + 1, profile: { resources: { dogTags: 55 }, future: 1 } });
  put(newerText);
  const readOnly = loadSave();
  const exported = exportSave(readOnly) === newerText;
  const over = importSave(readOnly, await savedText(66));
  const tags = JSON.parse(stored()).profile.resources.dogTags;
  const newerKept = storage.items.get(SAVE.backupKey) === newerText && tags === 66;
  check(
    `incollato ${result}: la copia di riserva è il salvataggio di prima e il telefono ha quello incollato ${rolled}, in memoria piastrine ${memory}; con il telefono che rifiuta ${refused}, resta tutto com'era ${kept}; uno più nuovo si copia com'è ${exported}, incollandoci sopra ${over} (sola lettura ${readOnly.readOnly}) va nella copia di riserva ${newerKept}`,
    result === 'imported' &&
      rolled &&
      memory === 22 &&
      refused === 'failed' &&
      kept &&
      exported &&
      over === 'imported' &&
      !readOnly.readOnly &&
      newerKept,
  );
  check.done();
});

// Migrazione 3 → 4 (le scorte divise, data/village.js): i materiali diventano legno (SAVE.woodShare, per difetto) e
// pietra, i rottami ingranaggi, e arriva un circuito per ogni area già conquistata; le altre risorse restano. Senza
// risorse si riparte da quelle di partenza, con un cammino che non torna nessun circuito; senza rottami (i
// salvataggi del 4.2) gli ingranaggi sono quelli di partenza
test('Migrazione 3 → 4: materiali in legno e pietra, rottami in ingranaggi, un circuito per area', (t) => {
  const check = checker(t);
  const boss = lastOf(2);
  const road = { area: 2, offset: boss.index - ROAD_TILES.find((tile) => tile.area === 2).index, done: true, kind: 'boss' };
  const resources = { rations: 5, materials: 101, scrap: 7, accelerators: 2, dogTags: 4 };
  storage.items.clear();
  put({ version: 3, profile: { resources, road } });
  const save = loadSave();
  const got = save.profile.resources;
  const wood = Math.floor(101 * SAVE.woodShare);
  put({ version: 3, profile: { road: { area: 'x' } } });
  const bare = loadSave().profile.resources;
  put({ version: 3, profile: { resources: { materials: 10 }, road: { area: 'x' } } });
  const lost = loadSave().profile.resources;
  check(
    `migrazione 3 → 4: ${JSON.stringify(resources)} con 3 aree conquistate → ${JSON.stringify(got)} (${save.status}); senza risorse ${JSON.stringify(bare)}; con il cammino rotto e senza rottami circuiti ${lost.circuits}, ingranaggi ${lost.gears}`,
    save.status === 'migrated' &&
      got.wood === wood &&
      got.stone === 101 - wood &&
      got.gears === 7 &&
      got.circuits === 3 &&
      got.rations === 5 &&
      got.accelerators === 2 &&
      got.dogTags === 4 &&
      !('materials' in got) &&
      !('scrap' in got) &&
      same(bare, createProfile().resources) &&
      lost.circuits === 0 &&
      lost.gears === VILLAGE.start.gears &&
      lost.wood + lost.stone === 10,
  );
  check.done();
});
