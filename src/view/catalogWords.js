import { HUD } from '../config/balance.js';
import { HEROES, RARITIES } from '../data/heroes.js';
import { VILLAGE } from '../data/village.js';
import { amountText, starText } from './words.js';
import { effectText } from './worldWords.js';

// Le scritte delle voci del Catalogo (meta/catalog.js catalogEntries), senza Phaser, con le parole di HUD.catalog:
// il titolo, le righe sotto e i requisiti, ognuno con ok (già c'è) o no

// Il titolo della voce: "Fattoria · liv. 2", "Cecchino", "Legno: 216"
export function entryTitle(entry) {
  const { labels, resourceNames } = HUD.catalog;
  if (entry.kind === 'hero') return HEROES[entry.id].name;
  if (entry.kind === 'resource') return `${resourceNames[entry.id]}: ${entry.amount}`;
  const { name } = VILLAGE.buildings[entry.id];
  return entry.level > 0 ? `${name} · ${labels.level} ${entry.level}` : name;
}

// Le righe sotto il titolo. Edificio: cosa dà ora e al prossimo livello. Eroe: livello e stelle, o la rarità e come
// si recluta. Scorta: da dove arriva e a cosa serve
export function entryLines(entry, profile) {
  if (entry.kind === 'hero') return heroLines(entry, profile);
  if (entry.kind === 'resource') return resourceLines(entry);
  const { labels } = HUD.catalog;
  const { id, level, site, cost } = entry;
  const now = level > 0 ? effectText(id, level) : site ? labels.inProgress : labels.toBuild;
  const next = cost === null ? labels.max : `${labels.levelLong} ${level + 1}: ${effectText(id, level + 1)}`;
  return [`${labels.now}: ${now}`, next];
}

// I requisiti per il prossimo passo, ognuno { text, ok }. Edificio: gli edifici che chiede il centro città, o il
// centro al livello che serve (da 2 in su), le scorte del costo (con quelle che si hanno, se non bastano) e un posto
// cantiere libero se non c'è. Eroe: i frammenti per la prossima stella, o le piastrine di un tiro. Scorta: nessuno
export function entryNeeds(entry, profile) {
  if (entry.kind === 'resource') return [];
  if (entry.kind === 'hero') return heroNeeds(entry);
  const { labels } = HUD.catalog;
  const { id, level, cost, missing, site, slot } = entry;
  if (cost === null) return [];
  const { levels } = profile.village;
  const building = VILLAGE.buildings[id];
  const next = level + 1;
  const center = Math.max(next, building.centerLevel ?? 0);
  const required = id === 'center' ? building.requires[next - 1] : { center };
  const shown = Object.entries(required).filter(([other, need]) => other !== 'center' || need > 1);
  const needs = shown.map(([other, need]) => ({
    text: `${VILLAGE.buildings[other].name} ${labels.level} ${need}`,
    ok: levels[other] >= need,
  }));
  for (const [kind, amount] of Object.entries(cost.resources)) {
    const have = profile.resources[kind];
    const text = amountText(kind, amount);
    needs.push({ text: missing[kind] > 0 ? `${text} (${labels.have} ${have})` : text, ok: missing[kind] === 0 });
  }
  if (!slot && !site) needs.push({ text: labels.slot, ok: false });
  return needs;
}

// Eroe posseduto: livello e stelle; da trovare: rarità e come si ottiene (reclutamento o frammenti)
function heroLines(entry, profile) {
  const { labels } = HUD.catalog;
  const hero = HEROES[entry.id];
  const rarity = RARITIES[hero.rarity].label;
  if (!entry.owned) return [`${rarity} · ${hero.role}`, entry.tags ? labels.recruit : labels.assemble];
  const { level } = profile.heroes[entry.id];
  return [`${rarity} · ${hero.role}`, `${labels.levelLong} ${level} · ${starText(entry.stars)}`];
}

function heroNeeds({ owned, fragments, tags }) {
  const { labels } = HUD.catalog;
  if (tags) return [{ text: `${tags.need} ${labels.dogTags}`, ok: tags.have >= tags.need }];
  if (owned && fragments.need === null) return [{ text: labels.maxStars, ok: true }];
  return [{ text: `${fragments.have}/${fragments.need} ${labels.fragments}`, ok: fragments.have >= fragments.need }];
}

// "Da: nemici (normali, veloci, sciami), vittorie, raccolte"; "Serve per: Fattoria, Caserma"
function resourceLines({ sources, uses }) {
  const { labels, sources: words, enemies, uses: useWords } = HUD.catalog;
  const from = sources.map((source) => {
    if (source.id !== 'enemies') return words[source.id];
    return `${words.enemies} (${source.enemies.map((type) => enemies[type]).join(', ')})`;
  });
  const to = uses.map((use) => (use.id === 'building' ? VILLAGE.buildings[use.building].name : useWords[use.id]));
  return [`${labels.from}: ${from.join(', ')}`, `${labels.usedFor}: ${to.join(', ')}`];
}
