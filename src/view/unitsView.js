import { HERO, WEAPON } from '../config/balance.js';
import { createBoxDrawer } from './box.js';

// Disegna i colpi, dal più lontano, e poi l'eroe: così i più vicini coprono i più lontani
export function createUnitsView(graphics, camera, cameraX) {
  const drawBox = createBoxDrawer(graphics, camera, cameraX);
  return {
    draw(heroX, projectiles) {
      graphics.clear();
      for (const shot of projectiles) drawBox(shot.x, WEAPON.flightHeight, shot.z, WEAPON.size, WEAPON.colors);
      drawBox(heroX, 0, 0, HERO.size, HERO.colors);
    },
  };
}
