import * as Phaser from 'phaser';
import { WORLD_VIEW } from '../config/balance.js';
import { HEROES } from '../data/heroes.js';
import { ROAD_TILES, conqueredAreas, hereTile, kindKnown, roadTileAt, targetTile } from '../meta/road.js';
import { conquestAreaOf, gateCells } from '../meta/world.js';
import { boxOutline, insidePolygon, standingDepth, toGrid, toWorld } from './iso.js';
import { PAWN_ATLAS, heroFrame } from './pawns.js';
import { ROAD_ATLAS, markerHeight } from './worldAtlas.js';

// La strada nel mondo (scenes/World.js), in grigio, dal cammino del profilo (meta/road.js): i segni delle caselle
// (dall'atlante ROAD_ATLAS, al posto della grafica vera) e il capo sulla casella dove si è, che cammina da una casella
// all'altra. Il capo e i segni stanno in ordine con le altre cose in piedi
export function createRoadView(scene) {
  const pawn = scene.add.image(0, 0, PAWN_ATLAS, heroFrame(HEROES.leader));
  pawn.setScale(WORLD_VIEW.road.pawn.width / pawn.frame.width);
  return { scene, pawn, markers: [], walking: false };
}

// I segni delle caselle per il profilo profile e il capo sulla sua casella, se non sta camminando
export function drawRoad(view, profile) {
  for (const marker of view.markers) marker.destroy();
  view.markers = [];
  for (const tile of ROAD_TILES) {
    const frame = markerFrame(profile, tile);
    if (frame === null) continue;
    const { center } = tileSpot(tile);
    const image = view.scene.add.image(center.x, center.y, ROAD_ATLAS, frame);
    image.setScale(1 / WORLD_VIEW.textureScale).setDepth(standingDepth(center.y));
    view.markers.push(image);
  }
  if (!view.walking) placePawn(view, hereTile(profile));
}

// Il capo cammina fino alla casella tile, sempre in ordine con quello che ha intorno; arrivato, arrive
export function walkPawn(view, tile, arrive) {
  const { pawn } = view;
  const { center } = tileSpot(tile);
  view.walking = true;
  view.scene.tweens.add({
    targets: pawn,
    x: center.x,
    y: center.y,
    duration: WORLD_VIEW.road.stepMs,
    ease: Phaser.Math.Easing.Sine.InOut,
    onUpdate: () => pawn.setDepth(standingDepth(pawn.y, true)),
    onComplete: () => {
      view.walking = false;
      arrive();
    },
  });
}

// Il punto del mondo cade sul capo
export function pawnAt(view, { x, y }) {
  return view.pawn.getBounds().contains(x, y);
}

// La casella della strada sotto il punto del mondo, fuori dalla nebbia piena (la porta compresa); null se non ce n'è
export function roadTileUnder(profile, { x, y }) {
  const grid = toGrid(x, y);
  const tile = roadTileAt(Math.floor(grid.col), Math.floor(grid.row));
  return tile !== null && tile.area <= conqueredAreas(profile.road) ? tile : null;
}

// La casella da toccare per andare avanti (meta/road.js targetTile) se il punto del mondo cade su di lei o sul suo
// segno, che sale sopra le caselle dietro (la sagoma della casella alzata fin dove arriva il segno, come quella degli
// edifici); null altrimenti
export function targetUnder(profile, { x, y }) {
  const tile = targetTile(profile);
  if (tile === null) return null;
  const frame = markerFrame(profile, tile);
  const height = frame === null ? 0 : markerHeight(frame);
  const outline = boxOutline({ col: tile.col, row: tile.row, cols: 1, rows: 1 }, height);
  return insidePolygon(outline, x, y) ? tile : null;
}

// Il punto del mondo cade nell'area da conquistare
export function inCurrentArea(profile, { x, y }) {
  const grid = toGrid(x, y);
  return conquestAreaOf({ col: Math.floor(grid.col), row: Math.floor(grid.row) }) === conqueredAreas(profile.road);
}

// Dove sta chi è sulla casella tile (il centro della cella; alla porta, in mezzo al varco), nel mondo
export function tileSpot(tile) {
  if (tile.kind !== 'gate') return { center: toWorld(tile.col + 0.5, tile.row + 0.5) };
  const { inside, outside } = gateCells();
  return { center: toWorld((inside.col + outside.col) / 2 + 0.5, (inside.row + outside.row) / 2 + 0.5) };
}

// Il segno della casella: la bandiera sul boss di un'area conquistata; poi, nell'area da conquistare, quello delle
// battaglie (uno per durata), del boss e delle raccolte di cui si sa il tipo ancora da fare (la casella dove si è solo
// se è una battaglia da vincere) e il punto di domanda su quelle di cui non si sa ancora; null nessun segno
function markerFrame(profile, tile) {
  const { at, done } = profile.road;
  const conquered = conqueredAreas(profile.road);
  if (tile.kind === 'boss' && tile.area < conquered) return 'conquered';
  if (tile.index < at || (tile.index === at && done) || tile.area !== conquered) return null;
  if (!kindKnown(profile, tile)) return 'unknown';
  if (tile.kind === 'battle') return tile.rules.length;
  return tile.kind === 'boss' || tile.kind === 'collect' ? tile.kind : null;
}

// Il capo sulla casella tile, davanti al suo segno
function placePawn(view, tile) {
  const { center } = tileSpot(tile);
  view.pawn.setPosition(center.x, center.y).setDepth(standingDepth(center.y, true));
}
