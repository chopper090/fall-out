import { ENEMIES, FX, HERO, WEAPON } from '../config/balance.js';
import { createBoxDrawer } from './box.js';

// Disegna eroe, colpi, nemici e scoppi in ordine di profondità, dal più lontano al più vicino:
// così chi è davanti copre chi è dietro. I record della coda si riusano a ogni frame
export function createUnitsView(graphics, camera, cameraX) {
  const drawBox = createBoxDrawer(graphics, camera, cameraX);
  const records = [];
  const queue = [];

  // Due cubi alla stessa distanza ma affiancati: il più lontano di lato dalla telecamera sta dietro.
  // Negli altri casi va prima quello più avanti lungo la strada
  const byDepth = (a, b) => {
    const reach = (a.size + b.size) / 2;
    const sideBySide = Math.abs(a.z - b.z) < reach && Math.abs(a.x - b.x) >= reach;
    if (sideBySide) return Math.abs(b.x - cameraX) - Math.abs(a.x - cameraX);
    return b.z - a.z;
  };

  function enqueue(x, y, z, size, colors) {
    const record = records[queue.length] ?? (records[queue.length] = {});
    record.x = x;
    record.y = y;
    record.z = z;
    record.size = size;
    record.colors = colors;
    queue.push(record);
  }

  return {
    draw(heroX, projectiles, enemies, enemyFx) {
      queue.length = 0;
      enqueue(heroX, 0, 0, HERO.size, HERO.colors);
      for (const shot of projectiles) enqueue(shot.x, WEAPON.flightHeight, shot.z, WEAPON.size, WEAPON.colors);
      for (const enemy of enemies) {
        const colors = enemyFx.flashes.has(enemy) ? FX.hitFlash.colors : ENEMIES.colors;
        enqueue(enemy.x, 0, enemy.z, ENEMIES.size, colors);
      }
      for (const pop of enemyFx.pops) {
        const growth = 1 + FX.death.growth * (pop.elapsedMs / FX.death.durationMs);
        enqueue(pop.x, 0, pop.z, ENEMIES.size * growth, ENEMIES.colors);
      }

      queue.sort(byDepth);
      graphics.clear();
      for (const record of queue) drawBox(record.x, record.y, record.z, record.size, record.colors);
    },
  };
}
