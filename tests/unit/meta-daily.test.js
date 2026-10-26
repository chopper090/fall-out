import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  MISSION,
  SAVE,
  loadSave,
  newBattle,
  put,
  restore,
  same,
  stepBattle,
  storage,
  stored,
} from '../support/suite.js';
import { META_EVENTS } from '../../src/core/events.js';
import { localDay } from '../../src/core/time.js';
import { DAILY } from '../../src/data/daily.js';
import { createMetaActions } from '../../src/meta/actions.js';
import {
  canPlayDaily,
  claimableMissions,
  createDaily,
  dailyFrom,
  dailyRules,
  refreshDaily,
  todayMissions,
} from '../../src/meta/daily.js';
import { loadoutFrom } from '../../src/meta/loadout.js';
import { createProfile, storedProfile } from '../../src/meta/profile.js';
import { ROAD_TILES } from '../../src/meta/road.js';
import { freeSpot } from '../../src/meta/village.js';
import { VILLAGE } from '../../src/data/village.js';
import { battleResult } from '../../src/systems/battle.js';
import { levelPower } from '../../src/systems/power.js';

// Missioni e sfide del giorno (S6, meta/daily.js): le missioni cambiano a mezzanotte e si ritirano per gemme, le sfide
// del giorno si giocano una volta al giorno e vinte danno gemme
const T0 = 1_800_000_000_000;
const DAY = 24 * 60 * 60000;
const E = META_EVENTS;

// Un profilo salvato con le sue azioni all'ora clock.time (di partenza T0), con le missioni di oggi missions (id) se
// date; events raccoglie quello che dicono
function setup(profile, missions = null) {
  refreshDaily(profile, T0);
  if (missions !== null) profile.daily.missions = missions.map((id) => ({ id, progress: 0, claimed: false }));
  storage.items.clear();
  put({ version: SAVE.version, profile: storedProfile(profile) });
  const save = loadSave();
  const events = [];
  const clock = { time: T0 };
  const actions = createMetaActions({ save, emit: (name, data) => events.push([name, data]), now: () => clock.time });
  return { save, actions, events, clock };
}

// Una battaglia vera giocata fino in fondo con la squadra del profilo e le regole rules: gli eroi non cadono e i nemici
// che passano non contano, così si vince
function playedResult(profile, rules) {
  const battle = newBattle(5, undefined, loadoutFrom(profile, rules));
  for (const hero of battle.army.heroes) hero.hp = hero.maxHp = 1e9;
  MISSION.maxEscaped = 1e9;
  for (let i = 0; i < 60 * 200 && !battle.over; i++) stepBattle(battle, 1000 / 60);
  restore(MISSION, 'maxEscaped');
  return battleResult(battle);
}

// S6. Missioni del giorno: tre diverse, le stesse tutto il giorno, nuove a mezzanotte (con le sfide da rigiocare);
// da un salvataggio rotto si riparte da zero
test('S6. Missioni del giorno: tre diverse, le stesse tutto il giorno, nuove a mezzanotte', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const first = refreshDaily(profile, T0);
  const ids = profile.daily.missions.map(({ id }) => id);
  const later = refreshDaily(profile, T0 + 60000);
  profile.daily.missions[0].progress = 1;
  profile.daily.played.push('horde');
  const midnight = new Date(T0);
  midnight.setHours(24, 0, 0, 0);
  const before = refreshDaily(profile, midnight.getTime() - 1);
  const after = refreshDaily(profile, midnight.getTime());
  const fresh = profile.daily.missions.every(({ progress, claimed }) => progress === 0 && !claimed);
  // Con la fattoria tutte le missioni si possono fare; in fondo alla strada e con il villaggio finito niente
  // battaglie, boss né cantieri
  const rich = createProfile();
  rich.village.levels.farm = 1;
  const days = Array.from({ length: 30 }, (_, i) => todayMissions(localDay(T0) + i, rich).join());
  const done = createProfile();
  done.road = { at: ROAD_TILES.length - 1, done: true, lost: false };
  for (const id of Object.keys(done.village.levels)) done.village.levels[id] = VILLAGE.buildings[id].maxLevel;
  const late = Array.from({ length: 30 }, (_, i) => todayMissions(localDay(T0) + i, done)).flat();
  const impossible = late.filter((id) => ['battles', 'bosses', 'builds'].includes(id)).length;
  const distinct = days.every((day) => new Set(day.split(',')).size === DAILY.missions.count);
  const broken = [null, { day: 'x' }, { day: 3, missions: [{ id: 'nessuna', progress: 0, claimed: false }] }];
  const fromBroken = broken.map((data) => same(dailyFrom(data), createDaily()));
  const kept = dailyFrom(JSON.parse(JSON.stringify(profile.daily)));
  check(
    `missioni: oggi ${ids.join(' ')} (nuove ${first}), un minuto dopo nuove ${later}; prima di mezzanotte ${before}, a mezzanotte ${after} (giorno ${profile.daily.day}, a zero ${fresh}, sfide da rigiocare ${profile.daily.played.length === 0}); 30 giorni con tre diverse ${distinct}, giorni diversi ${new Set(days).size}, a strada finita impossibili ${impossible}; salvataggi rotti da zero ${fromBroken.join(' ')}, buono tenuto ${same(kept, profile.daily)}`,
    first &&
      !later &&
      !before &&
      after &&
      ids.length === DAILY.missions.count &&
      new Set(ids).size === ids.length &&
      ids.every((id) => Object.hasOwn(DAILY.missions.pool, id)) &&
      fresh &&
      profile.daily.played.length === 0 &&
      profile.daily.day === localDay(T0) + 1 &&
      distinct &&
      new Set(days).size > 20 &&
      impossible === 0 &&
      fromBroken.every(Boolean) &&
      same(kept, profile.daily),
  );
  check.done();
});

// S6. Le azioni fanno avanzare le missioni di oggi: cantieri, raccolte, reclutamento e battaglie (vinte, boss, legno,
// pietra, scrigni, nemici), mai oltre il traguardo
test('S6. Le azioni fanno avanzare le missioni di oggi, mai oltre il traguardo', (t) => {
  const check = checker(t);
  const profile = createProfile();
  Object.assign(profile.resources, { wood: 500, stone: 500, gears: 100, dogTags: 50 });
  const { save, actions } = setup(profile, ['builds', 'recruits', 'harvests']);
  actions.placeBuilding('farm', freeSpot(profile.village.positions, 'farm', 0));
  actions.recruit();
  actions.recruit();
  actions.collectRations();
  const [builds, recruits, harvests] = save.profile.daily.missions.map(({ progress }) => progress);
  const tile = ROAD_TILES.find((one) => one.kind === 'battle');
  const battleProfile = createProfile();
  battleProfile.road = { at: tile.index, done: false, lost: false };
  const result = playedResult(battleProfile, tile.rules);
  const other = setup(battleProfile, ['battles', 'kills', 'chests']);
  const rewards = other.actions.finishBattle({ kind: 'road', returnTo: 'World', tile: tile.index }, result).rewards;
  const [battles, kills, chests] = other.save.profile.daily.missions.map(({ progress }) => progress);
  const woodProfile = createProfile();
  woodProfile.road = { at: tile.index, done: false, lost: false };
  const woods = setup(woodProfile, ['wood', 'stone', 'bosses']);
  woods.actions.finishBattle({ kind: 'road', returnTo: 'World', tile: tile.index }, result);
  const [wood, stone, bosses] = woods.save.profile.daily.missions.map(({ progress }) => progress);
  const target = (id) => DAILY.missions.pool[id].target;
  check(
    `missioni dalle azioni: cantieri ${builds}, reclutamenti ${recruits}, raccolte ${harvests}; battaglia vinta ${result.completed}: battaglie ${battles}, nemici ${kills} (${result.feats.kills} abbattuti), scrigni ${chests} (${result.feats.chests} aperti), legno ${wood} (${rewards.kept.wood} tenuti), pietra ${stone} (${rewards.kept.stone}), boss ${bosses}`,
    builds === 1 &&
      recruits === 1 &&
      harvests === 0 &&
      result.completed &&
      battles === 1 &&
      kills === Math.min(target('kills'), result.feats.kills) &&
      result.feats.kills > 0 &&
      chests === Math.min(target('chests'), result.feats.chests) &&
      wood === Math.min(target('wood'), rewards.kept.wood) &&
      stone === Math.min(target('stone'), rewards.kept.stone) &&
      bosses === 0,
  );
  check.done();
});

// S6. Ritirare: solo una missione finita, una volta, per le sue gemme; ritirate tutte, anche il premio di tutte
test('S6. Ritirare: solo una missione finita, una volta; ritirate tutte, il premio di tutte', (t) => {
  const check = checker(t);
  const { save, actions, events } = setup(createProfile(), ['builds', 'recruits', 'harvests']);
  const gems = () => save.profile.resources.gems;
  const start = gems();
  const early = actions.claimMission(0);
  const quietEarly = events.length === 0;
  for (const mission of save.profile.daily.missions) mission.progress = DAILY.missions.pool[mission.id].target;
  put({ version: SAVE.version, profile: storedProfile(save.profile) });
  const ready = claimableMissions(save.profile);
  const got = [actions.claimMission(0), actions.claimMission(0), actions.claimMission(1), actions.claimMission(2)];
  const said = events.filter(([name]) => name === E.MISSION_CLAIMED).map(([, data]) => `${data.id} +${data.gems}`);
  const written = JSON.parse(stored()).profile.daily;
  const { gems: each, allBonus } = DAILY.missions;
  check(
    `ritirare: prima della fine ${early} (silenzio ${quietEarly}); pronte ${ready}; ritirate ${got.join(' ')}, gemme da ${start} a ${gems()}; detto ${said.join(', ')}; premio di tutte ${save.profile.daily.bonus}, scritto ${written.bonus}`,
    early === 0 &&
      quietEarly &&
      ready === 3 &&
      got.join() === [each, 0, each, each + allBonus].join() &&
      gems() === start + 3 * each + allBonus &&
      said.length === 3 &&
      save.profile.daily.bonus &&
      written.bonus &&
      claimableMissions(save.profile) === 0,
  );
  check.done();
});

// S6. Sfide del giorno: più dure della prossima battaglia della strada, una volta al giorno (si spendono partendo),
// vinte danno le gemme invece del premio della vittoria; persa niente; il giorno dopo si rigiocano
test('S6. Sfide del giorno: più dure, una volta al giorno, vinte danno le gemme', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const next = ROAD_TILES.find((tile) => tile.rules);
  const harder = Object.keys(DAILY.challenges).map((id) => {
    const rules = dailyRules(profile, id);
    return { id, ratio: levelPower(rules) / levelPower(next.rules), rules };
  });
  const { save, actions, clock } = setup(profile);
  const context = { kind: 'daily', returnTo: 'Daily', daily: 'horde' };
  const make = actions.prepareBattle(context);
  const again = actions.prepareBattle(context);
  const open = canPlayDaily(save.profile, 'horde');
  const loadout = make();
  const result = playedResult(save.profile, loadout.rules);
  const before = { ...save.profile.resources };
  const outcome = actions.finishBattle(context, result);
  const gems = save.profile.resources.gems - before.gems;
  const lostProfile = setup(createProfile());
  lostProfile.actions.prepareBattle({ ...context, daily: 'armored' });
  const lost = lostProfile.actions.finishBattle({ ...context, daily: 'armored' }, { ...result, completed: false });
  clock.time = T0 + DAY;
  actions.settle();
  const tomorrow = canPlayDaily(save.profile, 'horde');
  check(
    `sfide del giorno: forza richiesta rispetto alla prossima battaglia ${harder.map((h) => `${h.id} ×${h.ratio.toFixed(2)}`).join(', ')}; partita ${make !== null}, di nuovo ${again !== null}, ancora aperta ${open}; vinta ${result.completed}: gemme +${gems} (attese ${DAILY.challenges.horde.gems}), detto ${JSON.stringify(outcome.daily)}, premio della vittoria ${JSON.stringify(outcome.rewards.prize)}; persa ${JSON.stringify(lost.daily)}; domani si rigioca ${tomorrow}`,
    harder.every((h) => h.ratio > 1) &&
      harder.find((h) => h.id === 'bosses').rules.type === 'double' &&
      make !== null &&
      again === null &&
      !open &&
      result.completed &&
      gems === DAILY.challenges.horde.gems &&
      same(outcome.daily, { id: 'horde', gems: DAILY.challenges.horde.gems }) &&
      Object.values(outcome.rewards.prize).every((amount) => amount === 0) &&
      same(lost.daily, { id: 'armored', gems: 0 }) &&
      tomorrow,
  );
  check.done();
});
