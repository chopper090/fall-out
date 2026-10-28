import { ENEMY_SHOT, HERO_POWERS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { damageMultiplier } from './army.js';
import { afterArmor } from './combat.js';

// La parte della quota che tocca a ogni tipo di nemico (1 per quelli che HERO_POWERS.targetShare non nomina)
const TARGET_SHARES = new Map(
  Object.entries(HERO_POWERS.targetShare).map(([name, share]) => [ENEMY_TYPES[name], share]),
);

// I poteri degli eroi, uno per tipo (ability.kind, data/heroes.js). Ognuno ha targets, che dice se adesso serve (e su
// cosa: i bersagli, o true se non ne ha; null se non serve), e use, che lo usa con quello che targets ha trovato. Lo
// stato della battaglia arriva in battle: heroes (lo stato delle abilità, systems/heroes.js), army, enemies,
// enemyShots (i colpi nemici in volo) e il bus degli eventi. Aggiungere un potere vuol dire aggiungere qui il suo tipo
export const POWERS = {
  // Onda d'urto: colpisce tutti i nemici entro radius dall'eroe, quando ce n'è almeno uno
  shockwave: {
    targets: ({ enemies }, hero) => some(enemies.filter((enemy) => inWave(hero, enemy))),
    use: (battle, hero, near) => hit(battle, near, hero),
  },
  // Colpo perforante: colpisce tutti i nemici nella colonna davanti all'eroe fino a range, quando c'è qualcuno
  pierce: {
    targets: ({ enemies }, hero) => some(enemies.filter((enemy) => inColumn(hero, enemy))),
    use: (battle, hero, column) => hit(battle, column, hero),
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

// La vita su cui un potere conta la sua quota: quella del boss, per lui; per gli altri quella che il loro tipo ha
// nell'ondata più dura della battaglia (heroes.powerHp per il suo hpScale), mai meno di quella di un normale: dentro
// una battaglia un potere colpisce ogni tipo sempre uguale (le pedine degli sciami come un normale, così un'onda le
// spazza), e lungo la strada cresce con i nemici
function lifeOf(heroes, enemy) {
  if (enemy.type === ENEMY_TYPES.boss) return enemy.maxHp;
  return heroes.powerHp * Math.max(1, enemy.type.hpScale);
}

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

// Ogni bersaglio perde la quota del potere dell'eroe (ability.share) della vita che conta (lifeOf), per la parte del
// suo tipo e il danno in più di scrigni e riserve, meno la corazza. Prima si raccolgono, poi si colpiscono: chi muore
// lascia la lista dei nemici
function hit({ heroes, army, bus }, targets, hero) {
  const scale = hero.ability.share * damageMultiplier(army);
  for (const enemy of targets) {
    const damage = lifeOf(heroes, enemy) * scale * (TARGET_SHARES.get(enemy.type) ?? 1);
    bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(damage, enemy.type.armor), hero });
  }
}
