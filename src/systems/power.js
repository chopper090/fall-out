import { ARMY, LANES, POWER } from '../config/balance.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { WEAPONS } from '../data/units.js';
import { BOSS, WAVES } from '../data/waves.js';
import { afterArmor } from './combat.js';
import { enemyHp } from './spawn.js';

// Potenza: una formula unica per noi e per il livello, la radice di danno al secondo per vita (POWER.scale la porta a
// numeri comodi). Per noi: il danno al secondo delle armi e delle abilità degli eroi schierati e dei soldati di
// partenza (con quelli della caserma e le armi della fucina), per la vita degli eroi più un punto a soldato. Per il
// livello: un nemico che arriva toglie tanti soldati quanta vita gli resta, quindi il suo danno è la sua vita: il danno
// al secondo è la vita che le ondate portano in strada ogni secondo, in media, e la vita è quella di tutti i nemici
// delle ondate più il boss. Quella dei corazzati conta per quanto resistono al fucile, l'arma di riferimento. La
// potenza del livello è pesata da POWER.levelScale; il rapporto tra la nostra e la sua dà la fascia di difficoltà
// (POWER.bands)

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

// Potenza del livello: ondate e boss; con le regole della battaglia (rules: una casella della strada, data/road.js, o
// la sfida, data/village.js) i nemici hanno più vita
export function levelPower(rules = null) {
  const hpScale = rules?.enemyHpScale ?? 1;
  const duration = WAVES.reduce((sum, wave) => sum + wave.duration, 0);
  const waveHp = WAVES.reduce((sum, wave) => sum + (wave.duration / wave.spawnInterval) * arrivalHp(wave), 0);
  return power((waveHp * hpScale) / duration, (waveHp + BOSS.hp) * hpScale) * POWER.levelScale;
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

// Danno al secondo in più di un'abilità: onda d'urto e colpo perforante il loro danno a ogni ricarica, il fuoco rapido
// i colpi in più dell'eroe mentre dura; lo scudo para i colpi e non conta
function abilityDps({ ability, weapon }) {
  const { kind, cooldownSeconds } = ability;
  if (kind === 'shockwave' || kind === 'pierce') return ability.damage / cooldownSeconds;
  if (kind !== 'rapidFire') return 0;
  return (weaponDps(weapon) * (ability.fireRateScale - 1) * ability.seconds) / cooldownSeconds;
}

// Vita media di un arrivo dell'ondata: uno sciame, oppure una fila o un nemico solo, normale o di un tipo speciale
// (come in systems/spawn.js, ogni tipo speciale prende al massimo la parte che resta)
function arrivalHp(wave) {
  const { enemyHp: baseHp, specials } = wave;
  const swarm = wave.swarm.count * toughness(baseHp, ENEMY_TYPES.swarm);
  const enemies = wave.rowChance * Math.min(wave.rowSize, LANES.count) + (1 - wave.rowChance);
  let special = 0;
  let normalShare = 1;
  for (const [name, chance] of Object.entries(specials)) {
    const share = Math.min(chance, normalShare);
    special += share * toughness(baseHp, ENEMY_TYPES[name]);
    normalShare -= share;
  }
  const enemy = special + normalShare * toughness(baseHp, ENEMY_TYPES.grunt);
  return wave.swarmChance * swarm + (1 - wave.swarmChance) * enemies * enemy;
}

// Vita di un nemico del tipo type contro il fucile: l'armatura la allunga
function toughness(baseHp, type) {
  const { damage } = WEAPONS.rifle;
  return (enemyHp(baseHp, type) * damage) / afterArmor(damage, type.armor);
}
