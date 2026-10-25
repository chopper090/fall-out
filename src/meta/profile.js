import { HEROES } from '../data/heroes.js';

// Profilo del giocatore: quello che il salvataggio porta da una sessione all'altra.
// stats: le statistiche delle battaglie finite (quelle lasciate a metà non contano): giocate e vinte, la distanza più
// lunga (bestDistance, in unità del mondo) e l'ultima battaglia (last: vinta o no, distanza, ondata raggiunta e se
// era già al boss). resources: i materiali raccolti. heroes: per ogni eroe (con l'id di data/heroes.js) esperienza e
// frammenti avuti; un eroe entra quando ne riceve la prima volta
export function createProfile() {
  return {
    stats: { played: 0, won: 0, bestDistance: 0, last: null },
    resources: { materials: 0 },
    heroes: {},
  };
}

// Profilo dai dati salvati: ogni campo che manca o non va bene prende il valore di partenza, quelli sconosciuti (eroi
// compresi) restano fuori
export function profileFrom(data) {
  const profile = createProfile();
  const stats = data?.stats;
  if (stats !== undefined && stats !== null) {
    profile.stats.played = count(stats.played);
    profile.stats.won = Math.min(count(stats.won), profile.stats.played);
    profile.stats.bestDistance = count(stats.bestDistance);
    profile.stats.last = battleFrom(stats.last);
  }
  profile.resources.materials = count(data?.resources?.materials);
  for (const id of Object.keys(HEROES)) {
    const saved = data?.heroes?.[id];
    if (saved === null || typeof saved !== 'object') continue;
    profile.heroes[id] = { xp: count(saved.xp), fragments: count(saved.fragments) };
  }
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

// La voce dell'eroe id nel profilo, creata la prima volta che serve
export function heroRecord(profile, id) {
  profile.heroes[id] ??= { xp: 0, fragments: 0 };
  return profile.heroes[id];
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
