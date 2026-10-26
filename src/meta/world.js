import { WORLD } from '../data/world.js';

// Geometria del mondo (data/world.js), in celle: rettangoli di celle { col, row, cols, rows } con l'angolo nord in
// (col, row). Il territorio dove si costruisce è il villaggio, più le aree già conquistate (conquered: quante, le prime
// nell'ordine della strada)

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

// Le aree fuori dal villaggio nell'ordine in cui la strada le conquista
export function conquestAreas() {
  return WORLD.road.map(({ area: [col, row] }) => ({ col, row }));
}

// Il numero, nell'ordine in cui la strada le conquista (da 0), dell'area che contiene la cella { col, row }; null nel
// villaggio o fuori dal mondo
export function conquestAreaOf(cell) {
  const index = conquestAreas().findIndex((area) => hasCell(areaRect(area), cell));
  return index < 0 ? null : index;
}

// Il rettangolo rect sta tutto nel territorio: tutto dentro le mura, o tutto nelle aree conquistate ma ad almeno
// WORLD.wallMargin celle dalle mura
export function inTerritory(rect, conquered) {
  const village = villageRect();
  if (insideRect(village, rect)) return true;
  const margin = WORLD.wallMargin;
  const near = { col: village.col - margin, row: village.row - margin };
  if (overlaps({ ...near, cols: village.cols + margin * 2, rows: village.rows + margin * 2 }, rect)) return false;
  const areas = conquestAreas().slice(0, conquered).map(areaRect);
  return cellsOf(rect).every((cell) => areas.some((area) => hasCell(area, cell)));
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
function hasCell(rect, { col, row }) {
  return overlaps(rect, { col, row, cols: 1, rows: 1 });
}

// Le celle del rettangolo rect
export function cellsOf({ col, row, cols, rows }) {
  const cells = [];
  for (let down = 0; down < rows; down++) {
    for (let across = 0; across < cols; across++) cells.push({ col: col + across, row: row + down });
  }
  return cells;
}

function insideRect(outer, inner) {
  return inner.col >= outer.col && inner.row >= outer.row &&
    inner.col + inner.cols <= outer.col + outer.cols && inner.row + inner.rows <= outer.row + outer.rows;
}
