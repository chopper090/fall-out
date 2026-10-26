import { CAMERA } from '../config/balance.js';

// Vertici della scatola: il bit 1 vale destra, il bit 2 alto, il bit 4 lontano
const FACE_VERTICES = {
  front: [0, 1, 3, 2],
  top: [2, 3, 7, 6],
  left: [0, 4, 6, 2],
  right: [1, 5, 7, 3],
};

// Disegna scatole in prospettiva, solo con le facce che la telecamera vede
export function createBoxDrawer(graphics, camera, cameraX) {
  const vertices = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
  const faces = Object.fromEntries(
    Object.entries(FACE_VERTICES).map(([name, indices]) => [name, indices.map((index) => vertices[index])]),
  );

  // Una faccia è un quadrilatero convesso: bastano due triangoli, più leggeri di un poligono generico
  function fillFace(color, [a, b, c, d]) {
    graphics.fillStyle(color);
    graphics.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
    graphics.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
  }

  // Scatola larga width (x), alta height (y) e profonda depth (z), con la base centrata in (x, z) all'altezza y.
  // Lo spigolo più vicino all'obiettivo è quello alto e davanti: se è troppo vicino la scatola non si disegna
  return function drawBox(x, y, z, width, height, depth, colors) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    if (!camera.inFront(y + height, z - halfDepth)) return;
    vertices.forEach((vertex, index) => {
      camera.project(
        x + (index & 1 ? halfWidth : -halfWidth),
        y + (index & 2 ? height : 0),
        z + (index & 4 ? halfDepth : -halfDepth),
        vertex,
      );
    });

    if (cameraX < x - halfWidth) fillFace(colors.side, faces.left);
    if (cameraX > x + halfWidth) fillFace(colors.side, faces.right);
    if (CAMERA.height > y + height) fillFace(colors.top, faces.top);
    if (-CAMERA.distance < z - halfDepth) fillFace(colors.front, faces.front);
  };
}
