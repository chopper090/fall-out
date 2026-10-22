import { HERO, WEAPON } from '../config/balance.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Combattimento: l'esercito spara da solo, dritto in avanti dalla sua posizione.
// I colpi sono in ordine di sparo: i più vecchi sono i più lontani e spariscono per primi
export function createCombat() {
  return {
    projectiles: [],
    pool: createPool(() => ({ x: 0, z: 0 }), WEAPON.poolSize),
    shotsDue: 0,
  };
}

export function updateCombat(combat, shooterX, deltaMs) {
  const { projectiles, pool } = combat;
  const step = perFrame(WEAPON.speed, deltaMs);
  for (const shot of projectiles) shot.z += step;
  while (projectiles.length > 0 && projectiles[0].z > WEAPON.range) pool.release(projectiles.shift());

  combat.shotsDue += perFrame(WEAPON.fireRate, deltaMs);
  while (combat.shotsDue >= 1) {
    const shot = pool.acquire();
    shot.x = shooterX;
    shot.z = HERO.size / 2;
    projectiles.push(shot);
    combat.shotsDue -= 1;
  }
}
