import * as Phaser from 'phaser';
import { WORLD_VIEW } from '../config/balance.js';
import { WORLD_CELLS } from '../meta/world.js';
import { WORLD_WIDTH, toGrid, toWorld } from './iso.js';

// La camera del mondo (scenes/World.js): conversioni tra schermo e mondo con lo stato di adesso (getWorldPoint di
// Phaser usa quello del frame prima, sbagliato subito dopo uno zoom), zoom attorno a un punto, limiti

// Il punto dello schermo (sx, sy) nel mondo
export function screenToWorld(cam, sx, sy) {
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  return { x: (sx - cam.x - ox) / cam.zoom + cam.scrollX + ox, y: (sy - cam.y - oy) / cam.zoom + cam.scrollY + oy };
}

// Il punto del mondo (wx, wy) sullo schermo
export function worldToScreen(cam, wx, wy) {
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  return { x: (wx - cam.scrollX - ox) * cam.zoom + ox + cam.x, y: (wy - cam.scrollY - oy) * cam.zoom + oy + cam.y };
}

// Lo zoom più lontano (tutto il quadrato nella larghezza), quello più vicino e quello di partenza
export function zoomLimits(cam) {
  const { fitMargin, closeCells, startCells } = WORLD_VIEW.zoom;
  const { tileWidth } = WORLD_VIEW;
  return {
    min: (cam.width * (1 - fitMargin)) / WORLD_WIDTH,
    max: cam.width / (closeCells * tileWidth),
    start: cam.width / (startCells * tileWidth),
  };
}

// Zoom zoom (dentro i limiti) con il punto del mondo (wx, wy) sotto il punto dello schermo (sx, sy)
export function zoomAround(cam, zoom, wx, wy, sx, sy) {
  const { min, max } = zoomLimits(cam);
  const next = Phaser.Math.Clamp(zoom, min, max);
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  cam.setZoom(next);
  cam.setScroll(wx - ox - (sx - cam.x - ox) / next, wy - oy - (sy - cam.y - oy) / next);
  clampView(cam);
}

// La vista si sposta di (dx, dy) pixel dello schermo, come trascinata da un dito
export function panBy(cam, dx, dy) {
  cam.setScroll(cam.scrollX - dx / cam.zoom, cam.scrollY - dy / cam.zoom);
  clampView(cam);
}

// La vista guarda il punto del mondo (x, y), al centro dello schermo
export function lookAt(cam, x, y) {
  cam.setScroll(x - cam.width * cam.originX, y - cam.height * cam.originY);
  clampView(cam);
}

// Il centro della vista, nel mondo
export function viewCenter(cam) {
  return screenToWorld(cam, cam.x + cam.width * cam.originX, cam.y + cam.height * cam.originY);
}

// Il punto del mondo (x, y), portato dentro il rombo del mondo se ne è fuori
export function clampPoint(x, y) {
  const grid = toGrid(x, y);
  const col = Phaser.Math.Clamp(grid.col, 0, WORLD_CELLS);
  const row = Phaser.Math.Clamp(grid.row, 0, WORLD_CELLS);
  return col === grid.col && row === grid.row ? { x, y } : toWorld(col, row);
}

// Il centro della vista resta dentro il rombo del mondo
function clampView(cam) {
  const center = viewCenter(cam);
  const inside = clampPoint(center.x, center.y);
  cam.setScroll(inside.x - cam.width * cam.originX, inside.y - cam.height * cam.originY);
}
