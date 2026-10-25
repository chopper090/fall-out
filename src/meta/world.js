import { WORLD } from '../data/world.js';

// Geometria del mondo (data/world.js), in celle: rettangoli di celle { col, row, cols, rows } con l'angolo nord in
// (col, row). Il territorio dove si costruisce è il villaggio

// Lato del quadrato del mondo, in celle
export const WORLD_CELLS = WORLD.areas * WORLD.areaCells;

// Il rettangolo di celle dell'area { col, row }
export function areaRect({ col, row }) {
  const size = WORLD.areaCells;
  return { col: col * size, row: row * size, cols: size, rows: size };
}

export function villageRect() {
  return areaRect(WORLD.village);
}

// Le aree ancora chiuse, nella nebbia: tutte tranne il villaggio
export function lockedAreas() {
  const areas = [];
  for (let row = 0; row < WORLD.areas; row++) {
    for (let col = 0; col < WORLD.areas; col++) {
      if (col !== WORLD.village.col || row !== WORLD.village.row) areas.push({ col, row });
    }
  }
  return areas;
}

// Il rettangolo rect sta tutto nel territorio
export function inTerritory(rect) {
  return insideRect(villageRect(), rect);
}

// La porta: la cella del villaggio davanti alla porta (inside) e quella appena fuori (outside)
export function gateCells() {
  const { col, row, cols, rows } = villageRect();
  const { side, at } = WORLD.gate;
  const cells = {
    north: [{ col: col + at, row }, { col: col + at, row: row - 1 }],
    east: [{ col: col + cols - 1, row: row + at }, { col: col + cols, row: row + at }],
    south: [{ col: col + at, row: row + rows - 1 }, { col: col + at, row: row + rows }],
    west: [{ col, row: row + at }, { col: col - 1, row: row + at }],
  };
  const [inside, outside] = cells[side];
  return { inside, outside };
}

// I due rettangoli hanno almeno una cella in comune
export function overlaps(a, b) {
  return a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
}

// La cella { col, row } sta nel rettangolo rect
export function hasCell(rect, { col, row }) {
  return overlaps(rect, { col, row, cols: 1, rows: 1 });
}

function insideRect(outer, inner) {
  return inner.col >= outer.col && inner.row >= outer.row &&
    inner.col + inner.cols <= outer.col + outer.cols && inner.row + inner.rows <= outer.row + outer.rows;
}
