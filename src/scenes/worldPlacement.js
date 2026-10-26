import * as Phaser from 'phaser';
import { WORLD_VIEW } from '../config/balance.js';
import { VILLAGE } from '../data/village.js';
import { canPlace, footprint } from '../meta/village.js';
import { WORLD_CELLS } from '../meta/world.js';
import { boxOutline, insidePolygon, rectCenter, rectCorners, toGrid, toWorld } from '../view/iso.js';
import { BUILDING_ATLAS, buildingHeight, siteFrame, siteHeight } from '../view/worldAtlas.js';
import { worldToScreen } from '../view/worldCamera.js';

// L'edificio da mettere o spostare nel mondo (scenes/World.js): la sua immagine trasparente, il suo posto a terra con
// il bordo e, sotto, ✗ e ✓. Si muove una cella alla volta, dentro il mondo; cosa fanno ✓ e ✗ lo decide il mondo

// L'edificio id nuovo o da spostare (moving), con l'angolo nord nella cella cell; site: si sposta il suo cantiere
export function createPlacement(scene, { id, moving, cell, site }) {
  const { ghost, depth, overlays } = WORLD_VIEW;
  const image = scene.add.image(0, 0, BUILDING_ATLAS, site ? siteFrame(id) : id).setAlpha(ghost.alpha);
  image.setScale(1 / WORLD_VIEW.textureScale).setDepth(depth.ghost + 1);
  const ground = scene.add.graphics().setDepth(depth.ghost);
  const edge = scene.add.graphics().setDepth(depth.ghost + 2);
  const buttons = scene.add.container(0, 0, drawConfirm(scene, overlays.confirm)).setDepth(depth.overlays);
  const height = site ? siteHeight() : buildingHeight(id);
  return { id, moving, cell, image, ground, edge, buttons, height, valid: false };
}

// L'edificio da mettere al suo posto di adesso, tra gli edifici in positions e con conquered aree conquistate: il
// posto verde se ci sta, rosso se no, con il bordo sopra l'edificio; l'edificio stesso diventa rosso e ✓ si spegne
// se non ci sta
export function drawGhost(placement, positions, conquered) {
  const { id, cell, image, ground, edge, buttons } = placement;
  const { ghost, overlays } = WORLD_VIEW;
  const rect = footprint(id, cell);
  const valid = canPlace(positions, id, cell, conquered);
  const color = valid ? ghost.valid : ghost.invalid;
  const center = rectCenter(rect);
  image.setPosition(center.x, center.y);
  if (valid) image.clearTint();
  else image.setTint(ghost.invalid);
  ground.clear();
  ground.fillStyle(color, ghost.footprintAlpha);
  ground.fillPoints(rectCorners(rect), true);
  edge.clear();
  edge.lineStyle(ghost.outlineWidth, color);
  edge.strokePoints(rectCorners(rect), true);
  const south = toWorld(rect.col + rect.cols, rect.row + rect.rows);
  buttons.setPosition(south.x, south.y);
  buttons.list[1].setAlpha(valid ? 1 : overlays.confirm.disabledAlpha);
  placement.valid = valid;
}

// Il punto del mondo cade sull'edificio da mettere: dove lo si è preso, rispetto al suo angolo nord; null se no
export function grabGhost({ id, cell, height }, { x, y }) {
  const rect = footprint(id, cell);
  if (!insidePolygon(boxOutline(rect, height), x, y)) return null;
  const grid = toGrid(x, y);
  return { col: grid.col - cell.col, row: grid.row - cell.row };
}

// La cella dell'angolo nord dell'edificio da mettere, preso nel punto grab e trascinato fino al punto del mondo world
export function dragCell(world, grab) {
  const grid = toGrid(world.x, world.y);
  return { col: Math.round(grid.col - grab.col), row: Math.round(grid.row - grab.row) };
}

// La cella dell'angolo nord dell'edificio da mettere con il centro sul punto di griglia grid
export function centerCell({ id }, grid) {
  const [cols, rows] = VILLAGE.buildings[id].size;
  return { col: Math.round(grid.col - cols / 2), row: Math.round(grid.row - rows / 2) };
}

// L'edificio da mettere con l'angolo nord in cell, dentro il mondo; dice se si è mosso
export function moveGhost(placement, cell) {
  const [cols, rows] = VILLAGE.buildings[placement.id].size;
  const col = Phaser.Math.Clamp(cell.col, 0, WORLD_CELLS - cols);
  const row = Phaser.Math.Clamp(cell.row, 0, WORLD_CELLS - rows);
  if (col === placement.cell.col && row === placement.cell.row) return false;
  placement.cell = { col, row };
  return true;
}

// Il tocco cade su ✓ (ok) o su ✗ (cancel) sotto l'edificio da mettere, o su niente (null)
export function confirmAt({ buttons }, cam, pointer) {
  const { radius, gap, offsetY } = WORLD_VIEW.overlays.confirm;
  const at = worldToScreen(cam, buttons.x, buttons.y);
  const near = (dx) => Phaser.Math.Distance.Between(pointer.x, pointer.y, at.x + dx, at.y + offsetY) <= radius;
  if (near(gap / 2)) return 'ok';
  if (near(-gap / 2)) return 'cancel';
  return null;
}

export function destroyPlacement({ image, ground, edge, buttons }) {
  image.destroy();
  ground.destroy();
  edge.destroy();
  buttons.destroy();
}

// ✗ a sinistra e ✓ a destra, offsetY sotto il punto: rispettivamente i figli 0 e 1
function drawConfirm(scene, { radius, gap, offsetY, ok, cancel, icon, iconWidth, cross, check }) {
  const no = scene.add.graphics();
  const arm = radius * cross;
  no.fillStyle(cancel);
  no.fillCircle(-gap / 2, offsetY, radius);
  no.lineStyle(iconWidth, icon);
  no.lineBetween(-gap / 2 - arm, offsetY - arm, -gap / 2 + arm, offsetY + arm);
  no.lineBetween(-gap / 2 - arm, offsetY + arm, -gap / 2 + arm, offsetY - arm);
  const yes = scene.add.graphics();
  yes.fillStyle(ok);
  yes.fillCircle(gap / 2, offsetY, radius);
  yes.lineStyle(iconWidth, icon);
  yes.strokePoints(check.map(([x, y]) => ({ x: gap / 2 + x * radius, y: offsetY + y * radius })), false);
  return [no, yes];
}
