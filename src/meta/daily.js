import { createRng } from '../core/rng.js';
import { localDay } from '../core/time.js';
import { DAILY } from '../data/daily.js';
import { RECRUIT } from '../data/growth.js';
import { VILLAGE } from '../data/village.js';
import { ROAD_TILES, battleRules, isBattle } from './road.js';

// Missioni e sfide del giorno (data/daily.js), nel profilo (daily): il giorno a cui sono (day, il numero di
// core/time.js localDay; -1 prima della prima volta), le missioni di quel giorno (missions: id, a che punto è,
// progress, e se è ritirata, claimed), se il premio di tutte è già preso (bonus) e le sfide già giocate quel giorno
// (played: gli id). Le azioni del meta-gioco (meta/actions.js) portano il giorno ad adesso prima di ogni cambio
export function createDaily() {
  return { day: -1, missions: [], bonus: false, played: [] };
}

// Il giorno dai dati salvati: se qualcosa non va riparte da zero, e la prossima azione pesca le missioni di oggi
export function dailyFrom(data) {
  const valid =
    Number.isInteger(data?.day) &&
    Array.isArray(data.missions) &&
    data.missions.every(validMission) &&
    typeof data.bonus === 'boolean' &&
    Array.isArray(data.played) &&
    data.played.every((id) => Object.hasOwn(DAILY.challenges, id));
  if (!valid) return createDaily();
  const missions = data.missions.map(({ id, progress, claimed }) => ({ id, progress, claimed }));
  return { day: data.day, missions, bonus: data.bonus, played: [...new Set(data.played)] };
}

function validMission(mission) {
  const { id, progress, claimed } = mission ?? {};
  return (
    Object.hasOwn(DAILY.missions.pool, id) && Number.isFinite(progress) && progress >= 0 && typeof claimed === 'boolean'
  );
}

// Al cambio del giorno (now, in millisecondi di tempo vero; dayOf dà il numero del giorno, di base con l'ora del
// telefono) le missioni nuove, niente ritirato, le sfide da rigiocare. Dice se è cambiato qualcosa
export function refreshDaily(profile, now, dayOf = localDay) {
  const day = dayOf(now);
  if (profile.daily.day === day) return false;
  const missions = todayMissions(day, profile).map((id) => ({ id, progress: 0, claimed: false }));
  profile.daily = { day, missions, bonus: false, played: [] };
  return true;
}

// Le missioni del giorno day per il profilo profile: DAILY.missions.count tipi diversi, pescati con il seme del giorno
// tra quelli che si possono fare (feasible)
export function todayMissions(day, profile) {
  const rng = createRng(DAILY.seed + day);
  const ids = Object.keys(DAILY.missions.pool).filter((id) => feasible(profile, id));
  return rng.shuffle(ids).slice(0, DAILY.missions.count);
}

// La missione id si può finire con il profilo profile: battaglie e boss se la strada ne ha davanti quanti ne chiede il
// traguardo, cantieri se restano abbastanza livelli da aprire (meno quelli già in cantiere), le raccolte con la
// fattoria, il reclutamento con le piastrine o con battaglie davanti che ne danno
function feasible(profile, id) {
  const { road, village, resources } = profile;
  const { pool } = DAILY.missions;
  const ahead = ROAD_TILES.slice(road.done ? road.at + 1 : road.at).filter(isBattle);
  if (id === 'battles') return ahead.length >= pool.battles.target;
  if (id === 'bosses') return ahead.filter((tile) => tile.kind === 'boss').length >= pool.bosses.target;
  if (id === 'builds') {
    const left = Object.entries(village.levels).reduce(
      (sum, [building, level]) => sum + VILLAGE.buildings[building].maxLevel - level,
      0,
    );
    return left - village.sites.length >= pool.builds.target;
  }
  if (id === 'harvests') return village.levels.farm > 0;
  if (id === 'recruits') return resources.dogTags >= RECRUIT.cost || ahead.length > 0;
  return true;
}

// La missione kind di oggi, se c'è, avanza di amount (fino al suo traguardo). Dice se è cambiata
export function advanceMission(profile, kind, amount = 1) {
  const mission = profile.daily.missions.find(({ id }) => id === kind);
  if (mission === undefined || amount <= 0) return false;
  const { target } = DAILY.missions.pool[kind];
  if (mission.progress >= target) return false;
  mission.progress = Math.min(target, mission.progress + amount);
  return true;
}

// Una battaglia finita (context come in meta/actions.js, result: systems/battle.js battleResult, kept: il bottino
// tenuto, meta/rewards.js) fa avanzare le missioni che conta
export function advanceByBattle(profile, context, result, kept) {
  const { completed, feats } = result;
  const road = context.kind === 'road' && completed;
  advanceMission(profile, 'battles', road ? 1 : 0);
  advanceMission(profile, 'bosses', road && ROAD_TILES[context.tile].kind === 'boss' ? 1 : 0);
  advanceMission(profile, 'dailyWins', context.kind === 'daily' && completed ? 1 : 0);
  advanceMission(profile, 'wood', kept.wood ?? 0);
  advanceMission(profile, 'stone', kept.stone ?? 0);
  advanceMission(profile, 'chests', feats.chests);
  advanceMission(profile, 'flips', feats.flips);
  advanceMission(profile, 'kills', feats.kills);
}

// La missione numero index di oggi, finita e non ancora ritirata, dà le sue gemme; ritirate tutte, anche il premio di
// tutte (una volta). Restituisce le gemme avute, o 0 se non si poteva
export function claimMission(profile, index) {
  const { daily, resources } = profile;
  const mission = daily.missions[index];
  if (mission === undefined || mission.claimed || mission.progress < DAILY.missions.pool[mission.id].target) return 0;
  mission.claimed = true;
  let gems = DAILY.missions.gems;
  if (!daily.bonus && daily.missions.every(({ claimed }) => claimed)) {
    daily.bonus = true;
    gems += DAILY.missions.allBonus;
  }
  resources.gems += gems;
  return gems;
}

// Quante missioni di oggi si possono ritirare adesso
export function claimableMissions(profile) {
  return profile.daily.missions.filter(
    ({ id, progress, claimed }) => !claimed && progress >= DAILY.missions.pool[id].target,
  ).length;
}

// La sfida del giorno id si può giocare: esiste e oggi non è ancora stata giocata
export function canPlayDaily(profile, id) {
  return Object.hasOwn(DAILY.challenges, id) && !profile.daily.played.includes(id);
}

// La sfida del giorno id si spende (partendo). Dice se si poteva
export function startDaily(profile, id) {
  if (!canPlayDaily(profile, id)) return false;
  profile.daily.played.push(id);
  return true;
}

// Le regole della sfida del giorno id: quelle della prossima battaglia della strada (o di quella dove si è, da
// vincere; in fondo alla strada l'ultima), con quello che la sfida cambia, senza il numero (non è della strada)
export function dailyRules(profile, id) {
  const { type, ratio, countScale, specials } = DAILY.challenges[id];
  const tile = ahead(profile);
  return { ...battleRules(tile.rules.number, tile.area, { type, ratio, countScale, specials }), number: null };
}

// La prima casella con una battaglia da qui in avanti (quella dove si è se è da vincere), o l'ultima della strada
function ahead({ road }) {
  const from = road.done ? road.at + 1 : road.at;
  return ROAD_TILES.slice(from).find(isBattle) ?? ROAD_TILES.findLast(isBattle);
}
