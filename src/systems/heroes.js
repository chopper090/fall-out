import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { POWERS } from './powers.js';

// Abilità degli eroi (data/heroes.js): ognuna si ricarica da sola e parte appena è pronta e serve a qualcosa; cosa
// fa e quando serve lo dice il suo potere (systems/powers.js). cooldowns: millisecondi che mancano alla ricarica di
// ogni eroe in campo; shieldMs: quanto dura ancora lo scudo; powerHp: la vita su cui i poteri contano la loro quota
// (quella di un nemico normale dell'ondata più dura della battaglia, systems/battle.js); peakSize: l'esercito più
// grande da quando il Soccorso è partito l'ultima volta (dice quanti soldati si sono persi contro i nemici: una porta
// che ne toglie lo abbassa con sé); gateLost: i soldati tolti dalle porte negative nello stesso tempo (il Soccorso ne
// conta una parte). Eventi: ABILITY_USED con
// { hero, ability, x, z } (per gli effetti), più quelli dei poteri
export function createHeroes(bus, army, powerHp) {
  const heroes = { cooldowns: new Map(), shieldMs: 0, powerHp, peakSize: army.size, gateLost: 0, bus };
  for (const hero of army.heroes) heroes.cooldowns.set(hero, secondsToMs(hero.ability.cooldownSeconds));
  bus.on(EVENTS.HERO_KILLED, (hero) => heroes.cooldowns.delete(hero));
  // L'esercito ha già passato la porta (è nato prima, army.gateLoss): quello che toglie va in gateLost, non tra i persi
  // contro i nemici; il picco conta anche chi è arrivato nello stesso frame, prima della porta
  bus.on(EVENTS.GATE_PASSED, () => {
    const removed = army.gateLoss;
    if (removed === 0) return;
    heroes.peakSize = Math.max(heroes.peakSize, army.size + removed) - removed;
    heroes.gateLost += removed;
  });
  return heroes;
}

// world: quello che i poteri guardano oltre all'esercito: i nemici (enemies), i colpi nemici in volo (enemyShots), i
// cancelli (gates) e i boss (bosses)
export function updateHeroes(heroes, army, world, deltaMs) {
  heroes.shieldMs = Math.max(0, heroes.shieldMs - deltaMs);
  heroes.peakSize = Math.max(heroes.peakSize, army.size);
  const battle = { heroes, army, ...world, bus: heroes.bus };
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
