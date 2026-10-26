import { test } from 'node:test';
import { checker } from '../support/check.js';
import { SAVE, loadSave, put, same, storage, stored } from '../support/suite.js';
import { META_EVENTS } from '../../src/core/events.js';
import { VILLAGE } from '../../src/data/village.js';
import { createMetaActions } from '../../src/meta/actions.js';
import { placeHero, recruit, starUp } from '../../src/meta/heroes.js';
import { loadoutFrom } from '../../src/meta/loadout.js';
import { createProfile, profileFrom, recordBattle, storedProfile } from '../../src/meta/profile.js';
import { grantRewards } from '../../src/meta/rewards.js';
import { ROAD_TILES, step, winRoadTile } from '../../src/meta/road.js';
import * as village from '../../src/meta/village.js';

// Le azioni del meta-gioco (meta/actions.js) su un salvataggio nel telefono finto, con l'ora ferma: ognuna cambia il
// profilo come faceva prima il codice delle scene, salva e dice cosa è successo; quelle che non cambiano niente non
// salvano e non dicono niente
const T0 = 1_800_000_000_000;
const MINUTE = 60000;
const HOUR = 60 * MINUTE;

// Un salvataggio con il profilo profile sul telefono finto (come lo scrive il gioco), letto come all'avvio, con le sue
// azioni all'ora clock.time (di partenza T0); events raccoglie quello che dicono
function setup(profile, { version = SAVE.version } = {}) {
  storage.items.clear();
  put({ version, profile: storedProfile(profile) });
  const save = loadSave();
  const events = [];
  const clock = { time: T0 };
  const emit = (name, payload) => events.push([name, payload]);
  const actions = createMetaActions({ save, emit, now: () => clock.time });
  return { save, actions, events, clock };
}

// I nomi degli eventi detti, e per PROFILE_CHANGED l'azione
function said(events) {
  return events.map(([name, data]) => (name === META_EVENTS.PROFILE_CHANGED ? `${name}:${data.action}` : name)).join();
}

// Il profilo come tornerebbe dal telefono: una copia riletta
function reread(profile) {
  return profileFrom(JSON.parse(JSON.stringify(storedProfile(profile))));
}

// Un edificio id al livello level, messo nel primo posto libero vicino al centro del villaggio
function withBuilding(profile, id, level) {
  profile.village.levels[id] = level;
  profile.village.positions[id] = village.freeSpot(profile.village.positions, id, 0);
  return profile;
}

// Risorse in più per costruire
function rich(profile) {
  Object.assign(profile.resources, { materials: 100, scrap: 20 });
  return profile;
}

// La fattoria al livello 1 con stored razioni pronte, prodotte fino a T0
function withFarm(stored) {
  const profile = withBuilding(createProfile(), 'farm', 1);
  profile.village.farm = { stored, since: T0 };
  return profile;
}

// La caserma al livello 3, con il cantiere per il 4 (90 minuti) che finisce tra left millisecondi
function building(left, challenged = false) {
  const profile = withBuilding(createProfile(), 'barracks', 3);
  profile.village.construction = { building: 'barracks', endsAt: T0 + left, challenged };
  profile.resources.accelerators = 2;
  return profile;
}

// Sulla casella index della strada, ancora da vincere
function onTile(index) {
  const profile = createProfile();
  profile.road = { at: index, done: false };
  return profile;
}

// Il risultato di una battaglia finita, vinta o persa, con i quattro eroi dello schieramento di partenza
function battle(completed) {
  const heroes = ['leader', 'rifleman', 'sniper', 'defender'].map((id, index) => ({
    id,
    damageDealt: 400 - index * 90,
    damageTaken: 20,
    kills: 9 - index,
  }));
  const loot = { materials: 9, xp: 70, scrap: 3, accelerators: 1, fragments: { sniper: 2 } };
  return { completed, distance: 41000, wave: 4, boss: completed, loot, heroes };
}

// La battaglia finita come la chiudeva main.js: statistiche, premi (niente premio della vittoria nella sfida), sfida
// vinta, casella della strada vinta
function oldFinish(profile, now, { kind, tile }, result) {
  const isChallenge = kind === 'challenge';
  recordBattle(profile, result);
  const rewards = grantRewards(profile, result, { prize: !isChallenge });
  const saved = isChallenge && result.completed ? village.winChallenge(profile, now) : 0;
  const conquest = kind === 'road' && result.completed ? winRoadTile(profile, tile) : null;
  return { rewards, challenge: isChallenge ? { saved } : null, conquest };
}

const ROAD_BATTLE = ROAD_TILES.find((tile) => tile.kind === 'battle').index;
const FIRST_BOSS = ROAD_TILES.find((tile) => tile.kind === 'boss').index;
const ROAD_CONTEXT = { kind: 'road', returnTo: 'World', tile: ROAD_BATTLE };
const CHALLENGE_CONTEXT = { kind: 'challenge', returnTo: 'World', tile: null };
const E = META_EVENTS;

// Ogni azione contro il vecchio codice delle scene (old, sulla copia riletta e portata ad adesso, come facevano il
// mondo e lo schieramento): stesso profilo in memoria e sul telefono, stesso risultato, e gli eventi detti in ordine
test('Azioni del meta-gioco: cambiano il profilo come il codice delle scene, salvano e dicono cosa è successo', (t) => {
  const check = checker(t);
  const cell = (profile, id) => village.freeSpot(profile.village.positions, id, 0);
  const placed = withBuilding(createProfile(), 'farm', 1);
  const moveTo = village.freeSpot(placed.village.positions, 'farm', 0, { col: 30, row: 30 });
  const cases = [
    ['step', createProfile(), (a) => a.step(), (p) => step(p), [E.STEPPED]],
    ['collectRations', withFarm(3.6), (a) => a.collectRations(), (p) => village.collectRations(p), [E.RATIONS_COLLECTED]],
    [
      'startUpgrade',
      rich(withBuilding(createProfile(), 'farm', 1)),
      (a) => a.startUpgrade('farm'),
      (p, now) => village.startUpgrade(p, 'farm', now),
      [E.CONSTRUCTION_STARTED],
    ],
    [
      'placeBuilding',
      createProfile(),
      (a) => a.placeBuilding('farm', cell(createProfile(), 'farm')),
      (p, now) => village.placeBuilding(p, 'farm', cell(p, 'farm'), now),
      [E.CONSTRUCTION_STARTED],
    ],
    ['moveBuilding', placed, (a) => a.moveBuilding('farm', moveTo), (p) => village.moveBuilding(p, 'farm', moveTo), []],
    [
      'useAccelerator',
      building(HOUR),
      (a) => a.useAccelerator(),
      (p, now) => village.useAccelerator(p, now),
      [E.CONSTRUCTION_SHORTENED],
    ],
    [
      'useAccelerator',
      building(20 * MINUTE),
      (a) => a.useAccelerator(),
      (p, now) => village.useAccelerator(p, now),
      [E.CONSTRUCTION_SHORTENED, E.CONSTRUCTION_FINISHED],
    ],
    ['startChallenge', building(HOUR), (a) => a.startChallenge(), (p, now) => village.startChallenge(p, now), []],
    [
      'placeHero',
      createProfile(),
      (a) => a.placeHero(2, 'rifleman'),
      (p) => {
        placeHero(p, 2, 'rifleman');
        return true;
      },
      [E.HERO_PLACED],
    ],
    ['recruit', createProfile(), (a) => a.recruit(), (p, now) => recruit(p, now), [E.HERO_RECRUITED]],
    [
      'starUp',
      (() => {
        const profile = createProfile();
        profile.heroes.rifleman.fragments = 12;
        return profile;
      })(),
      (a) => a.starUp('rifleman'),
      (p) => starUp(p, 'rifleman'),
      [E.HERO_STARRED],
    ],
    [
      'finishBattle',
      onTile(ROAD_BATTLE),
      (a) => a.finishBattle(ROAD_CONTEXT, battle(true)),
      (p, now) => oldFinish(p, now, ROAD_CONTEXT, battle(true)),
      [E.BATTLE_RECORDED],
    ],
    [
      'finishBattle',
      onTile(ROAD_BATTLE),
      (a) => a.finishBattle(ROAD_CONTEXT, battle(false)),
      (p, now) => oldFinish(p, now, ROAD_CONTEXT, battle(false)),
      [E.BATTLE_RECORDED],
    ],
    [
      'finishBattle',
      onTile(FIRST_BOSS),
      (a) => a.finishBattle({ ...ROAD_CONTEXT, tile: FIRST_BOSS }, battle(true)),
      (p, now) => oldFinish(p, now, { ...ROAD_CONTEXT, tile: FIRST_BOSS }, battle(true)),
      [E.BATTLE_RECORDED, E.AREA_CONQUERED],
    ],
    [
      'finishBattle',
      building(HOUR, true),
      (a) => a.finishBattle(CHALLENGE_CONTEXT, battle(true)),
      (p, now) => oldFinish(p, now, CHALLENGE_CONTEXT, battle(true)),
      [E.BATTLE_RECORDED, E.CONSTRUCTION_SHORTENED],
    ],
  ];
  const rows = cases.map(([action, profile, act, old, events]) => {
    const { save, actions, events: told } = setup(profile);
    const result = act(actions);
    const copy = reread(profile);
    village.settle(copy, T0);
    const expected = old(copy, T0);
    const written = JSON.parse(stored()).profile;
    const want = [...events, `${E.PROFILE_CHANGED}:${action}`].join();
    const ok = same(save.profile, copy) && same(written, storedProfile(copy)) && same(result, expected);
    return { action, ok, said: said(told), want, told };
  });
  check(
    `azioni come prima (profilo in memoria e sul telefono, risultato) e i loro eventi: ${rows.map((r) => `${r.action} ${r.ok ? 'uguale' : 'DIVERSO'} [${r.said}]`).join('; ')}`,
    rows.every((r) => r.ok && r.said === r.want),
  );
  // Cosa dicono gli eventi: la casella, le razioni, il cantiere aperto, accorciato e finito, l'eroe, la conquista
  const data = (index, name) => rows[index].told.find(([event]) => event === name)?.[1];
  const shortened = data(5, E.CONSTRUCTION_SHORTENED);
  const finished = data(6, E.CONSTRUCTION_FINISHED);
  const conquest = data(13, E.AREA_CONQUERED);
  const challenge = data(14, E.CONSTRUCTION_SHORTENED);
  const recorded = data(11, E.BATTLE_RECORDED);
  const payloads = [
    data(0, E.STEPPED)?.tile.index === 1,
    data(1, E.RATIONS_COLLECTED)?.amount === 3,
    same(data(2, E.CONSTRUCTION_STARTED), { building: 'farm', endsAt: T0 + 5 * MINUTE }),
    shortened?.building === 'barracks' && shortened.ms === VILLAGE.acceleratorMinutes * MINUTE,
    finished?.building === 'barracks' && finished.level === 4,
    same(data(8, E.HERO_PLACED), { slot: 2, id: 'rifleman' }),
    same(data(10, E.HERO_STARRED), { id: 'rifleman', stars: 2 }),
    recorded?.context === ROAD_CONTEXT && recorded.result.completed && recorded.rewards.completed,
    conquest?.area === 0 && conquest.reward.materials > 0,
    challenge?.building === 'barracks' && challenge.ms === HOUR * VILLAGE.challenge.timeShare,
  ];
  check(
    `dati degli eventi giusti ${payloads.filter(Boolean).length}/${payloads.length}`,
    payloads.every(Boolean),
  );
  check.done();
});

// Azioni che non si possono fare: niente di scritto sul telefono (nemmeno la copia di riserva), niente eventi, e lo
// dicono come prima (null, false, 0)
test('Azioni che non cambiano niente: non salvano e non dicono niente', (t) => {
  const check = checker(t);
  const cases = [
    ['step su una battaglia da vincere', onTile(ROAD_BATTLE), (a) => a.step(), null],
    ['collectRations senza razioni intere', withFarm(0.6), (a) => a.collectRations(), 0],
    [
      'startUpgrade senza materiali',
      (() => {
        const profile = withBuilding(createProfile(), 'farm', 1);
        profile.resources.materials = 0;
        return profile;
      })(),
      (a) => a.startUpgrade('farm'),
      false,
    ],
    ['startUpgrade di un edificio non messo', createProfile(), (a) => a.startUpgrade('farm'), false],
    ['placeBuilding fuori dal territorio', createProfile(), (a) => a.placeBuilding('farm', { col: 1, row: 1 }), false],
    ['moveBuilding di un edificio non messo', createProfile(), (a) => a.moveBuilding('farm', { col: 16, row: 16 }), false],
    ['useAccelerator senza cantiere', createProfile(), (a) => a.useAccelerator(), false],
    ['startChallenge con poco tempo', building(2 * MINUTE), (a) => a.startChallenge(), false],
    ['startChallenge già tentata', building(HOUR, true), (a) => a.startChallenge(), false],
    ['placeHero nel posto del capo', createProfile(), (a) => a.placeHero(0, 'rifleman'), false],
    [
      'recruit senza piastrine',
      (() => {
        const profile = createProfile();
        profile.resources.dogTags = 0;
        return profile;
      })(),
      (a) => a.recruit(),
      null,
    ],
    ['starUp senza frammenti', createProfile(), (a) => a.starUp('rifleman'), false],
    ['settle senza niente da fare', withFarm(2), (a) => a.settle(), undefined],
    ['prepareBattle della sfida senza cantiere', createProfile(), (a) => a.prepareBattle(CHALLENGE_CONTEXT), null],
  ];
  const rows = cases.map(([label, profile, act, expected]) => {
    const { actions, events } = setup(profile);
    const before = JSON.stringify([...storage.items]);
    const result = act(actions);
    const untouched = JSON.stringify([...storage.items]) === before;
    return { label, ok: result === expected && untouched && events.length === 0 };
  });
  const failed = rows.filter((r) => !r.ok).map((r) => r.label);
  check(
    `azioni che non si possono fare, senza scrivere né dire niente: ${rows.length - failed.length}/${rows.length}${failed.length ? ` (no: ${failed.join(', ')})` : ''}`,
    failed.length === 0,
  );
  check.done();
});

// Il villaggio portato ad adesso dentro un'azione: un cantiere finito nel frattempo si dice (prima di quello che fa
// l'azione) e si salva, anche se l'azione poi non si può fare, ma una volta sola
test("Un cantiere finito con il tempo si dice una volta, prima di quello che fa l'azione, e si salva", (t) => {
  const check = checker(t);
  const profile = withBuilding(createProfile(), 'barracks', 1);
  profile.village.construction = { building: 'barracks', endsAt: T0 - MINUTE, challenged: false };
  const { actions, events } = setup(profile);
  actions.collectRations();
  const first = said(events);
  const level = JSON.parse(stored()).profile.village.levels.barracks;
  events.length = 0;
  actions.step();
  const second = said(events);
  events.length = 0;
  actions.settle();
  const third = said(events);
  check(
    `cantiere finito: con un'azione che non si può fare [${first}] (sul telefono caserma liv. ${level}); al passo dopo [${second}]; poi [${third}]`,
    first === `${E.CONSTRUCTION_FINISHED},${E.PROFILE_CHANGED}:settle` &&
      level === 2 &&
      second === `${E.STEPPED},${E.PROFILE_CHANGED}:step` &&
      third === '',
  );
  const late = withBuilding(createProfile(), 'barracks', 1);
  late.village.construction = { building: 'barracks', endsAt: T0 - MINUTE, challenged: false };
  const both = setup(late);
  both.actions.step();
  check(
    `cantiere finito e un passo nella stessa azione: [${said(both.events)}]`,
    said(both.events) === `${E.CONSTRUCTION_FINISHED},${E.STEPPED},${E.PROFILE_CHANGED}:step`,
  );
  check.done();
});

// L'orologio del telefono tornato indietro di ore: i tempi rimessi a posto si salvano subito, così rileggendo il
// salvataggio la fattoria riprende da quando lo si è visto e non da un'ora più tarda (non si perde quello che produce)
test("L'orologio tornato indietro: i tempi rimessi a posto si salvano, e la fattoria produce da lì", (t) => {
  const check = checker(t);
  const profile = withFarm(0);
  profile.village.farm.since = T0 + 10 * HOUR;
  const { actions, events, clock } = setup(profile);
  actions.settle();
  const first = said(events);
  const since = JSON.parse(stored()).profile.village.farm.since;
  events.length = 0;
  clock.time = T0 + 30 * MINUTE;
  actions.settle();
  const quiet = said(events);
  const ready = actions.collectRations();
  check(
    `orologio indietro di 10 h: [${first}], sul telefono la fattoria riparte da T0 ${since === T0}; mezz'ora dopo il villaggio non dice niente [${quiet}] e si raccolgono ${ready} razioni`,
    first === `${E.PROFILE_CHANGED}:settle` && since === T0 && quiet === '' && ready === 6,
  );
  check.done();
});

// Prima della battaglia: la sfida si spende (una volta: la seconda non si può più) e la squadra si costruisce a ogni
// partenza con il villaggio di adesso; sulla strada non si spende niente
test('Prima della battaglia: la sfida si spende una volta, la squadra si fa a ogni partenza', (t) => {
  const check = checker(t);
  const { save, actions, events } = setup(building(HOUR));
  const makeLoadout = actions.prepareBattle(CHALLENGE_CONTEXT);
  const spent = said(events);
  const challenged = JSON.parse(stored()).profile.village.construction.challenged;
  const copy = reread(save.profile);
  const loadout = makeLoadout?.();
  const sameLoadout = same(loadout, loadoutFrom(copy, VILLAGE.challenge.rules));
  events.length = 0;
  const before = JSON.stringify([...storage.items]);
  const again = actions.prepareBattle(CHALLENGE_CONTEXT);
  const quiet = said(events) === '' && JSON.stringify([...storage.items]) === before;
  check(
    `sfida: spesa [${spent}], sul telefono tentata ${challenged}, squadra con le regole della sfida ${sameLoadout}; la seconda volta ${again === null ? 'niente' : 'di nuovo'}, senza scrivere né dire niente ${quiet}`,
    spent === `${E.PROFILE_CHANGED}:startChallenge` && challenged && sameLoadout && again === null && quiet,
  );
  const road = setup(onTile(ROAD_BATTLE));
  const untouched = JSON.stringify([...storage.items]);
  const makeRoad = road.actions.prepareBattle(ROAD_CONTEXT);
  const roadLoadout = makeRoad();
  const quietRoad = said(road.events) === '' && JSON.stringify([...storage.items]) === untouched;
  // Intanto la caserma è salita (da un'altra finestra): ripartendo la squadra la prende
  const grownProfile = withBuilding(onTile(ROAD_BATTLE), 'barracks', 1);
  put({ version: SAVE.version, profile: storedProfile(grownProfile) });
  const grown = makeRoad();
  const soldiers = VILLAGE.buildings.barracks.soldiers[0];
  check(
    `strada: niente detto né scritto ${quietRoad}; regole della casella ${same(roadLoadout.rules, ROAD_TILES[ROAD_BATTLE].rules)}; ripartendo con la caserma salita nel frattempo ${grown.soldiers} soldati in più (${soldiers} al liv. 1)`,
    quietRoad && same(roadLoadout.rules, ROAD_TILES[ROAD_BATTLE].rules) && grown.soldiers === soldiers,
  );
  check.done();
});

// Un'altra finestra del gioco ha cambiato il salvataggio: l'azione parte da quello. In sola lettura (un salvataggio
// più nuovo) e dopo una scrittura non riuscita no: i cambi della partita stanno solo in memoria e rileggendo si
// perderebbero; SAVE_FAILED dice la scrittura non riuscita (la sola lettura non è un errore)
test("Il salvataggio si rilegge prima di ogni azione, tranne quando i cambi stanno solo in memoria", (t) => {
  const check = checker(t);
  const { save, actions } = setup(createProfile());
  const other = createProfile();
  other.resources.rations = 3;
  other.resources.materials = 77;
  put({ version: SAVE.version, profile: storedProfile(other) });
  actions.step();
  const fromOther = save.profile.resources.materials === 77 && save.profile.road.at === 1;

  const locked = setup(withFarm(5), { version: SAVE.version + 1 });
  const raw = stored();
  locked.actions.collectRations();
  locked.actions.step();
  const lockedUntouched = stored() === raw;
  const kept = locked.save.profile.resources.rations;
  const lockedSaid = said(locked.events);

  const full = setup(withFarm(5));
  const refuse = t.mock.method(localStorage, 'setItem', () => {
    throw new Error('memoria piena');
  });
  full.actions.collectRations();
  full.actions.step();
  const failedSaid = said(full.events);
  const inMemory = full.save.profile.resources.rations;
  refuse.mock.restore();
  full.events.length = 0;
  full.actions.starUp('rifleman');
  full.actions.placeHero(2, 'sniper');
  const written = JSON.parse(stored()).profile;
  const back = said(full.events) === `${E.HERO_PLACED},${E.PROFILE_CHANGED}:placeHero` && written.resources.rations === 17;
  check(
    `altra finestra: l'azione parte dal suo salvataggio ${fromOther}; sola lettura: telefono uguale ${lockedUntouched}, razioni in memoria ${kept} dopo un'altra azione [${lockedSaid}]; scrittura rifiutata [${failedSaid}], razioni in memoria ${inMemory} dopo un'altra azione; quando torna a scrivere si salva tutto ${back}`,
    fromOther &&
      lockedUntouched &&
      kept === 17 &&
      lockedSaid === `${E.RATIONS_COLLECTED},${E.PROFILE_CHANGED}:collectRations,${E.STEPPED},${E.PROFILE_CHANGED}:step` &&
      failedSaid ===
        `${E.RATIONS_COLLECTED},${E.SAVE_FAILED},${E.PROFILE_CHANGED}:collectRations,${E.STEPPED},${E.SAVE_FAILED},${E.PROFILE_CHANGED}:step` &&
      inMemory === 17 &&
      back,
  );
  check.done();
});

// Si riparte da zero: il profilo di partenza, in memoria e sul telefono, e lo si dice
test('Cancellare il salvataggio: si riparte da zero e lo si dice', (t) => {
  const check = checker(t);
  const { save, actions, events } = setup(withFarm(4));
  actions.clearSave();
  const written = JSON.parse(stored()).profile;
  check(
    `cancellato: profilo di partenza ${same(save.profile, createProfile())}, sul telefono ${same(written, storedProfile(createProfile()))}, [${said(events)}]`,
    same(save.profile, createProfile()) &&
      same(written, storedProfile(createProfile())) &&
      said(events) === `${E.SAVE_CLEARED},${E.PROFILE_CHANGED}:clearSave`,
  );
  check.done();
});
