import { CAMERA } from '../config/balance.js';

// Vertici della scatola: il bit 1 vale destra, il bit 2 alto, il bit 4 lontano
const FACE_VERTICES = {
  front: [0, 1, 3, 2],
  top: [2, 3, 7, 6],
  left: [0, 4, 6, 2],
  right: [1, 5, 7, 3],
};

// Disegna cubi in prospettiva, solo con le facce che la telecamera vede
export function createBoxDrawer(graphics, camera, cameraX) {
  const vertices = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
  const faces = Object.fromEntries(
    Object.entries(FACE_VERTICES).map(([name, indices]) => [name, indices.map((index) => vertices[index])]),
  );

  function fillFace(color, points) {
    graphics.fillStyle(color);
    graphics.fillPoints(points, true);
  }

  // Cubo di lato size, con la base centrata in (x, z) all'altezza y.
  // Lo spigolo più vicino all'obiettivo è quello alto e davanti: se è troppo vicino il cubo non si disegna
  return function drawBox(x, y, z, size, colors) {
    const half = size / 2;
    if (camera.depthOf(y + size, z - half) <= CAMERA.nearDepth) return;
    vertices.forEach((vertex, index) => {
      camera.project(x + (index & 1 ? half : -half), y + (index & 2 ? size : 0), z + (index & 4 ? half : -half), vertex);
    });

    if (cameraX < x - half) fillFace(colors.side, faces.left);
    if (cameraX > x + half) fillFace(colors.side, faces.right);
    if (CAMERA.height > y + size) fillFace(colors.top, faces.top);
    if (-CAMERA.distance < z - half) fillFace(colors.front, faces.front);
  };
}
