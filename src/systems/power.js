import { ARMY, LANES, POWER, TEST_BATTLE } from '../config/balance.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { WEAPONS } from '../data/units.js';
import { BOSS, WAVES } from '../data/waves.js';
import { afterArmor } from './combat.js';
import { enemyHp, typeShares } from './spawn.js';
import { battlePlan } from './waves.js';

// Potenza: una formula unica per noi e per il livello, la radice di danno al secondo per vita (POWER.scale la porta a
// numeri comodi). Per noi: il danno al secondo delle armi e delle abilità degli eroi schierati e dei soldati di
// partenza (con quelli della caserma e le armi della fucina), per la vita degli eroi più un punto a soldato. Per il
// livello: un nemico che arriva toglie tanti soldati quanta vita gli resta, quindi il suo danno è la sua vita: il danno
// al secondo è la vita che le ondate portano in strada ogni secondo, in media, e la vita è quella di tutti i nemici
// delle ondate del suo tipo più tutti i boss dei suoi gruppi. Quella dei corazzati conta per quanto resistono al
// fucile, l'arma di riferimento. La potenza del livello è pesata da POWER.levelScale e dal powerScale del tipo; il
// rapporto tra la nostra e la sua dà la fascia di difficoltà (POWER.bands)

// Potenza di quello che si porta in battaglia (loadout, data/loadout.js): i soldati di partenza contano con il fucile,
// migliorato dalla fucina
export function armyPower(loadout = STARTING_LOADOUT) {
  const heroes = loadout.heroes.map(({ hero }) => hero);
  const soldiers = ARMY.startSize - 1 + loadout.soldiers;
  const { damage, fireRate } = loadout.weapons;
  // I soldati crescono con gli eroi attorno a loro: in media quanto loro
  const growth = heroes.reduce((sum, hero) => sum + (hero.growth ?? 1), 0) / heroes.length;
  const heroDps = heroes.reduce((sum, hero) => sum + weaponDps(hero.weapon) + abilityDps(hero), 0);
  const hp = heroes.reduce((sum, hero) => sum + hero.maxHp, 0) + soldiers;
  // La fucina conta su tutto (in battaglia combattono soprattutto i soldati presi ai cancelli, che qui non ci sono),
  // e la mira del lanciatore come POWER.autoAimScale
  const forge = Math.sqrt((1 + damage) * (1 + fireRate)) * (loadout.weapons.autoAim ? POWER.autoAimScale : 1);
  return power(heroDps + soldiers * weaponDps(WEAPONS.rifle) * growth, hp) * forge;
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

function power(dps, hp) {
  return Math.sqrt(dps * hp) * POWER.scale;
}

// Danno al secondo di un'arma: le granate prendono in media POWER.blastTargets nemici
function weaponDps(weapon) {
  const targets = weapon.kind === 'lob' ? POWER.blastTargets : 1;
  return weapon.damage * (weapon.pellets ?? 1) * targets * weapon.fireRate;
}

// Danno al secondo in più di un'abilità: onda d'urto e colpo perforante la loro quota della vita di un nemico di
// POWER.abilityHp a ogni ricarica, il fuoco rapido i colpi in più dell'eroe mentre dura; lo scudo para i colpi e non
// conta
function abilityDps({ ability, weapon }) {
  const { kind, cooldownSeconds } = ability;
  if (kind === 'shockwave' || kind === 'pierce') return (ability.share * POWER.abilityHp) / cooldownSeconds;
  if (kind !== 'rapidFire') return 0;
  return (weaponDps(weapon) * (ability.fireRateScale - 1) * ability.seconds) / cooldownSeconds;
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
