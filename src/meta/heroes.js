import { createRng } from '../core/rng.js';
import { GROWTH, RECRUIT } from '../data/growth.js';
import { HEROES, RARITIES } from '../data/heroes.js';

// Eroi del giocatore, dal profilo (meta/profile.js): livello dall'esperienza, stelle dai frammenti, i numeri con cui
// vanno in battaglia, lo schieramento e il reclutamento (numeri in data/growth.js)

// Livello raggiunto con xp punti, i punti già fatti dentro il livello e quanti ne servono per il prossimo (0 e 0 al
// livello massimo)
export function levelOf(xp) {
  let level = 1;
  let left = xp;
  while (level < GROWTH.maxLevel && left >= xpForLevel(level)) {
    left -= xpForLevel(level);
    level += 1;
  }
  if (level === GROWTH.maxLevel) return { level, xp: 0, next: 0 };
  return { level, xp: left, next: xpForLevel(level) };
}

// L'esperienza che porta dal livello 1 all'inizio del livello level
export function levelXp(level) {
  let xp = 0;
  for (let from = 1; from < level; from++) xp += xpForLevel(from);
  return xp;
}

// Frammenti che servono per la prossima stella, null alla stella massima
export function starCost(stars) {
  return stars >= GROWTH.maxStars ? null : GROWTH.starCosts[stars - 1];
}

// I numeri dell'eroe id in battaglia, con il livello e le stelle di record: vita e danno (arma e abilità) crescono
// con entrambi e con la forza della sua rarità (growth: quanto, e con lui il danno dei soldati attorno); alle stelle
// di GROWTH.abilityStars l'abilità colpisce più forte e si ricarica prima. Un comune al livello 1 con una stella ha
// i numeri di data/heroes.js
export function heroData(id, record) {
  const base = HEROES[id];
  const { level } = levelOf(record.xp);
  const grown = (1 + GROWTH.levelBonus * (level - 1)) * (1 + GROWTH.starBonus * (record.stars - 1));
  const scale = RARITIES[base.rarity].strength * grown;
  const boosts = GROWTH.abilityStars.filter((stars) => record.stars >= stars).length;
  const cooldownSeconds = base.ability.cooldownSeconds * (1 - GROWTH.abilityCooldown) ** boosts;
  const ability = { ...base.ability, cooldownSeconds };
  if (base.ability.damage !== undefined) {
    ability.damage = base.ability.damage * scale * (1 + GROWTH.abilityDamage) ** boosts;
  }
  const weapon = { ...base.weapon, damage: base.weapon.damage * scale };
  return { ...base, growth: scale, maxHp: base.maxHp * scale, weapon, ability };
}

// Gli eroi dello schieramento del profilo per la battaglia (meta/loadout.js): chi c'è in ogni posto, con i suoi numeri
export function lineupHeroes(profile) {
  return profile.lineup.flatMap((id, slot) => (id === null ? [] : [{ hero: heroData(id, profile.heroes[id]), slot }]));
}

// Mette l'eroe id (posseduto) nel posto slot, non quello del capo (lo 0): se era in un altro posto i due si
// scambiano; id null svuota il posto
export function placeHero(profile, slot, id) {
  const { lineup } = profile;
  if (slot === 0 || (id !== null && !profile.heroes[id].owned)) return;
  const from = id === null ? -1 : lineup.indexOf(id);
  if (from > 0) lineup[from] = lineup[slot];
  lineup[slot] = id;
}

// Una stella in più, se l'eroe è posseduto e ha i frammenti che servono: li spende. Dice se è salito
export function starUp(profile, id) {
  const record = profile.heroes[id];
  const cost = starCost(record.stars);
  if (!record.owned || cost === null || record.fragments < cost) return false;
  record.fragments -= cost;
  record.stars += 1;
  return true;
}

// Un tiro del reclutamento, se ci sono le piastrine: la rarità con le chance di RARITIES, tra quelle che hanno eroi da
// reclutare, ma almeno rara al tiro RECRUIT.pity da quando non ne esce una; l'eroe a caso tra quelli di quella rarità
// (il capo mai). Nuovo diventa tuo, già tuo dà i frammenti della sua rarità. Il seme sta nel profilo (il primo tiro lo
// prende da now) e ogni tiro usa il suo numero: lo stesso profilo pesca sempre uguale. Restituisce cosa è uscito, o
// null senza piastrine
export function recruit(profile, now) {
  const { resources, recruitState: state } = profile;
  if (resources.dogTags < RECRUIT.cost) return null;
  if (state.seed === 0) state.seed = now;
  const rng = createRng(state.seed + state.pulls);
  resources.dogTags -= RECRUIT.cost;
  state.pulls += 1;
  const drawn = Object.entries(RARITIES).filter(([name, { chance }]) => chance > 0 && recruitable(name).length > 0);
  let rarity = rng.pick(drawn.map(([name, { chance }]) => [name, chance]));
  if (rarity === 'common' && state.sinceRare + 1 >= RECRUIT.pity) rarity = 'rare';
  state.sinceRare = rarity === 'common' ? state.sinceRare + 1 : 0;
  const candidates = recruitable(rarity);
  const { id } = candidates[rng.int(candidates.length)];
  const record = profile.heroes[id];
  const isNew = !record.owned;
  const fragments = isNew ? 0 : RARITIES[rarity].duplicate;
  record.owned = true;
  record.fragments += fragments;
  return { id, rarity, isNew, fragments };
}

// Tiri che mancano al raro garantito
export function pullsToRare(profile) {
  return RECRUIT.pity - profile.recruitState.sinceRare;
}

// Gli eroi di una rarità che il reclutamento può dare (il capo mai)
function recruitable(rarity) {
  return Object.values(HEROES).filter((hero) => !hero.leader && hero.rarity === rarity);
}

function xpForLevel(level) {
  return Math.round(GROWTH.xpBase * level ** GROWTH.xpGrowth);
}
