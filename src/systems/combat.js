import { ENEMIES, FIELD, HERO, WEAPON } from '../config/balance.js';
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

export function updateCombat(combat, shooterX, enemies, deltaMs) {
  const { projectiles, pool } = combat;
  const step = perFrame(WEAPON.speed, deltaMs);
  for (const shot of projectiles) shot.z += step;
  while (projectiles.length > 0 && projectiles[0].z > WEAPON.range) pool.release(projectiles.shift());

  // Il colpo che tocca un nemico sparisce e il nemico perde vita.
  // In questo frame colpo e nemico si sono avvicinati di closing: si controlla tutto quel tratto
  const closing = step + perFrame(FIELD.scrollSpeed, deltaMs);
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const shot = projectiles[index];
    const enemy = enemies.find((candidate) => touches(shot, candidate, closing));
    if (!enemy) continue;
    projectiles.splice(index, 1);
    pool.release(shot);
    combat.bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: WEAPON.damage });
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

// Contatto se le due scatole si sono sovrapposte in un punto qualsiasi del tratto: così anche
// a pochi FPS o con colpi molto veloci il colpo non attraversa il nemico senza toccarlo
function touches(shot, enemy, closing) {
  const reach = (WEAPON.size + ENEMIES.size) / 2;
  const gap = shot.z - enemy.z;
  return Math.abs(shot.x - enemy.x) < reach && gap > -reach && gap - closing < reach;
}
