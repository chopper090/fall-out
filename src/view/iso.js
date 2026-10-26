import { WORLD_VIEW } from '../config/balance.js';
import { WORLD_CELLS } from '../meta/world.js';

// Vista isometrica del mondo, senza Phaser: una cella è un rombo largo WORLD_VIEW.tileWidth e alto tileHeight. Punti
// del mondo in pixel a zoom 1: l'angolo ovest del quadrato sta a x = 0, quello nord a y = 0. Coordinate di griglia con
// le frazioni: (col, row) è l'angolo nord della cella (col, row), (col + 0.5, row + 0.5) il suo centro
const HALF_W = WORLD_VIEW.tileWidth / 2;
const HALF_H = WORLD_VIEW.tileHeight / 2;
const ORIGIN_X = WORLD_CELLS * HALF_W;

// Larghezza del rombo del mondo intero
export const WORLD_WIDTH = WORLD_CELLS * WORLD_VIEW.tileWidth;

// Il punto del mondo del punto di griglia (col, row)
export function toWorld(col, row) {
  return { x: ORIGIN_X + (col - row) * HALF_W, y: (col + row) * HALF_H };
}

// Il punto di griglia del punto del mondo (x, y)
export function toGrid(x, y) {
  const across = (x - ORIGIN_X) / HALF_W;
  const down = y / HALF_H;
  return { col: (across + down) / 2, row: (down - across) / 2 };
}

// I quattro angoli del rettangolo di celle rect (meta/world.js), nell'ordine nord, est, sud, ovest
export function rectCorners({ col, row, cols, rows }) {
  return [toWorld(col, row), toWorld(col + cols, row), toWorld(col + cols, row + rows), toWorld(col, row + rows)];
}

export function rectCenter({ col, row, cols, rows }) {
  return toWorld(col + cols / 2, row + rows / 2);
}

// La sagoma sullo schermo di una scatola alta height sul rettangolo rect: i sei punti del contorno, dall'angolo ovest
// a terra in senso orario. È quello che si tocca per scegliere un edificio
export function boxOutline(rect, height) {
  const [north, east, south, west] = rectCorners(rect);
  return [
    { x: west.x, y: west.y },
    { x: west.x, y: west.y - height },
    { x: north.x, y: north.y - height },
    { x: east.x, y: east.y - height },
    { x: east.x, y: east.y },
    { x: south.x, y: south.y },
  ];
}

// Le tre facce che si vedono di una scatola, dai quattro angoli a terra base e dai quattro in cima top (ognuno
// nell'ordine nord, est, sud, ovest), nell'ordine in cui si disegnano: a sinistra (dall'angolo ovest a quello sud), a
// destra (da sud a est) e sopra. Le usano il terreno (view/worldGround.js) e gli atlanti (view/worldAtlas.js)
export function boxFaces([, eastBase, southBase, westBase], [north, east, south, west]) {
  return [
    ['left', [westBase, southBase, south, west]],
    ['right', [southBase, eastBase, east, south]],
    ['top', [north, east, south, west]],
  ];
}

// L'ordine di disegno di una cosa in piedi con il centro del suo posto a terra alla y del mondo: più avanti chi sta più
// in basso; ahead la mette davanti a chi sta allo stesso punto
export function standingDepth(y, ahead = false) {
  const { standing, tie } = WORLD_VIEW.depth;
  return standing + y + (ahead ? tie : 0);
}

// Il punto (x, y) sta dentro il poligono convesso points (in senso orario sullo schermo)
export function insidePolygon(points, x, y) {
  return points.every((a, index) => {
    const b = points[(index + 1) % points.length];
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0;
  });
}
