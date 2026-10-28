import { GROWTH, RECRUIT } from '../data/growth.js';
import { HEROES, LINEUP } from '../data/heroes.js';
import { HERO } from '../config/balance.js';
import { VILLAGE } from '../data/village.js';
import { createDaily, dailyFrom } from './daily.js';
import { ROAD_TILES, conqueredAreas, isBattle, restoredRoad, storedRoad } from './road.js';
import { canPlace, freeSpot } from './village.js';
import { villageRect } from './world.js';

// Profilo del giocatore: quello che il salvataggio porta da una sessione all'altra. stats: le statistiche delle
// battaglie finite (quelle lasciate a metà non contano): giocate e vinte e l'ultima battaglia (last: vinta o no, ondata
// raggiunta e se era già al boss). resources: le scorte del villaggio (data/village.js: razioni, legno, pietra,
// ingranaggi, circuiti e gemme), piastrine (dogTags, per il reclutamento) ed esperienza (xp, da spendere sugli eroi).
// heroes: per ogni eroe di data/heroes.js se è posseduto, livello, frammenti e stelle. lineup: chi sta in ognuno dei
// posti di HERO.slots (l'id o null; nel posto 0 sempre il capo). recruitState: tiri fatti, tiri di fila senza un raro e
// seme (0 finché non si tira la prima volta). village: livello e posto di ogni edificio (positions: la cella
// dell'angolo nord, null finché non è messo; il centro città c'è dall'inizio), i cantieri aperti (sites, in ordine di
// apertura, uno per edificio: building, endsAt: quando finisce, in millisecondi di tempo vero; challenged: la sfida è
// già stata tentata), la fattoria (stored: razioni pronte, anche a pezzi; since: fin quando ha già prodotto) e la
// valvola del centro (relief.since: da quando mancano le razioni, null se bastano). road: il cammino sulla strada
// (meta/road.js): la casella dove si è (at, 0 la porta), se è fatta (done; solo una battaglia ancora da vincere non lo
// è) e se la sua battaglia è già stata persa (lost). daily: missioni e sfide del giorno (meta/daily.js). Sul telefono
// si salva com'è, tranne il cammino (storedProfile)
export function createProfile() {
  const heroes = {};
  for (const hero of Object.values(HEROES)) heroes[hero.id] = { owned: hero.starter, level: 1, fragments: 0, stars: 1 };
  return {
    stats: { played: 0, won: 0, last: null },
    resources: { ...VILLAGE.start, dogTags: RECRUIT.startTags, xp: 0 },
    heroes,
    lineup: startingLineup(),
    recruitState: { pulls: 0, sinceRare: 0, seed: 0 },
    village: createVillage(),
    road: createRoad(),
    daily: createDaily(),
  };
}

// Profilo dai dati salvati: ogni campo che manca o non va bene prende il valore di partenza, quelli sconosciuti (eroi
// compresi) restano fuori. Uno schieramento con eroi non posseduti, ripetuti o senza il capo al suo posto torna quello
// di partenza
export function profileFrom(data) {
  const profile = createProfile();
  const stats = data?.stats;
  if (stats !== undefined && stats !== null) {
    profile.stats.played = count(stats.played);
    profile.stats.won = Math.min(count(stats.won), profile.stats.played);
    profile.stats.last = battleFrom(stats.last);
  }
  for (const kind of Object.keys(profile.resources)) {
    const saved = data?.resources?.[kind];
    if (Number.isFinite(saved) && saved >= 0) profile.resources[kind] = saved;
  }
  for (const hero of Object.values(HEROES)) {
    const saved = data?.heroes?.[hero.id];
    if (saved === null || typeof saved !== 'object') continue;
    const stars = Number.isInteger(saved.stars) ? Math.min(GROWTH.maxStars, Math.max(1, saved.stars)) : 1;
    const level = Number.isInteger(saved.level) ? Math.min(GROWTH.maxLevel, Math.max(1, saved.level)) : 1;
    const owned = hero.starter || saved.owned === true;
    profile.heroes[hero.id] = { owned, level, fragments: count(saved.fragments), stars };
  }
  if (validLineup(data?.lineup, profile.heroes)) profile.lineup = [...data.lineup];
  const state = data?.recruitState;
  profile.recruitState = {
    pulls: count(state?.pulls),
    sinceRare: count(state?.sinceRare),
    seed: count(state?.seed),
  };
  profile.road = roadFrom(data?.road);
  profile.village = villageFrom(data?.village, conqueredAreas(profile.road));
  profile.daily = dailyFrom(data?.daily);
  return profile;
}

// Il profilo come si salva sul telefono, l'inverso di profileFrom: il cammino con l'area e il posto nell'area
// (meta/road.js storedRoad) invece della casella, tutto il resto com'è
export function storedProfile(profile) {
  return { ...profile, road: storedRoad(profile.road) };
}

// Una battaglia finita entra nelle statistiche (result: il risultato della battaglia, systems/battle.js)
export function recordBattle(profile, { completed, wave, boss }) {
  const { stats } = profile;
  stats.played += 1;
  if (completed) stats.won += 1;
  stats.last = { completed, wave, boss };
}

// Lo schieramento di partenza (data/heroes.js LINEUP) come id per posto
function startingLineup() {
  const lineup = HERO.slots.map(() => null);
  for (const { hero, slot } of LINEUP) lineup[slot] = hero;
  return lineup;
}

function createRoad() {
  return { at: 0, done: true, lost: false };
}

// Il cammino salvato: l'area e il posto nell'area (storedProfile) o, nei profili in memoria, la casella (at); e, se è
// una battaglia, se è vinta (le altre sono fatte appena ci si arriva) o già persa. Se non torna si riparte dalla
// porta, come i salvataggi di prima della strada (con la mappa a bivi)
function roadFrom(saved) {
  const inMemory = { at: saved?.at, done: saved?.done === true, lost: saved?.lost === true };
  const road = Number.isInteger(saved?.area) ? restoredRoad(saved) : inMemory;
  const at = road?.at;
  if (!Number.isInteger(at) || at < 0 || at >= ROAD_TILES.length) return createRoad();
  const done = !isBattle(ROAD_TILES[at]) || road.done;
  return { at, done, lost: !done && road.lost };
}

// Il villaggio di chi comincia: gli edifici al loro livello di partenza (startLevel, di solito 0: da costruire), il
// centro città già nella sua cella (homeOf), nessun cantiere, la fattoria vuota, la valvola del centro da contare
function createVillage() {
  const entries = Object.entries(VILLAGE.buildings);
  const levels = Object.fromEntries(entries.map(([id, building]) => [id, building.startLevel ?? 0]));
  const positions = Object.fromEntries(entries.map(([id]) => [id, null]));
  positions.center = homeOf(positions, 0);
  return { levels, positions, sites: [], farm: { stored: 0, since: 0 }, relief: { since: null } };
}

// Il posto del centro città nel territorio (con conquered aree conquistate): la sua cella di partenza nel villaggio
// (VILLAGE.buildings.center.home), se è libera, se no il primo posto libero vicino al centro del villaggio
function homeOf(positions, conquered) {
  const [col, row] = VILLAGE.buildings.center.home;
  const area = villageRect();
  const home = { col: area.col + col, row: area.row + row };
  return canPlace(positions, 'center', home, conquered) ? home : freeSpot(positions, 'center', conquered);
}

// Il villaggio salvato, campo per campo: livelli interi tra quello di partenza e il massimo, e i cantieri che tornano
// (sitesFrom). Ha un posto ogni edificio costruito o in cantiere (il centro città sempre), e solo lui: prima si tengono
// i posti salvati che ci stanno nel territorio con conquered aree conquistate (un edificio dopo l'altro), poi chi
// resta senza prende il primo libero vicino al centro del villaggio (anche per i salvataggi di prima del 4.7), il
// centro la sua cella se è libera (per i salvataggi di prima del centro)
function villageFrom(saved, conquered) {
  const village = createVillage();
  if (saved === null || typeof saved !== 'object') return village;
  for (const [id, building] of Object.entries(VILLAGE.buildings)) {
    const level = saved.levels?.[id];
    const lowest = building.startLevel ?? 0;
    if (Number.isInteger(level)) village.levels[id] = Math.min(building.maxLevel, Math.max(lowest, level));
  }
  village.sites = sitesFrom(saved.sites, village.levels);
  village.farm = { stored: count(saved.farm?.stored), since: count(saved.farm?.since) };
  const since = saved.relief?.since;
  village.relief = { since: Number.isFinite(since) && since >= 0 ? since : null };
  village.positions = Object.fromEntries(Object.keys(VILLAGE.buildings).map((id) => [id, null]));
  const placed = Object.keys(VILLAGE.buildings).filter(
    (id) => village.levels[id] > 0 || village.sites.some((site) => site.building === id),
  );
  for (const id of placed) {
    const at = saved.positions?.[id];
    const cell = Number.isInteger(at?.col) && Number.isInteger(at?.row) ? { col: at.col, row: at.row } : null;
    if (cell !== null && canPlace(village.positions, id, cell, conquered)) village.positions[id] = cell;
  }
  for (const id of placed) {
    if (village.positions[id] !== null) continue;
    const spot = id === 'center' ? homeOf(village.positions, conquered) : freeSpot(village.positions, id, conquered);
    village.positions[id] = spot;
  }
  return village;
}

// I cantieri salvati, nel loro ordine: si tiene quello di un edificio che può ancora salire dai livelli levels, con
// una fine valida e senza un altro cantiere dello stesso edificio prima di lui; gli altri restano fuori. Anche oltre i
// posti cantiere (VILLAGE.builders, che non si salvano: quelli in più del pannello di sviluppo valgono finché la
// pagina resta aperta): un cantiere pagato non si perde, e i posti contano solo per aprirne di nuovi
function sitesFrom(saved, levels) {
  const sites = [];
  if (!Array.isArray(saved)) return sites;
  for (const site of saved) {
    const id = site?.building;
    const open = Object.hasOwn(VILLAGE.buildings, id ?? '') && levels[id] < VILLAGE.buildings[id].maxLevel;
    const twice = sites.some((other) => other.building === id);
    if (open && !twice && Number.isFinite(site.endsAt)) {
      sites.push({ building: id, endsAt: site.endsAt, challenged: site.challenged === true });
    }
  }
  return sites;
}

function validLineup(lineup, heroes) {
  if (!Array.isArray(lineup) || lineup.length !== HERO.slots.length || lineup[0] !== 'leader') return false;
  const ids = lineup.filter((id) => id !== null);
  return ids.every((id) => heroes[id]?.owned) && new Set(ids).size === ids.length;
}

function count(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function battleFrom(last) {
  if (last === null || typeof last !== 'object') return null;
  const { completed, wave, boss } = last;
  if (typeof completed !== 'boolean' || typeof boss !== 'boolean' || !Number.isInteger(wave) || wave < 1) return null;
  return { completed, wave, boss };
}
