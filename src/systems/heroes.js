import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { POWERS } from './powers.js';

// Abilità degli eroi (data/heroes.js): ognuna si ricarica da sola e parte appena è pronta e serve a qualcosa; cosa
// fa e quando serve lo dice il suo potere (systems/powers.js). cooldowns: millisecondi che mancano alla ricarica di
// ogni eroe in campo; shieldMs: quanto dura ancora lo scudo. Eventi: ABILITY_USED con { hero, ability, x, z } (per gli
// effetti), più quelli dei poteri
export function createHeroes(bus, army) {
  const heroes = { cooldowns: new Map(), shieldMs: 0, bus };
  for (const hero of army.heroes) heroes.cooldowns.set(hero, secondsToMs(hero.ability.cooldownSeconds));
  bus.on(EVENTS.HERO_KILLED, (hero) => heroes.cooldowns.delete(hero));
  return heroes;
}

// enemyShots: i colpi nemici in volo, per sapere se lo scudo serve
export function updateHeroes(heroes, army, enemies, enemyShots, deltaMs) {
  heroes.shieldMs = Math.max(0, heroes.shieldMs - deltaMs);
  const battle = { heroes, army, enemies, enemyShots, bus: heroes.bus };
  for (const hero of army.heroes) {
    const left = heroes.cooldowns.get(hero) - deltaMs;
    if (left > 0 || !useAbility(battle, hero)) {
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

// Usa il potere dell'eroe se adesso serve; dice se l'ha usato
function useAbility(battle, hero) {
  const power = POWERS[hero.ability.kind];
  const targets = power.targets(battle, hero);
  if (targets === null) return false;
  power.use(battle, hero, targets);
  battle.bus.emit(EVENTS.ABILITY_USED, { hero, ability: hero.ability, x: hero.x, z: hero.z });
  return true;
}
