import { ARMY, LANES, POWER, TEST_BATTLE } from '../config/balance.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { CHEST_KINDS } from '../data/chests.js';
import { BASE_SOLDIER, ELITE, SOLDIER_TYPES, WEAPONS } from '../data/units.js';
import { BOSS, WAVES } from '../data/waves.js';
import { afterArmor } from './combat.js';
import { enemyHp, typeShares } from './spawn.js';
import { battlePlan } from './waves.js';

// Potenza: una formula unica per noi e per il livello, la radice di danno al secondo per vita (POWER.scale la porta a
// numeri comodi). Per noi: il danno al secondo delle armi degli eroi schierati e dei soldati di partenza (con quelli
// della caserma), per la vita degli eroi più un punto a soldato; poi quanto la alzano i poteri degli eroi, i tipi
// dell'esercito e i livelli delle armi della fucina, misurato con il bot (C32: POWER.abilities, soldierTypes, forge).
// Per il
// livello: un nemico che arriva toglie tanti soldati quanta vita gli resta, quindi il suo danno è la sua vita: il danno
// al secondo è la vita che le ondate portano in strada ogni secondo, in media, e la vita è quella di tutti i nemici
// delle ondate del suo tipo più tutti i boss dei suoi gruppi. Quella dei corazzati conta per quanto resistono al
// fucile, l'arma di riferimento. La potenza del livello è pesata da POWER.levelScale e dal powerScale del tipo; il
// rapporto tra la nostra e la sua dà la fascia di difficoltà (POWER.bands)

// Potenza di quello che si porta in battaglia (loadout, data/loadout.js): i soldati di partenza contano con il fucile,
// poi i poteri, i tipi dell'esercito e i livelli delle armi la alzano della loro parte
export function armyPower(loadout = STARTING_LOADOUT) {
  const heroes = loadout.heroes.map(({ hero }) => hero);
  const soldiers = ARMY.startSize - 1 + loadout.soldiers;
  // I soldati crescono con gli eroi attorno a loro: in media quanto loro
  const growth = heroes.reduce((sum, hero) => sum + (hero.growth ?? 1), 0) / heroes.length;
  const heroDps = heroes.reduce((sum, hero) => sum + weaponDps(hero.weapon), 0);
  const hp = heroes.reduce((sum, hero) => sum + hero.maxHp, 0) + soldiers;
  const ours = power(heroDps + soldiers * weaponDps(WEAPONS.rifle) * growth, hp);
  return ours * abilityFactor(heroes) * armyFactor(loadout.army) * forgeFactor(loadout.weapons.levels, loadout.army);
}

// Potenza del livello: le ondate e i boss del suo tipo, pesata dal powerScale del tipo; con le regole della battaglia
// (rules: una casella della strada, data/road.js, la sfida, data/village.js, o una sfida del giorno, data/daily.js) i
// nemici hanno più vita, arrivano più fitti e più spesso dei tipi speciali, e con la difficoltà di prova test più vita
// e più arrivi (systems/waves.js battlePlan)
export function levelPower(rules = null, test = TEST_BATTLE) {
  const plan = battlePlan(rules, test);
  const waves = WAVES.slice(0, plan.waves);
  const arrivals = (wave) => (wave.duration / wave.spawnInterval) * plan.countScale;
  const duration = waves.reduce((sum, wave) => sum + wave.duration, 0);
  const waveHp = waves.reduce((sum, wave) => sum + arrivals(wave) * arrivalHp(wave, plan.specialsScale), 0);
  const bossHp = plan.bosses.flat().reduce((sum, { hpScale }) => sum + BOSS.hp * hpScale, 0);
  const theirs = power((waveHp * plan.hpScale) / duration, (waveHp + bossHp) * plan.hpScale);
  return theirs * POWER.levelScale * plan.powerScale;
}

// Fascia di difficoltà per il rapporto tra la nostra potenza e quella del livello: la prima che il rapporto raggiunge
export function difficulty(ratio) {
  return POWER.bands.find((band) => ratio >= band.from) ?? POWER.bands[POWER.bands.length - 1];
}

// Parte di partite che una fascia promette di vincere: dalla sua soglia a quella della fascia subito più facile
export function bandWins(band) {
  const index = POWER.bands.indexOf(band);
  return [band.wins, index === 0 ? 1 : POWER.bands[index - 1].wins];
}

// Le armi che i soldati portano in battaglia: quelle dei tipi dell'esercito (army; senza, il fuciliere:
// systems/army.js) e quelle degli scrigni d'arma
function carried(army) {
  const types = Object.keys(SOLDIER_TYPES).filter(
    (type) => SOLDIER_TYPES[type].weapon !== ELITE.weapon && (army[type] ?? 0) > 0,
  );
  const weapons = (types.length > 0 ? types : [BASE_SOLDIER]).map((type) => SOLDIER_TYPES[type].weapon);
  const chests = Object.values(CHEST_KINDS).flatMap(({ weapon }) => (weapon === undefined ? [] : [weapon]));
  return new Set([...weapons, ...chests]);
}

function power(dps, hp) {
  return Math.sqrt(dps * hp) * POWER.scale;
}

// Danno al secondo di un'arma: le granate prendono in media POWER.blastTargets nemici
function weaponDps(weapon) {
  const targets = weapon.kind === 'lob' ? POWER.blastTargets : 1;
  return weapon.damage * (weapon.pellets ?? 1) * targets * weapon.fireRate;
}

// Quanto alzano la forza i poteri degli eroi: ognuno la parte misurata del suo tipo (POWER.abilities, con l'eroe
// comune al primo grado), per quanto è più forte di lui (abilityStrength)
function abilityFactor(heroes) {
  return heroes.reduce((factor, hero) => factor + POWER.abilities[hero.ability.kind] * abilityStrength(hero), 1);
}

// Quanto è più forte il potere dell'eroe di quello del suo eroe di base (data/heroes.js): la quota della vita che
// toglie (con rarità, livello, stelle e grado) per quanto spesso si ricarica (con il grado). Un potere che non si
// ricarica mai vale zero
function abilityStrength({ id, ability }) {
  const base = HEROES[id].ability;
  const share = ability.share === undefined ? 1 : ability.share / base.share;
  return (share * base.cooldownSeconds) / ability.cooldownSeconds;
}

// Quanto alza la forza l'esercito per tipo (army): ogni tipo la sua parte misurata POWER.soldierTypes (un fuciliere
// zero) per la sua quota dei soldati; senza esercito sono tutti fucilieri
function armyFactor(army) {
  const total = Object.values(army).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 1;
  return Object.entries(army).reduce((factor, [type, count]) => factor + (POWER.soldierTypes[type] * count) / total, 1);
}

// Quanto alzano la forza i livelli delle armi della fucina (levels, per arma; senza, nessuno): la parte misurata di
// ogni arma al suo livello (POWER.forge, con l'esercito di riferimento), solo per le armi che qualcuno porta (carried):
// insieme valgono meno della somma, e la più alta conta intera, le altre per POWER.forgeOthers
function forgeFactor(levels = {}, army = {}) {
  const used = carried(army);
  const gains = Object.entries(levels).map(([weapon, level]) =>
    level > 0 && used.has(weapon) ? POWER.forge[weapon][level - 1] : 0,
  );
  const best = Math.max(0, ...gains);
  const others = gains.reduce((sum, gain) => sum + gain, 0) - best;
  return 1 + best + others * POWER.forgeOthers;
}

// Vita media di un arrivo dell'ondata: uno sciame, oppure una fila o un nemico solo, normale o di un tipo speciale
// (con le quote di systems/spawn.js, e i tipi che arrivano più spesso per specialsScale)
function arrivalHp(wave, specialsScale) {
  const { enemyHp: baseHp, specials } = wave;
  const swarm = wave.swarm.count * toughness(baseHp, ENEMY_TYPES.swarm);
  const enemies = wave.rowChance * Math.min(wave.rowSize, LANES.count) + (1 - wave.rowChance);
  const shares = typeShares(specials, specialsScale);
  const enemy = shares.reduce((sum, [type, share]) => sum + share * toughness(baseHp, type), 0);
  return wave.swarmChance * swarm + (1 - wave.swarmChance) * enemies * enemy;
}

// Vita di un nemico del tipo type contro il fucile: l'armatura la allunga
function toughness(baseHp, type) {
  const { damage } = WEAPONS.rifle;
  return (enemyHp(baseHp, type) * damage) / afterArmor(damage, type.armor);
}
