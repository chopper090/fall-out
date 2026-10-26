import { GROWTH } from '../data/growth.js';
import { WORLD } from '../data/world.js';
import { levelXp } from '../meta/heroes.js';
import { ROAD_TILES, isBattle } from '../meta/road.js';
import { settle } from '../meta/village.js';

// Trucchi di prova sul profilo del giocatore (meta/profile.js), per il pannello di sviluppo (debug/metaPanel.js):
// cambiano il profilo e basta, senza grafica e senza salvare (lo fa chi li chiama). now: l'ora del gioco, in
// millisecondi. I numeri fuori dai limiti si tengono dentro

// amount in più di ogni risorsa (in meno con un numero negativo, fino a zero)
export function addResources(profile, amount) {
  const { resources } = profile;
  for (const kind of Object.keys(resources)) resources[kind] = Math.max(0, resources[kind] + amount);
}

// Il cantiere aperto finisce adesso, come se fosse arrivata la sua ora. Dice se ce n'era uno
export function finishBuild(profile, now) {
  settle(profile, now);
  const job = profile.village.construction;
  if (job === null) return false;
  job.endsAt = now;
  settle(profile, now);
  return true;
}

// Passano ms millisecondi per il villaggio, come ad app chiusa: il cantiere aperto e la fattoria tornano indietro di
// tanto con i loro tempi. L'orologio del gioco (core/clock.js) no: il suo scarto non si salva, e ricaricando la pagina
// la fattoria starebbe ferma per tutto il tempo saltato
export function skipTime(profile, ms, now) {
  settle(profile, now);
  const { village } = profile;
  if (village.construction !== null) village.construction.endsAt -= ms;
  village.farm.since -= ms;
  settle(profile, now);
}

// Il cammino sulla casella index della strada, fatta se non si combatte (una battaglia resta da vincere). Restituisce
// la casella
export function jumpToTile(profile, index) {
  const tile = ROAD_TILES[within(index, 0, ROAD_TILES.length - 1)];
  profile.road = { at: tile.index, done: !isBattle(tile) };
  return tile;
}

// Le prime count aree conquistate e nessun'altra: il cammino sull'ultima casella dell'ultima, il boss battuto (con 0
// la porta), pronto per la prossima. Le aree conquistate così non danno il loro premio
export function jumpToArea(profile, count) {
  const areas = within(count, 0, WORLD.road.length);
  const last = ROAD_TILES.findLast((tile) => tile.area === areas - 1);
  profile.road = { at: last.index, done: true };
}

// Tutti gli eroi diventano del giocatore
export function unlockHeroes(profile) {
  for (const record of Object.values(profile.heroes)) record.owned = true;
}

// L'eroe id all'inizio del livello level
export function setHeroLevel(profile, id, level) {
  profile.heroes[id].xp = levelXp(within(level, 1, GROWTH.maxLevel));
}

// L'eroe id con stars stelle
export function setHeroStars(profile, id, stars) {
  profile.heroes[id].stars = within(stars, 1, GROWTH.maxStars);
}

// Il numero intero più vicino a value tra min e max
function within(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
