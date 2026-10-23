import { CAMERA } from '../config/balance.js';

const DEG_TO_RAD = Math.PI / 180;

// Telecamera in prospettiva, ferma al centro del campo e dietro l'eroe (che sta a z = 0).
// Mondo: x di lato, y in alto, z in avanti. Rilegge CAMERA a ogni update: il pannello la regola dal vivo
export function createCamera({ screenWidth, screenHeight, centerX }) {
  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  let focal = 1;
  let sin = 0;
  let cos = 1;

  // Distanza del punto davanti all'obiettivo, lungo la direzione in cui guarda la telecamera
  function depthOf(y, z) {
    return (z + CAMERA.distance) * cos - (y - CAMERA.height) * sin;
  }

  return {
    depthOf,

    // Ricalcola i valori derivati da CAMERA, una volta per frame
    update() {
      const pitch = CAMERA.pitchDeg * DEG_TO_RAD;
      focal = cy / Math.tan((CAMERA.fovDeg * DEG_TO_RAD) / 2);
      sin = Math.sin(pitch);
      cos = Math.cos(pitch);
    },

    // Proietta il punto (x, y, z) del mondo sullo schermo, scrivendo il risultato in out.
    // Vale solo per punti davanti alla telecamera: chi disegna controlla prima depthOf
    project(x, y, z, out) {
      const dy = y - CAMERA.height;
      const dz = z + CAMERA.distance;
      const depth = depthOf(y, z);
      out.x = cx + (focal * (x - centerX)) / depth;
      out.y = cy - (focal * (dy * cos + dz * sin)) / depth;
      return out;
    },

    // Pixel di schermo per unità del mondo nel punto (y, z): quanto è grande lì una pedina in piedi
    scaleAt(y, z) {
      return focal / depthOf(y, z);
    },

    // z del terreno inquadrato dalla riga di schermo indicata (Infinity se la riga guarda sopra l'orizzonte)
    groundZAt(screenY) {
      const up = (cy - screenY) / focal;
      const rayY = up * cos - sin;
      if (rayY >= 0) return Infinity;
      const rayZ = cos + up * sin;
      return -CAMERA.distance + (CAMERA.height / -rayY) * rayZ;
    },

    // Unità del mondo che corrispondono a un pixel di schermo, sul terreno all'altezza dell'eroe
    worldPerPixelAtHero() {
      return (CAMERA.distance * cos + CAMERA.height * sin) / focal;
    },
  };
}
