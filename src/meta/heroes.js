import { createRng } from '../core/rng.js';
import { HERO_POWERS } from '../config/balance.js';
import { GROWTH, RECRUIT } from '../data/growth.js';
import { HEROES, RARITIES } from '../data/heroes.js';

// Eroi del giocatore, dal profilo (meta/profile.js): livelli comprati con l'esperienza delle scorte, stelle e gradi
// del potere dai frammenti, i numeri con cui vanno in battaglia, lo schieramento e il reclutamento (numeri in
// data/growth.js)

// Cosa costa passare dal livello level al successivo: esperienza e materiali (legno o ingranaggi); null al livello
// massimo
export function trainCost(level) {
  if (level >= GROWTH.maxLevel) return null;
  const { switchAt, wood, gears } = GROWTH.levelMaterials;
  const xp = Math.round(GROWTH.xpBase * level ** GROWTH.xpGrowth);
  return level < switchAt ? { xp, wood: wood * level } : { xp, gears: gears * (level - switchAt + 1) };
}

// Il livello più alto che gli eroi possono avere con il centro città di adesso (GROWTH.levelCaps)
export function levelCap(profile) {
  const { levelCaps } = GROWTH;
  return levelCaps[Math.min(levelCaps.length, Math.max(1, profile.village.levels.center)) - 1];
}

// Perché l'eroe id non può salire di livello adesso: locked (non è tuo), max (livello massimo), cap (il centro città è
// troppo basso), short (mancano esperienza o materiali); null se può
export function trainBlock(profile, id) {
  const record = profile.heroes[id];
  const cost = trainCost(record.level);
  if (!record.owned) return 'locked';
  if (cost === null) return 'max';
  if (record.level >= levelCap(profile)) return 'cap';
  return Object.entries(cost).every(([kind, amount]) => profile.resources[kind] >= amount) ? null : 'short';
}

// Un livello in più all'eroe id, se può (trainBlock): paga esperienza e materiali. Dice se è salito
export function trainHero(profile, id) {
  if (trainBlock(profile, id) !== null) return false;
  const record = profile.heroes[id];
  for (const [kind, amount] of Object.entries(trainCost(record.level))) profile.resources[kind] -= amount;
  record.level += 1;
  return true;
}

// Frammenti che servono per la prossima stella, null alla stella massima
export function starCost(stars) {
  return stars >= GROWTH.maxStars ? null : GROWTH.starCosts[stars - 1];
}

// Frammenti che servono per il prossimo grado del potere, null al grado massimo
export function gradeCost(grade) {
  return grade >= GROWTH.maxGrade ? null : GROWTH.gradeCosts[grade - 1];
}

// Il primo passo che i frammenti dell'eroe (record) possono pagare, stella o grado: il costo più basso, null al massimo
// di tutti e due
export function cheapestStep(record) {
  const costs = [starCost(record.stars), gradeCost(record.grade)].filter((cost) => cost !== null);
  return costs.length === 0 ? null : Math.min(...costs);
}

// I numeri dell'eroe id in battaglia, con il livello, le stelle e il grado del potere di record (senza grado, il
// primo; gli eroi da HERO_POWERS.upgradeFrom in su con i numeri di ability.upgrade): vita e danno dell'arma crescono
// con livello e stelle e con la forza della sua rarità (growth: quanto, e con lui il danno dei soldati attorno); la
// quota della vita che toglie la sua abilità cresce con la stessa forza, e con quella del grado, elevate a
// HERO_POWERS.growthExponent; ogni grado la fa anche ricaricare prima. Un comune al livello 1 con una stella e il
// primo grado ha i numeri di data/heroes.js
export function heroData(id, { level, stars, grade = 1 }) {
  const base = HEROES[id];
  const grown = (1 + GROWTH.levelBonus * (level - 1)) * (1 + GROWTH.starBonus * (stars - 1));
  const scale = RARITIES[base.rarity].strength * grown;
  const steps = grade - 1;
  const cooldownSeconds = base.ability.cooldownSeconds * (1 - GROWTH.gradeCooldown) ** steps;
  const { upgrade = {}, ...numbers } = base.ability;
  const upgraded = rank(base.rarity) >= rank(HERO_POWERS.upgradeFrom);
  const ability = { ...numbers, ...(upgraded ? upgrade : {}), cooldownSeconds };
  if (base.ability.share !== undefined) {
    const potency = scale * (1 + GROWTH.gradeDamage) ** steps;
    ability.share = base.ability.share * potency ** HERO_POWERS.growthExponent;
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
  return pay(profile.heroes[id], 'stars', starCost);
}

// Un grado del potere in più, se l'eroe è posseduto e ha i frammenti che servono: li spende. Dice se è salito
export function gradeUp(profile, id) {
  return pay(profile.heroes[id], 'grade', gradeCost);
}

// Il passo key (stelle o grado) dell'eroe record sale di uno se è suo e ha i frammenti che costOf chiede
function pay(record, key, costOf) {
  const cost = costOf(record[key]);
  if (!record.owned || cost === null || record.fragments < cost) return false;
  record.fragments -= cost;
  record[key] += 1;
  return true;
}

// Un tiro del reclutamento, se ci sono le piastrine: la rarità con le chance di RARITIES, tra quelle che hanno eroi da
// reclutare, con le garanzie di RECRUIT.pity (guaranteed); l'eroe a caso tra quelli di quella rarità (il capo mai).
// Nuovo diventa tuo, già tuo dà i frammenti della sua rarità. Il seme sta nel profilo (il primo tiro lo prende da now)
// e ogni tiro usa il suo numero: lo stesso profilo pesca sempre uguale. Restituisce cosa è uscito, o null senza
// piastrine
export function recruit(profile, now) {
  const { resources, recruitState: state } = profile;
  if (resources.dogTags < RECRUIT.cost) return null;
  if (state.seed === 0) state.seed = now;
  const rng = createRng(state.seed + state.pulls);
  resources.dogTags -= RECRUIT.cost;
  state.pulls += 1;
  const drawn = Object.entries(RARITIES).filter(([name, { chance }]) => chance > 0 && recruitable(name).length > 0);
  const rarity = guaranteed(state, rng.pick(drawn.map(([name, { chance }]) => [name, chance])));
  for (const tier of Object.keys(RECRUIT.pity))
    state.since[tier] = rank(rarity) >= rank(tier) ? 0 : state.since[tier] + 1;
  const candidates = recruitable(rarity);
  const { id } = candidates[rng.int(candidates.length)];
  const record = profile.heroes[id];
  const isNew = !record.owned;
  const fragments = isNew ? 0 : RARITIES[rarity].duplicate;
  record.owned = true;
  record.fragments += fragments;
  return { id, rarity, isNew, fragments };
}

// Per ogni garanzia di RECRUIT.pity, i tiri che mancano ad avere almeno quella rarità
export function pullsTo(profile) {
  const { since } = profile.recruitState;
  return Object.fromEntries(Object.entries(RECRUIT.pity).map(([tier, every]) => [tier, every - since[tier]]));
}

// Un eroe che il reclutamento non dà (chance 0: i mitici) si ottiene con RECRUIT.assemble dei suoi frammenti. Dice se
// è diventato tuo
export function assembleHero(profile, id) {
  const record = profile.heroes[id];
  if (record.owned || RARITIES[HEROES[id].rarity].chance > 0 || record.fragments < RECRUIT.assemble) return false;
  record.fragments -= RECRUIT.assemble;
  record.owned = true;
  return true;
}

// amount frammenti all'eroe id. Restituisce chi li ha avuti e quanti ({ id, amount })
export function giveFragments(profile, id, amount) {
  profile.heroes[id].fragments += amount;
  return { id, amount };
}

// L'eroe che si ottiene solo con i frammenti (assembleHero) che tocca al numero index (l'area conquistata, il giorno
// della sfida): uno dopo l'altro nell'ordine dei dati, e da capo
export function assembledFor(index) {
  const heroes = Object.values(HEROES).filter((hero) => RARITIES[hero.rarity].chance === 0);
  return heroes[index % heroes.length].id;
}

// La rarità del tiro: quella pescata, o la garanzia più alta che scade a questo tiro (RECRUIT.pity: almeno quella
// rarità ogni tanti tiri) se è più alta di lei
function guaranteed(state, rarity) {
  const due = Object.entries(RECRUIT.pity)
    .filter(([tier, every]) => rank(rarity) < rank(tier) && state.since[tier] + 1 >= every)
    .map(([tier]) => tier);
  return due.reduce((best, tier) => (rank(tier) > rank(best) ? tier : best), rarity);
}

// La posizione della rarità in RARITIES, dalla più comune
function rank(rarity) {
  return Object.keys(RARITIES).indexOf(rarity);
}

// Gli eroi di una rarità che il reclutamento può dare (il capo mai)
function recruitable(rarity) {
  return Object.values(HEROES).filter((hero) => !hero.leader && hero.rarity === rarity);
}
