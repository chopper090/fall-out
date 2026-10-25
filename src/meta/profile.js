import { GROWTH, RECRUIT } from '../data/growth.js';
import { HEROES, LINEUP } from '../data/heroes.js';
import { HERO } from '../config/balance.js';

// Profilo del giocatore: quello che il salvataggio porta da una sessione all'altra.
// stats: le statistiche delle battaglie finite (quelle lasciate a metà non contano): giocate e vinte, la distanza più
// lunga (bestDistance, in unità del mondo) e l'ultima battaglia (last: vinta o no, distanza, ondata raggiunta e se
// era già al boss). resources: materiali e piastrine (dogTags, per il reclutamento). heroes: per ogni eroe di
// data/heroes.js se è posseduto, esperienza, frammenti e stelle. lineup: chi sta in ognuno dei posti di HERO.slots
// (l'id o null; nel posto 0 sempre il capo). recruitState: tiri fatti, tiri di fila senza un raro e seme (0 finché
// non si tira la prima volta)
export function createProfile() {
  const heroes = {};
  for (const hero of Object.values(HEROES)) heroes[hero.id] = { owned: hero.starter, xp: 0, fragments: 0, stars: 1 };
  return {
    stats: { played: 0, won: 0, bestDistance: 0, last: null },
    resources: { materials: 0, dogTags: RECRUIT.startTags },
    heroes,
    lineup: startingLineup(),
    recruitState: { pulls: 0, sinceRare: 0, seed: 0 },
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
