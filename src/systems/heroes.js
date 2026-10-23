import { ENEMY_SHOT } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { afterArmor } from './combat.js';

// Abilità degli eroi (data/heroes.js): ognuna si ricarica da sola e parte appena è pronta e serve a qualcosa.
// cooldowns: millisecondi che mancano alla ricarica di ogni eroe in campo; shieldMs: quanto dura ancora lo scudo.
// Eventi: ABILITY_USED con { hero, ability, x, z } (per gli effetti), SHIELD_RAISED con { ms }
export function createHeroes(bus, army) {
  const heroes = { cooldowns: new Map(), shieldMs: 0, bus };
  for (const hero of army.heroes) heroes.cooldowns.set(hero, secondsToMs(hero.ability.cooldownSeconds));
  bus.on(EVENTS.HERO_KILLED, (hero) => heroes.cooldowns.delete(hero));
  return heroes;
}

// enemyShots: i colpi nemici in volo, per sapere se lo scudo serve
export function updateHeroes(heroes, army, enemies, enemyShots, deltaMs) {
  heroes.shieldMs = Math.max(0, heroes.shieldMs - deltaMs);
  for (const hero of army.heroes) {
    const left = heroes.cooldowns.get(hero) - deltaMs;
    if (left > 0 || !useAbility(heroes, hero, army, enemies, enemyShots)) {
      heroes.cooldowns.set(hero, Math.max(0, left));
      continue;
    }
    heroes.cooldowns.set(hero, secondsToMs(hero.ability.cooldownSeconds));
  }
}

// Quanto manca alla ricarica, da 0 (pronta) a 1 (appena usata)
export function cooldownShare(heroes, hero) {
  return heroes.cooldowns.get(hero) / secondsToMs(hero.ability.cooldownSeconds);
}

// Usa l'abilità se c'è su cosa usarla; dice se l'ha usata. Lo scudo si alza reactSeconds prima che un colpo nemico
// arrivi sull'esercito, non appena parte: resta su per l'arrivo e per quello che segue. Un colpo già passato
// dietro tutta la folla non conta
function useAbility(heroes, hero, army, enemies, enemyShots) {
  const { ability } = hero;
  const { bus } = heroes;
  if (ability.kind === 'shockwave') {
    const near = enemies.filter((enemy) => inWave(hero, ability, enemy));
    if (near.length === 0) return false;
    hit(bus, near, ability.damage);
  } else if (ability.kind === 'pierce') {
    const column = enemies.filter((enemy) => inColumn(hero, ability, enemy));
    if (column.length === 0) return false;
    hit(bus, column, ability.damage);
  } else if (ability.kind === 'shield') {
    if (!enemyShots.some((shot) => isArriving(army, ability, shot))) return false;
    heroes.shieldMs = secondsToMs(ability.seconds);
    bus.emit(EVENTS.SHIELD_RAISED, { ms: heroes.shieldMs });
  }
  bus.emit(EVENTS.ABILITY_USED, { hero, ability, x: hero.x, z: hero.z });
  return true;
}

const inWave = (hero, ability, enemy) =>
  Math.hypot(enemy.x - hero.x, enemy.z - hero.z) < ability.radius + enemy.size / 2;

const inColumn = (hero, ability, enemy) =>
  Math.abs(enemy.x - hero.x) < (ability.width + enemy.size) / 2 && enemy.z > hero.z && enemy.z < hero.z + ability.range;

// Il colpo scende verso l'esercito, non l'ha ancora superato e arriva al suo bordo davanti entro reactSeconds
const isArriving = (army, ability, shot) =>
  shot.vz < 0 &&
  shot.z > army.back - ENEMY_SHOT.size / 2 &&
  (shot.z - army.front) / -shot.vz < ability.reactSeconds;

// Prima si raccolgono, poi si colpiscono: chi muore lascia la lista dei nemici
function hit(bus, targets, damage) {
  for (const enemy of targets) bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(damage, enemy.type.armor) });
}
