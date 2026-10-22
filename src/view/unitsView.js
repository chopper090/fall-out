import { ENEMIES, FX, GATES, HERO, WEAPON } from '../config/balance.js';
import { createBoxDrawer } from './box.js';

// Disegna eroe, colpi, nemici, scoppi e cancelli in ordine di profondità, dal più lontano al più vicino:
// così chi è davanti copre chi è dietro. I record della coda si riusano a ogni frame
export function createUnitsView(graphics, camera, cameraX) {
  const drawBox = createBoxDrawer(graphics, camera, cameraX);
  const records = [];
  const queue = [];

  // Due scatole alla stessa distanza ma affiancate: la più lontana di lato dalla telecamera sta dietro.
  // Negli altri casi va prima quella più avanti lungo la strada
  const byDepth = (a, b) => {
    const sideBySide = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 && Math.abs(a.x - b.x) >= (a.width + b.width) / 2;
    if (sideBySide) return Math.abs(b.x - cameraX) - Math.abs(a.x - cameraX);
    return b.z - a.z;
  };

  function enqueue(x, y, z, width, height, depth, colors, isGate = false) {
    const record = records[queue.length] ?? (records[queue.length] = {});
    record.x = x;
    record.y = y;
    record.z = z;
    record.width = width;
    record.height = height;
    record.depth = depth;
    record.colors = colors;
    record.isGate = isGate;
    queue.push(record);
  }

  function enqueueCube(x, y, z, size, colors) {
    enqueue(x, y, z, size, size, size, colors);
  }

  // Il cancello entra in coda come un oggetto unico: le sue parti si disegnano sempre nello stesso ordine
  function enqueueGate(gate, colors) {
    const { width, depth, postHeight, beamHeight } = GATES;
    enqueue(gate.x, 0, gate.z, width, postHeight + beamHeight, depth, colors, true);
  }

  // Due pali ai lati e poi la trave in alto che fa da insegna: la trave copre sempre la cima dei pali
  function drawGate({ x, z, colors }) {
    const { width, depth, postWidth, postHeight, beamHeight } = GATES;
    const postOffset = (width - postWidth) / 2;
    drawBox(x - postOffset, 0, z, postWidth, postHeight, depth, colors);
    drawBox(x + postOffset, 0, z, postWidth, postHeight, depth, colors);
    drawBox(x, postHeight, z, width, beamHeight, depth, colors);
  }

  return {
    draw(heroX, projectiles, enemies, gates, enemyFx, gateFx) {
      queue.length = 0;
      enqueueCube(heroX, 0, 0, HERO.size, HERO.colors);
      for (const shot of projectiles) enqueueCube(shot.x, WEAPON.flightHeight, shot.z, WEAPON.size, WEAPON.colors);
      for (const enemy of enemies) {
        enqueueCube(enemy.x, 0, enemy.z, ENEMIES.size, enemyFx.flashes.has(enemy) ? FX.hitFlash.colors : ENEMIES.colors);
      }
      for (const pop of enemyFx.pops) {
        const growth = 1 + FX.death.growth * (pop.elapsedMs / FX.death.durationMs);
        enqueueCube(pop.x, 0, pop.z, ENEMIES.size * growth, ENEMIES.colors);
      }
      for (const gate of gates) enqueueGate(gate, gateFx.flashes.has(gate) ? FX.hitFlash.colors : GATES.colors);

      queue.sort(byDepth);
      graphics.clear();
      for (const r of queue) {
        if (r.isGate) drawGate(r);
        else drawBox(r.x, r.y, r.z, r.width, r.height, r.depth, r.colors);
      }
    },
  };
}
