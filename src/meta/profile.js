import { GROWTH, RECRUIT } from '../data/growth.js';
import { HEROES, LINEUP } from '../data/heroes.js';
import { HERO } from '../config/balance.js';
import { VILLAGE } from '../data/village.js';
import { chapterOf } from './map.js';
import { canPlace, freeSpot } from './village.js';

// Profilo del giocatore: quello che il salvataggio porta da una sessione all'altra.
// stats: le statistiche delle battaglie finite (quelle lasciate a metà non contano): giocate e vinte, la distanza più
// lunga (bestDistance, in unità del mondo) e l'ultima battaglia (last: vinta o no, distanza, ondata raggiunta e se
// era già al boss). resources: razioni, materiali, rottami e acceleratori del villaggio (data/village.js) e piastrine
// (dogTags, per il reclutamento). heroes: per ogni eroe di
// data/heroes.js se è posseduto, esperienza, frammenti e stelle. lineup: chi sta in ognuno dei posti di HERO.slots
// (l'id o null; nel posto 0 sempre il capo). recruitState: tiri fatti, tiri di fila senza un raro e seme (0 finché
// non si tira la prima volta). village: livello e posto di ogni edificio (positions: la cella dell'angolo nord, null
// finché non è messo), il cantiere aperto (building, endsAt: quando finisce, in millisecondi di tempo vero;
// challenged: la sfida è già stata tentata) o null, e la fattoria (stored: razioni pronte, anche a pezzi; since: fin
// quando ha già prodotto). map: il capitolo della mappa (meta/map.js), il suo
// seme (0 finché non si apre la mappa), la casella dove si è e le caselle visitate e fatte (la partenza, 0, sempre)
export function createProfile() {
  const heroes = {};
  for (const hero of Object.values(HEROES)) heroes[hero.id] = { owned: hero.starter, xp: 0, fragments: 0, stars: 1 };
  return {
    stats: { played: 0, won: 0, bestDistance: 0, last: null },
    resources: { ...VILLAGE.start, dogTags: RECRUIT.startTags },
    heroes,
    lineup: startingLineup(),
    recruitState: { pulls: 0, sinceRare: 0, seed: 0 },
    village: createVillage(),
    map: createMap(),
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
    profile.stats.bestDistance = count(stats.bestDistance);
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
    const owned = hero.starter || saved.owned === true;
    profile.heroes[hero.id] = { owned, xp: count(saved.xp), fragments: count(saved.fragments), stars };
  }
  if (validLineup(data?.lineup, profile.heroes)) profile.lineup = [...data.lineup];
  const state = data?.recruitState;
  profile.recruitState = {
    pulls: count(state?.pulls),
    sinceRare: count(state?.sinceRare),
    seed: count(state?.seed),
  };
  profile.village = villageFrom(data?.village);
  profile.map = mapFrom(data?.map);
  return profile;
}

// Una battaglia finita entra nelle statistiche (result: il risultato della battaglia, systems/battle.js)
export function recordBattle(profile, { completed, distance, wave, boss }) {
  const { stats } = profile;
  stats.played += 1;
  if (completed) stats.won += 1;
  stats.bestDistance = Math.max(stats.bestDistance, distance);
  stats.last = { completed, distance, wave, boss };
}

// Lo schieramento di partenza (data/heroes.js LINEUP) come id per posto
function startingLineup() {
  const lineup = HERO.slots.map(() => null);
  for (const { hero, slot } of LINEUP) lineup[slot] = hero;
  return lineup;
}

function createMap() {
  return { chapter: 1, seed: 0, position: 0, visited: [0], cleared: [0] };
}

// La mappa salvata, controllata sul suo capitolo rigenerato dal seme (i dati della mappa possono essere cambiati): le
// caselle visitate sono una strada dalla partenza, ognuna sopra la precedente; si è sull'ultima; sono fatte tutte
// tranne, al massimo, quella dove si è, se è una battaglia. Se qualcosa non torna si riparte dal capitolo
function mapFrom(saved) {
  const map = createMap();
  if (saved === null || typeof saved !== 'object') return map;
  const chapter = Number.isInteger(saved.chapter) && saved.chapter >= 1 ? saved.chapter : 1;
  const seed = count(saved.seed);
  const list = (value) => (Array.isArray(value) ? value : []);
  const { position } = saved;
  const visited = list(saved.visited);
  const cleared = list(saved.cleared);
  if (seed === 0) return { ...map, chapter };
  const nodes = chapterOf({ map: { seed, chapter } });
  const valid = (id) => Number.isInteger(id) && id >= 0 && id < nodes.length;
  const walk = visited.length > 0 && visited.every(valid) && visited[0] === 0 &&
    visited.every((id, index) => index === 0 || nodes[visited[index - 1]].next.includes(id));
  const here = visited.at(-1);
  const done = (id) => cleared.includes(id) || (id === here && nodes[id].rules !== undefined);
  const ok = walk && position === here && cleared.every((id) => visited.includes(id)) && visited.every(done);
  return ok ? { chapter, seed, position, visited: [...visited], cleared: [...cleared] } : { ...map, chapter };
}

function createVillage() {
  const ids = Object.keys(VILLAGE.buildings);
  const levels = Object.fromEntries(ids.map((id) => [id, 0]));
  const positions = Object.fromEntries(ids.map((id) => [id, null]));
  return { levels, positions, construction: null, farm: { stored: 0, since: 0 } };
}

// Il villaggio salvato, campo per campo: livelli interi entro il massimo, un cantiere solo se è di un edificio che
// può ancora salire. Ha un posto ogni edificio costruito o in cantiere, e solo lui: prima si tengono i posti salvati
// che ci stanno (un edificio dopo l'altro), poi chi resta senza prende il primo libero vicino al centro (anche per i
// salvataggi di prima del 4.7)
function villageFrom(saved) {
  const village = createVillage();
  if (saved === null || typeof saved !== 'object') return village;
  for (const [id, building] of Object.entries(VILLAGE.buildings)) {
    const level = saved.levels?.[id];
    if (Number.isInteger(level)) village.levels[id] = Math.min(building.maxLevel, Math.max(0, level));
  }
  const job = saved.construction;
  const id = job?.building;
  const open = Object.hasOwn(VILLAGE.buildings, id ?? '') && village.levels[id] < VILLAGE.buildings[id].maxLevel;
  if (open && Number.isFinite(job.endsAt)) {
    village.construction = { building: id, endsAt: job.endsAt, challenged: job.challenged === true };
  }
  village.farm = { stored: count(saved.farm?.stored), since: count(saved.farm?.since) };
  const placed = Object.keys(VILLAGE.buildings).filter(
    (id) => village.levels[id] > 0 || village.construction?.building === id,
  );
  for (const id of placed) {
    const at = saved.positions?.[id];
    const cell = Number.isInteger(at?.col) && Number.isInteger(at?.row) ? { col: at.col, row: at.row } : null;
    if (cell !== null && canPlace(village.positions, id, cell)) village.positions[id] = cell;
  }
  for (const id of placed) {
    if (village.positions[id] === null) village.positions[id] = freeSpot(village.positions, id);
  }
  return village;
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
  const { completed, distance, wave, boss } = last;
  if (typeof completed !== 'boolean' || typeof boss !== 'boolean' || !Number.isInteger(wave) || wave < 1) return null;
  return { completed, distance: count(distance), wave, boss };
}
