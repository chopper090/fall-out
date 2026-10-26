import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  SAVE, clearSave, createProfile, loadSave, put, recordBattle, root, same, storage, stored, writeSave,
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
  check(`salvataggio: da zero ${zero}; dopo due battaglie riletto uguale ${same(again.profile, fresh.profile)} (${JSON.stringify(again.profile.stats)}), versione scritta ${raw.version}`,
    zero && same(again.profile, fresh.profile) && again.profile.stats.played === 2 && again.profile.stats.won === 1 &&
    again.profile.stats.bestDistance === 40000 && raw.version === SAVE.version && !again.readOnly);
  check.done();
});

// 101. Salvataggio rotto (non si legge, senza versione, versione non valida): si parte da zero e la prossima scrittura
// lo sostituisce
test('101. Salvataggio rotto (non si legge, senza versione, versione non valida): si parte da...', async (t) => {
  const check = checker(t);
  const cases = ['{rotto', 'null', '42', JSON.stringify({ profile: {} }), JSON.stringify({ version: 0, profile: {} }),
    JSON.stringify({ version: '1', profile: {} }), JSON.stringify({ version: 1.5, profile: {} })];
  const results = cases.map((value) => {
    put(value);
    const save = loadSave();
    const ok = same(save.profile, createProfile()) && !save.readOnly;
    writeSave(save);
    return ok && JSON.parse(stored()).version === SAVE.version;
  });
  check(`salvataggi rotti: da zero e poi sostituiti ${results.filter(Boolean).length}/${cases.length}`, results.every(Boolean));
  check.done();
});

// 102. Campi che mancano o non vanno bene prendono il valore di partenza, quelli sconosciuti restano fuori
test('102. Campi che mancano o non vanno bene prendono il valore di partenza, quelli sconosci...', async (t) => {
  const check = checker(t);
  put({ version: SAVE.version, profile: { stats: { played: 5, won: 9, bestDistance: -3, last: { completed: 'sì' }, extra: 1 }, other: true } });
  const a = loadSave().profile;
  put({ version: SAVE.version, profile: { stats: { played: 'tre', last: { completed: false, distance: 800, wave: 2, boss: false } } } });
  const b = loadSave().profile;
  put({ version: SAVE.version });
  const c = loadSave().profile;
  check(`campi sistemati: ${JSON.stringify(a)}; ${JSON.stringify(b)}; senza profilo ${JSON.stringify(c)}`,
    same(a.stats, { played: 5, won: 5, bestDistance: 0, last: null }) &&
    same(b.stats, { played: 0, won: 0, bestDistance: 0, last: { completed: false, distance: 800, wave: 2, boss: false } }) &&
    same(c, createProfile()));
  check.done();
});

// 103. Salvataggio di una versione più nuova: si legge ma non si sovrascrive; cancellandolo si riparte da zero e si
// torna a scrivere
test('103. Salvataggio di una versione più nuova: si legge ma non si sovrascrive; cancellando...', async (t) => {
  const check = checker(t);
  const newer = JSON.stringify({ version: SAVE.version + 1, profile: { stats: { played: 7, won: 3, bestDistance: 900, last: null } } });
  put(newer);
  const save = loadSave();
  const atLoad = { readOnly: save.readOnly, played: save.profile.stats.played };
  recordBattle(save.profile, { completed: true, distance: 1000, wave: 4, boss: true });
  writeSave(save);
  const untouched = stored() === newer;
  clearSave(save);
  const after = JSON.parse(stored());
  check(`versione più nuova: sola lettura ${atLoad.readOnly}, giocate lette ${atLoad.played}, non sovrascritta ${untouched}; cancellata: versione ${after.version}, profilo da zero ${same(after.profile, createProfile())}, scrivibile ${!save.readOnly}`,
    atLoad.readOnly && atLoad.played === 7 && untouched && after.version === SAVE.version &&
    same(after.profile, createProfile()) && !save.readOnly);
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
  check(`storage che rifiuta: errore ${error ?? 'nessuno'}, profilo da zero ${save !== null && same(save.profile, createProfile())}`,
    error === null && same(save.profile, createProfile()));
  check.done();
});

// 106. Due finestre del gioco aperte insieme: chi registra una battaglia rilegge prima il salvataggio, così non cancella
// le battaglie dell'altra; e non scrive sopra un salvataggio più nuovo scritto nel frattempo
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
  const newer = JSON.stringify({ version: SAVE.version + 1, profile: { stats: { played: 50, won: 20, bestDistance: 9, last: null } } });
  put(newer);
  play(a, true);
  const kept = stored() === newer;
  storage.items.clear();
  const c = loadSave();
  recordBattle(c.profile, { completed: false, distance: 5, wave: 1, boss: false });
  refreshSave(c);
  check(`due finestre: giocate ${both.played} (attese 4), vinte ${both.won}; salvataggio più nuovo tenuto ${kept}; senza niente di salvato resta il profilo in memoria (${c.profile.stats.played})`,
    both.played === 4 && both.won === 2 && kept && c.profile.stats.played === 1);
  check.done();
});
