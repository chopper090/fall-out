import { GROWTH, RECRUIT } from '../data/growth.js';
import { HEROES, RARITIES } from '../data/heroes.js';
import { DROPS, REWARDS } from '../data/rewards.js';
import { ROAD } from '../data/road.js';
import { VILLAGE } from '../data/village.js';
import { starCost, trainCost } from './heroes.js';
import { freeSlots, lockOf, siteOf, upgradeCost } from './village.js';

// Il Catalogo (scenes/Catalog.js): le voci di ogni scheda (CATALOG_TABS) con il loro stato, letto dai dati e dal
// profilo, mai scritto a mano. Stati: upgradable (suo e potenziabile adesso), owned (suo), obtainable (non ancora suo,
// ma lo si può avere adesso), locked (ancora fuori portata). I filtri (CATALOG_FILTERS) dicono quali stati mostra
// ognuno, nell'ordine in cui li mostra
export const CATALOG_TABS = ['buildings', 'heroes', 'resources'];
export const CATALOG_FILTERS = {
  all: ['upgradable', 'owned', 'obtainable', 'locked'],
  owned: ['upgradable', 'owned'],
  obtainable: ['obtainable'],
  upgradable: ['upgradable'],
};
// Le scorte del villaggio, nell'ordine di data/village.js, le piastrine e l'esperienza
const RESOURCE_KINDS = [...Object.keys(VILLAGE.start), 'dogTags', 'xp'];

// Le voci della scheda tab che hanno uno stato del filtro filter, nell'ordine dei dati
export function catalogEntries(profile, tab, filter = 'all') {
  const entries = { heroes: heroEntries, buildings: buildingEntries, resources: resourceEntries }[tab](profile);
  return entries.filter((entry) => CATALOG_FILTERS[filter].includes(entry.state));
}

// Ogni edificio: livello, se ha un cantiere aperto (site), il costo del prossimo livello (cost, null al massimo) con
// quanto ne manca per tipo (missing), cosa lo tiene fermo (lock, meta/village.js lockOf) e se c'è un posto cantiere
// libero (slot). Posseduto se costruito o in cantiere; potenziabile se in più si può salire adesso
function buildingEntries(profile) {
  const { levels } = profile.village;
  const slot = freeSlots(profile) > 0;
  return Object.keys(VILLAGE.buildings).map((id) => {
    const cost = upgradeCost(profile, id);
    const lock = lockOf(profile, id);
    const site = siteOf(profile, id) !== null;
    const missing = cost === null ? {} : missingOf(profile, cost.resources);
    const ready = cost !== null && !site && lock === null && Object.values(missing).every((amount) => amount === 0);
    let state = lock === null ? 'obtainable' : 'locked';
    if (levels[id] > 0 || site) state = ready && slot ? 'upgradable' : 'owned';
    return { id, kind: 'building', state, level: levels[id], site, cost, missing, lock, slot };
  });
}

// Ogni eroe: posseduto, con le stelle e i frammenti per la prossima (need null al massimo), potenziabile se li ha; non
// posseduto, ottenibile con il reclutamento (le piastrine che ha e quelle di un tiro) o, se il reclutamento non lo dà,
// con i suoi frammenti (bloccato finché non bastano)
function heroEntries(profile) {
  const { dogTags } = profile.resources;
  return Object.values(HEROES).map(({ id, rarity }) => {
    const record = profile.heroes[id];
    if (!record.owned && RARITIES[rarity].chance === 0) {
      const fragments = { have: record.fragments, need: RECRUIT.assemble };
      const state = fragments.have >= fragments.need ? 'obtainable' : 'locked';
      return { id, kind: 'hero', state, owned: false, fragments };
    }
    if (!record.owned) {
      return { id, kind: 'hero', state: 'obtainable', owned: false, tags: { have: dogTags, need: RECRUIT.cost } };
    }
    const need = starCost(record.stars);
    const state = need !== null && record.fragments >= need ? 'upgradable' : 'owned';
    return { id, kind: 'hero', state, owned: true, stars: record.stars, fragments: { have: record.fragments, need } };
  });
}

// Ogni scorta: quanta ce n'è, da dove arriva e a cosa serve. Posseduta se ce n'è, se no ottenibile
function resourceEntries(profile) {
  return RESOURCE_KINDS.map((id) => {
    const amount = profile.resources[id];
    const state = amount > 0 ? 'owned' : 'obtainable';
    return { id, kind: 'resource', state, amount, sources: sourcesOf(id), uses: usesOf(id) };
  });
}

// Quanto manca di ogni scorta di resources (un costo, per tipo) a quelle del profilo
function missingOf(profile, resources) {
  return Object.fromEntries(
    Object.entries(resources).map(([kind, amount]) => [kind, Math.max(0, amount - profile.resources[kind])]),
  );
}

// Da dove arriva la scorta kind, letto dai dati: i nemici che la lasciano (enemies: i loro tipi), la vittoria, le
// raccolte della strada, la conquista di un'area, la prima sconfitta su una casella; le razioni anche dalla fattoria e
// dal centro città, le gemme anche dalle missioni e dalle sfide del giorno
function sourcesOf(kind) {
  const sources = [];
  const enemies = Object.keys(DROPS).filter((type) => DROPS[type].some((drop) => drop.kind === kind));
  if (enemies.length > 0) sources.push({ id: 'enemies', enemies });
  if (REWARDS.victory[kind] > 0) sources.push({ id: 'victory' });
  if (ROAD.collect[kind] !== undefined) sources.push({ id: 'collect' });
  if (ROAD.conquest[kind] > 0) sources.push({ id: 'conquest' });
  if (REWARDS.consolation[kind] > 0) sources.push({ id: 'consolation' });
  if (kind === 'rations') sources.push({ id: 'farm' }, { id: 'center' });
  if (kind === 'gems') sources.push({ id: 'missions' }, { id: 'challenges' });
  return sources;
}

// A cosa serve la scorta kind: gli edifici che la chiedono in un loro livello, gli eroi se la chiede un loro livello
// (meta/heroes.js trainCost); le razioni per le battaglie della strada, le piastrine per il reclutamento, le gemme per
// i cantieri
function usesOf(kind) {
  const asked = (id) => VILLAGE.buildings[id].costs.some((cost) => cost[kind] > 0);
  const uses = Object.keys(VILLAGE.buildings)
    .filter(asked)
    .map((building) => ({ id: 'building', building }));
  const levels = Array.from({ length: GROWTH.maxLevel - 1 }, (_, index) => trainCost(index + 1));
  if (levels.some((cost) => cost[kind] > 0)) uses.push({ id: 'train' });
  if (kind === 'rations') uses.push({ id: 'battles' });
  if (kind === 'dogTags') uses.push({ id: 'recruit' });
  if (kind === 'gems') uses.push({ id: 'sites' });
  return uses;
}
