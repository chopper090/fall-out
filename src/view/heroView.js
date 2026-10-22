import { CAMERA, HERO } from '../config/balance.js';

// Vertici del cubo: il bit 1 vale destra, il bit 2 alto, il bit 4 lontano
const FACE_VERTICES = {
  front: [0, 1, 3, 2],
  top: [2, 3, 7, 6],
  left: [0, 4, 6, 2],
  right: [1, 5, 7, 3],
};

// Disegna l'eroe come un cubo appoggiato a terra a z = 0, solo con le facce che la telecamera vede
export function createHeroView(graphics, camera, cameraX) {
  const vertices = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
  const faces = Object.fromEntries(
    Object.entries(FACE_VERTICES).map(([name, indices]) => [name, indices.map((index) => vertices[index])]),
  );

  function fillFace(color, points) {
    graphics.fillStyle(color);
    graphics.fillPoints(points, true);
  }

  return {
    draw(heroX) {
      const half = HERO.size / 2;
      vertices.forEach((vertex, index) => {
        const x = heroX + (index & 1 ? half : -half);
        const y = index & 2 ? HERO.size : 0;
        const z = index & 4 ? half : -half;
        camera.project(x, y, z, vertex);
      });

      graphics.clear();
      const { top, front, side } = HERO.colors;
      if (cameraX < heroX - half) fillFace(side, faces.left);
      if (cameraX > heroX + half) fillFace(side, faces.right);
      if (CAMERA.height > HERO.size) fillFace(top, faces.top);
      if (CAMERA.distance > half) fillFace(front, faces.front);
    },
  };
}
