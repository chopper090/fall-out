import { ENEMIES, GATES, HERO, WEAPON } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame, periodMs } from '../core/time.js';

// Combattimento: eroe e soldati sparano da soli, ognuno con il suo ritmo, dritto davanti a sé
export function createCombat(bus) {
  return {
    projectiles: [],
    pool: createPool(() => ({ x: 0, z: 0, damage: 0, share: 0 }), WEAPON.poolSize),
    bus,
  };
}

// targets = { enemies, gates }: ogni colpo si ferma sul primo bersaglio che incontra, cioè quello
// con la faccia anteriore più vicina. Il nemico perde il danno del colpo meno la sua armatura,
// il cancello si carica della sua parte. scrollSpeed: velocità del campo, con cui i bersagli
// vengono incontro ai colpi (i nemici veloci più in fretta, il boss piantato e i tiratori fermi per niente)
export function updateCombat(combat, army, targets, deltaMs, scrollSpeed) {
  const { projectiles, bus } = combat;
  const step = perFrame(WEAPON.speed, deltaMs);
  // In questo frame colpo e bersaglio si sono avvicinati di closing: si controlla tutto quel tratto
  const gateClosing = step + perFrame(scrollSpeed, deltaMs);
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const shot = projectiles[index];
    shot.z += step;
    if (shot.z > WEAPON.range) {
      removeShot(combat, index);
      continue;
    }
    const enemy = firstEnemy(targets.enemies, shot, step, deltaMs, scrollSpeed);
    const gate = targets.gates.find((candidate) => touches(shot, candidate, gateClosing, GATES.width, GATES.depth));
    if (!enemy && !gate) continue;
    removeShot(combat, index);
    if (gate && (!enemy || gate.z - GATES.depth / 2 <= enemy.z - enemy.size / 2)) {
      bus.emit(EVENTS.GATE_HIT, { gate, share: shot.share });
    } else {
      bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(shot.damage, enemy.type.armor) });
    }
  }

  // Oltre i soldati disegnati il colpo vale in proporzione di più. L'eroe ha la sua arma, più rapida di quella
  // dei soldati. Per i cancelli ogni colpo porta share: un secondo di fuoco di tutto l'esercito vale 1,
  // qualunque sia la sua grandezza
  const units = army.soldiers.length + 1;
  const reserves = army.size / units;
  const share = 1 / (HERO.fireRate + WEAPON.fireRate * army.soldiers.length);
  if (HERO.fireRate > 0) fireFrom(combat, army.hero, deltaMs / periodMs(HERO.fireRate), HERO.damage * reserves, share);
  if (WEAPON.fireRate <= 0) return;
  const elapsed = deltaMs / periodMs(WEAPON.fireRate);
  for (const soldier of army.soldiers) fireFrom(combat, soldier, elapsed, WEAPON.damage * reserves, share);
}

// La fase di chi spara scende di elapsed (frazione dell'intervallo di tiro): a zero parte un colpo,
// appena davanti a lui. Se la cadenza cambia, ognuno resta allo stesso punto del suo ritmo
function fireFrom({ projectiles, pool }, shooter, elapsed, damage, share) {
  shooter.phase -= elapsed;
  while (shooter.phase <= 0) {
    const shot = pool.acquire();
    shot.x = shooter.x;
    shot.z = shooter.z + (shooter.size + WEAPON.size) / 2;
    shot.damage = damage;
    shot.share = share;
    projectiles.push(shot);
    shooter.phase += 1;
  }
}

// Tra i nemici toccati dal colpo, quello con la faccia anteriore più vicina
function firstEnemy(enemies, shot, step, deltaMs, scrollSpeed) {
  let first = null;
  for (const enemy of enemies) {
    const closing = step + perFrame(scrollSpeed + enemy.extraSpeed, deltaMs);
    if (!touches(shot, enemy, closing, enemy.size, enemy.size)) continue;
    if (first === null || enemy.z - enemy.size / 2 < first.z - first.size / 2) first = enemy;
  }
  return first;
}

// L'armatura toglie armor a ogni colpo, ma una parte del danno (minDamageShare) passa sempre
function afterArmor(damage, armor) {
  return Math.max(damage * ENEMIES.minDamageShare, damage - armor);
}

// I colpi non hanno un ordine: quello tolto lascia il posto all'ultimo della lista
function removeShot({ projectiles, pool }, index) {
  pool.release(projectiles[index]);
  projectiles[index] = projectiles[projectiles.length - 1];
  projectiles.pop();
}

// Contatto se colpo e bersaglio (largo width, profondo depth) si sono sovrapposti in un punto qualsiasi
// del tratto: così anche a pochi FPS o con colpi molto veloci il colpo non attraversa il bersaglio
function touches(shot, target, closing, width, depth) {
  const reachZ = (WEAPON.size + depth) / 2;
  const gap = shot.z - target.z;
  return Math.abs(shot.x - target.x) < (WEAPON.size + width) / 2 && gap > -reachZ && gap - closing < reachZ;
}
