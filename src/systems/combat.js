import { ENEMIES, FIELD, GATES, HERO, WEAPON } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Combattimento: l'esercito spara da solo, dritto in avanti dalla sua posizione.
// I colpi sono in ordine di sparo: i più vecchi sono i più lontani e spariscono per primi
export function createCombat(bus) {
  return {
    projectiles: [],
    pool: createPool(() => ({ x: 0, z: 0 }), WEAPON.poolSize),
    shotsDue: 0,
    bus,
  };
}

// targets = { enemies, gates }: ogni colpo si ferma sul primo bersaglio che incontra, cioè quello
// con la faccia anteriore più vicina. Il nemico perde shotDamage punti vita, il cancello conta il colpo
export function updateCombat(combat, shooterX, shotDamage, targets, deltaMs) {
  const { projectiles, pool, bus } = combat;
  const step = perFrame(WEAPON.speed, deltaMs);
  for (const shot of projectiles) shot.z += step;
  while (projectiles.length > 0 && projectiles[0].z > WEAPON.range) pool.release(projectiles.shift());

  // In questo frame colpo e bersaglio si sono avvicinati di closing: si controlla tutto quel tratto
  const closing = step + perFrame(FIELD.scrollSpeed, deltaMs);
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const shot = projectiles[index];
    const enemy = targets.enemies.find((candidate) => touches(shot, candidate, closing, ENEMIES.size, ENEMIES.size));
    const gate = targets.gates.find((candidate) => touches(shot, candidate, closing, GATES.width, GATES.depth));
    if (!enemy && !gate) continue;
    projectiles.splice(index, 1);
    pool.release(shot);
    if (gate && (!enemy || gate.z - GATES.depth / 2 <= enemy.z - ENEMIES.size / 2)) bus.emit(EVENTS.GATE_HIT, gate);
    else bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: shotDamage });
  }

  combat.shotsDue += perFrame(WEAPON.fireRate, deltaMs);
  while (combat.shotsDue >= 1) {
    const shot = pool.acquire();
    shot.x = shooterX;
    shot.z = HERO.size / 2;
    projectiles.push(shot);
    combat.shotsDue -= 1;
  }
}

// Contatto se colpo e bersaglio (largo width, profondo depth) si sono sovrapposti in un punto qualsiasi
// del tratto: così anche a pochi FPS o con colpi molto veloci il colpo non attraversa il bersaglio
function touches(shot, target, closing, width, depth) {
  const reachZ = (WEAPON.size + depth) / 2;
  const gap = shot.z - target.z;
  return Math.abs(shot.x - target.x) < (WEAPON.size + width) / 2 && gap > -reachZ && gap - closing < reachZ;
}
