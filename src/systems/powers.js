import { ENEMY_SHOT } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { afterArmor } from './combat.js';

// I poteri degli eroi, uno per tipo (ability.kind, data/heroes.js). Ognuno ha targets, che dice se adesso serve (e su
// cosa: i bersagli, o true se non ne ha; null se non serve), e use, che lo usa con quello che targets ha trovato. Lo
// stato della battaglia arriva in battle: heroes (lo stato delle abilità, systems/heroes.js), army, enemies,
// enemyShots (i colpi nemici in volo) e il bus degli eventi. Aggiungere un potere vuol dire aggiungere qui il suo tipo
export const POWERS = {
  // Onda d'urto: colpisce per damage tutti i nemici entro radius dall'eroe, quando ce n'è almeno uno
  shockwave: {
    targets: ({ enemies }, hero) => some(enemies.filter((enemy) => inWave(hero, enemy))),
    use: ({ bus }, hero, near) => hit(bus, near, hero.ability.damage, hero),
  },
  // Colpo perforante: colpisce per damage tutti i nemici nella colonna davanti all'eroe fino a range, quando c'è
  // qualcuno
  pierce: {
    targets: ({ enemies }, hero) => some(enemies.filter((enemy) => inColumn(hero, enemy))),
    use: ({ bus }, hero, column) => hit(bus, column, hero.ability.damage, hero),
  },
  // Scudo: ferma i colpi nemici per seconds; si alza reactSeconds prima che un colpo arrivi sull'esercito, non appena
  // parte, e resta su per l'arrivo e per quello che segue. Un colpo già passato dietro tutta la folla non conta; con
  // uno scudo già alzato (di un altro eroe) il secondo aspetta
  shield: {
    targets: ({ heroes, army, enemyShots }, hero) =>
      heroes.shieldMs === 0 && enemyShots.some((shot) => isArriving(army, hero.ability, shot)) ? true : null,
    use: ({ heroes, bus }, hero) => {
      heroes.shieldMs = secondsToMs(hero.ability.seconds);
      bus.emit(EVENTS.SHIELD_RAISED, { ms: heroes.shieldMs });
    },
  },
  // Fuoco rapido: per seconds chi spara entro radius dall'eroe spara fireRateScale volte più in fretta
  // (systems/combat.js); parte quando un nemico è davanti a lui, a tiro della sua arma ed entro radius di lato
  rapidFire: {
    targets: ({ enemies }, hero) => (enemies.some((enemy) => inFireReach(hero, enemy)) ? true : null),
    use: ({ bus }, hero) => bus.emit(EVENTS.RAPID_FIRE_STARTED, { hero, ms: secondsToMs(hero.ability.seconds) }),
  },
};

// I bersagli trovati, o null se non ce n'è nessuno
const some = (targets) => (targets.length > 0 ? targets : null);

const inWave = (hero, enemy) => Math.hypot(enemy.x - hero.x, enemy.z - hero.z) < hero.ability.radius + enemy.size / 2;

const inColumn = ({ x, z, ability }, enemy) =>
  Math.abs(enemy.x - x) < (ability.width + enemy.size) / 2 && enemy.z > z && enemy.z < z + ability.range;

// Il nemico è davanti all'eroe, dentro la gittata della sua arma, nelle colonne dei soldati entro radius da lui
const inFireReach = ({ x, z, ability, weapon }, enemy) =>
  Math.abs(enemy.x - x) < ability.radius + enemy.size / 2 && enemy.z > z && enemy.z - enemy.size / 2 < weapon.range;

// Il colpo scende verso l'esercito, non l'ha ancora superato e arriva al suo bordo davanti entro reactSeconds
const isArriving = (army, ability, shot) =>
  shot.vz < 0 && shot.z > army.back - ENEMY_SHOT.size / 2 && (shot.z - army.front) / -shot.vz < ability.reactSeconds;

// Prima si raccolgono, poi si colpiscono: chi muore lascia la lista dei nemici
function hit(bus, targets, damage, hero) {
  for (const enemy of targets) {
    bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(damage, enemy.type.armor), hero });
  }
}
