import { ENEMY_SHOT, GATES, HERO_POWERS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { damageMultiplier } from './army.js';
import { BOSS_PHASES } from './boss.js';
import { afterArmor } from './combat.js';
import { markedDamage } from './spawn.js';
import { stopsShots } from './gates.js';

// La parte della quota che tocca a ogni tipo di nemico (1 per quelli che HERO_POWERS.targetShare non nomina)
const TARGET_SHARES = new Map(
  Object.entries(HERO_POWERS.targetShare).map(([name, share]) => [ENEMY_TYPES[name], share]),
);

// I poteri degli eroi, uno per tipo (ability.kind, data/heroes.js, che dice anche cosa fanno). Ognuno ha targets, che
// dice se adesso serve (e su cosa: i bersagli, o true se non ne ha; null se non serve), e use, che lo usa con quello
// che targets ha trovato. Partono appena servono: aspettare un bersaglio migliore non aiuta (registro, C9). Lo stato
// della battaglia arriva in battle: heroes (lo stato delle abilità, systems/heroes.js), army, enemies, enemyShots (i
// colpi nemici in volo), gates, bosses e il bus degli eventi. Aggiungere un potere vuol dire aggiungere qui il suo tipo
export const POWERS = {
  rally: {
    targets: ({ enemies }, hero) => (enemies.some((enemy) => inReach(hero, enemy)) ? true : null),
    use: ({ bus }, hero) => {
      const { seconds, damageBonus = 0, fireRateBonus = 0 } = hero.ability;
      bus.emit(EVENTS.RALLY_STARTED, { hero, ms: secondsToMs(seconds), damageBonus, fireRateBonus });
    },
  },
  rapidFire: {
    targets: ({ enemies }, hero) => (enemies.some((enemy) => inFireReach(hero, enemy)) ? true : null),
    use: ({ bus }, hero) => bus.emit(EVENTS.RAPID_FIRE_STARTED, { hero, ms: secondsToMs(hero.ability.seconds) }),
  },
  shield: {
    targets: ({ heroes, army, enemyShots, bosses }, hero) => {
      if (heroes.shieldMs > 0) return null;
      const shot = enemyShots.some((enemyShot) => isArriving(army, hero.ability, enemyShot));
      return shot || bosses.some((boss) => smashComing(boss, army)) ? true : null;
    },
    use: ({ heroes, bus }, hero) => {
      heroes.shieldMs = secondsToMs(hero.ability.seconds);
      bus.emit(EVENTS.SHIELD_RAISED, { ms: heroes.shieldMs, smashCut: hero.ability.smashCut });
    },
  },
  shockwave: {
    targets: ({ enemies }, hero) => some(enemies.filter((enemy) => inWave(hero, enemy))),
    use: (battle, hero, near) => {
      const { pushSpeed, stunSeconds } = hero.ability;
      hit(battle, near, hero);
      const enemies = near.filter(alive);
      battle.bus.emit(EVENTS.ENEMIES_STUNNED, { enemies, ms: secondsToMs(stunSeconds), push: pushSpeed });
    },
  },
  pierce: {
    targets: ({ enemies }, hero) => some(enemies.filter((enemy) => inColumn(hero, enemy))),
    use: (battle, hero, column) => {
      hit(battle, column, hero);
      for (const gate of battle.gates.filter((target) => gateInColumn(hero, target))) {
        for (let n = 0; n < hero.ability.gateHits; n++) battle.bus.emit(EVENTS.GATE_HIT, { gate });
      }
    },
  },
  bombard: {
    targets: ({ enemies, bosses }, hero) => {
      const { range } = hero.ability;
      const boss = bosses.find(({ enemy }) => inRange(hero, enemy, range));
      return boss
        ? [boss.enemy]
        : some(
            densest(
              enemies.filter((enemy) => inRange(hero, enemy, range)),
              hero,
            ),
          );
    },
    use: (battle, hero, [center]) => {
      const { radius } = hero.ability;
      const { x, z } = center;
      const struck = battle.enemies.filter((enemy) => Math.hypot(enemy.x - x, enemy.z - z) < radius + enemy.size / 2);
      battle.bus.emit(EVENTS.BLAST, { x, z, radius });
      hit(battle, struck, hero);
    },
  },
  rescue: {
    targets: ({ heroes, army }, hero) => {
      const { belowShare, minLost } = hero.ability;
      const hurt = army.heroes.some((member) => member.hp < member.maxHp * belowShare);
      return hurt || heroes.peakSize - army.size >= minLost ? true : null;
    },
    use: ({ heroes, army, bus }, hero) => {
      const { healShare, soldiers } = hero.ability;
      bus.emit(EVENTS.HEROES_HEALED, { share: healShare });
      const lost = heroes.peakSize - army.size;
      if (lost > 0) bus.emit(EVENTS.SOLDIERS_REVIVED, { count: Math.min(soldiers, lost) });
      heroes.peakSize = army.size;
    },
  },
  mark: {
    targets: ({ enemies }, hero) => {
      const { range, marks } = hero.ability;
      return some(toughest(enemies.filter((enemy) => inRange(hero, enemy, range))).slice(0, marks));
    },
    use: (battle, hero, marked) => {
      const { seconds, markBonus } = hero.ability;
      hit(battle, marked, hero);
      for (const enemy of marked.filter(alive)) {
        battle.bus.emit(EVENTS.ENEMY_MARKED, { enemy, ms: secondsToMs(seconds), markBonus });
      }
    },
  },
};
// Furia: un fuoco rapido (systems/combat.js guarda pierceArmor e damageBonus del suo eroe)
POWERS.fury = POWERS.rapidFire;

// I bersagli trovati, o null se non ce n'è nessuno
const some = (targets) => (targets.length > 0 ? targets : null);

// Ancora vivo dopo il colpo del potere: lo stordimento e il marchio vanno solo a loro
const alive = (enemy) => enemy.hp > 0;

// Il nemico è davanti all'eroe ed entro range
const inRange = (hero, enemy, range) => enemy.z > hero.z && enemy.z - enemy.size / 2 < hero.z + range;

const inWave = (hero, enemy) => Math.hypot(enemy.x - hero.x, enemy.z - hero.z) < hero.ability.radius + enemy.size / 2;

const inColumn = ({ x, z, ability }, enemy) =>
  Math.abs(enemy.x - x) < (ability.width + enemy.size) / 2 && enemy.z > z && enemy.z < z + ability.range;

// Una porta che ferma ancora i colpi, nella colonna davanti all'eroe
const gateInColumn = ({ x, z, ability }, gate) =>
  stopsShots(gate) &&
  Math.abs(gate.x - x) < (ability.width + GATES.width) / 2 &&
  gate.z > z &&
  gate.z < z + ability.range;

// Il nemico è davanti all'eroe e dentro la gittata della sua arma (che, come quella dei colpi, si conta dal fondo)
const inReach = ({ z, weapon }, enemy) => enemy.z > z && enemy.z - enemy.size / 2 < weapon.range;

// Il nemico è a tiro (inReach) nelle colonne dei soldati entro radius dall'eroe
const inFireReach = (hero, enemy) =>
  Math.abs(enemy.x - hero.x) < hero.ability.radius + enemy.size / 2 && inReach(hero, enemy);

// Il colpo scende verso l'esercito, non l'ha ancora superato e arriva al suo bordo davanti entro reactSeconds
const isArriving = (army, ability, shot) =>
  shot.vz < 0 && shot.z > army.back - ENEMY_SHOT.size / 2 && (shot.z - army.front) / -shot.vz < ability.reactSeconds;

// Il boss sta per schiacciare (l'avviso è partito) una zona dove c'è qualcuno dell'esercito
function smashComing({ phase, zone }, army) {
  if (phase !== BOSS_PHASES.warn) return false;
  const inside = (member) => Math.hypot(member.x - zone.x, member.z - zone.z) < zone.radius;
  return army.heroes.some(inside) || army.soldiers.some(inside);
}

// Il nemico con più nemici attorno a sé (entro il raggio del potere dell'eroe): lui solo, o nessuno
function densest(enemies, hero) {
  const { radius } = hero.ability;
  let best = null;
  let most = 0;
  for (const enemy of enemies) {
    const near = enemies.filter((other) => Math.hypot(other.x - enemy.x, other.z - enemy.z) < radius).length;
    if (near > most) {
      most = near;
      best = enemy;
    }
  }
  return best === null ? [] : [best];
}

// I nemici dal più duro: prima i boss, poi le élite, poi chi ha più vita
function toughest(enemies) {
  const order = (enemy) => (enemy.type === ENEMY_TYPES.boss ? 2 : enemy.type === ENEMY_TYPES.elite ? 1 : 0);
  return [...enemies].sort((a, b) => order(b) - order(a) || b.hp - a.hp);
}

// La vita su cui un potere conta la sua quota: quella del boss, per lui; per gli altri quella che il loro tipo ha
// nell'ondata più dura della battaglia (heroes.powerHp per il suo hpScale), mai meno di quella di un normale: dentro
// una battaglia un potere colpisce ogni tipo sempre uguale (le pedine degli sciami come un normale, così un'onda le
// spazza), e lungo la strada cresce con i nemici
function lifeOf(heroes, enemy) {
  if (enemy.type === ENEMY_TYPES.boss) return enemy.maxHp;
  return heroes.powerHp * Math.max(1, enemy.type.hpScale);
}

// Ogni bersaglio perde la quota del potere dell'eroe (ability.share) della vita che conta (lifeOf), per la parte del
// suo tipo e il danno in più di scrigni e riserve, meno la corazza (e di più su chi è già marchiato). Prima si
// raccolgono, poi si colpiscono: chi muore lascia la lista dei nemici
function hit({ heroes, army, bus }, targets, hero) {
  const scale = hero.ability.share * damageMultiplier(army);
  for (const enemy of targets) {
    const damage = lifeOf(heroes, enemy) * scale * (TARGET_SHARES.get(enemy.type) ?? 1);
    bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: markedDamage(enemy, afterArmor(damage, enemy.type.armor)), hero });
  }
}
