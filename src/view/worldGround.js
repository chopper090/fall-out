import * as Phaser from 'phaser';
import { WORLD_VIEW } from '../config/balance.js';
import { WORLD } from '../data/world.js';
import { fadeFog } from '../fx/worldFx.js';
import { ROAD_TILES } from '../meta/road.js';
import { WORLD_CELLS, areaRect, cellsOf, conquestAreas, inTerritory, villageRect } from '../meta/world.js';
import { boxFaces, rectCenter, rectCorners, standingDepth, toWorld } from './iso.js';
import { GROUND_TEXTURE, GROUND_TILES } from './worldAtlas.js';

// Il terreno del mondo (scenes/World.js), in grigio, disegnato una volta quando si apre: le celle, le mura del
// villaggio con la porta, la nebbia sulle aree non conquistate e i confini delle aree. conquered: quante aree sono
// conquistate (meta/road.js conqueredAreas)

// Terreno: una cella per casella di un TilemapLayer isometrico (si disegnano solo quelle in vista), sopra un rombo
// pieno che copre le righine tra le celle; il territorio (il villaggio e le aree conquistate, tranne le celle troppo
// vicine alle mura) ha il suo colore e la griglia, la strada il suo
export function drawGround(scene, conquered) {
  const { tileWidth, tileHeight, ground, depth } = WORLD_VIEW;
  const world = { col: 0, row: 0, cols: WORLD_CELLS, rows: WORLD_CELLS };
  const base = scene.add.graphics().setDepth(depth.ground);
  base.fillStyle(ground.land);
  base.fillPoints(rectCorners(world), true);
  const data = new Phaser.Tilemaps.MapData({
    width: WORLD_CELLS,
    height: WORLD_CELLS,
    tileWidth,
    tileHeight,
    orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
  });
  const map = new Phaser.Tilemaps.Tilemap(scene, data);
  const key = GROUND_TEXTURE;
  const tiles = map.addTilesetImage(key, key, tileWidth, tileHeight, ground.tileMargin, ground.tileSpacing);
  // Phaser mette ogni casella con l'angolo in alto a sinistra del suo riquadro: mezza cella a sinistra del vertice
  const north = toWorld(0, 0);
  const layer = map.createBlankLayer('ground', tiles, north.x - tileWidth / 2, north.y).setDepth(depth.ground);
  layer.fill(GROUND_TILES.land);
  const { col, row, cols, rows } = villageRect();
  layer.fill(GROUND_TILES.territory, col, row, cols, rows);
  for (const area of conquestAreas().slice(0, conquered)) {
    for (const { col: x, row: y } of cellsOf(areaRect(area))) {
      if (inTerritory({ col: x, row: y, cols: 1, rows: 1 }, conquered)) layer.putTileAt(GROUND_TILES.territory, x, y);
    }
  }
  for (const tile of ROAD_TILES) layer.putTileAt(GROUND_TILES.road, tile.col, tile.row);
}

// Le mura sul bordo del villaggio, una cella alla volta: i lati nord e ovest dietro tutto, i pezzi dei lati est e
// sud in ordine con le cose in piedi (quello che sta fuori, davanti a loro, li copre). Sul lato della porta un varco
// largo una cella, con una torre per parte
export function drawWalls(scene) {
  const { walls, depth } = WORLD_VIEW;
  const back = scene.add.graphics().setDepth(depth.backWalls);
  const { col, row, cols, rows } = villageRect();
  const half = walls.thickness / 2;
  const sides = {
    north: { front: false, along: 'col', at: row, from: col, to: col + cols },
    west: { front: false, along: 'row', at: col, from: row, to: row + rows },
    east: { front: true, along: 'row', at: col + cols, from: row, to: row + rows },
    south: { front: true, along: 'col', at: row + rows, from: col, to: col + cols },
  };
  // Il tratto di muro (o la torre, quadrata di lato size) da start a end lungo il lato side, alto height
  const piece = (side, start, end, size, height, colors) => {
    const { along, at } = side;
    const rect = along === 'col'
      ? { col: start, row: at - size / 2, cols: end - start, rows: size }
      : { col: at - size / 2, row: start, cols: size, rows: end - start };
    const graphics = side.front ? scene.add.graphics().setDepth(standingDepth(rectCenter(rect).y, true)) : back;
    drawBox(graphics, rect, height, colors);
  };
  for (const [name, side] of Object.entries(sides)) {
    const { from, to } = side;
    const gap = name === WORLD.gate.side ? from + WORLD.gate.at : null;
    for (let at = from; at < to; at++) {
      if (at === gap) continue;
      const start = at === from ? at - half : at;
      const end = at === to - 1 ? at + 1 + half : at + 1;
      piece(side, start, end, walls.thickness, walls.height, walls.colors);
    }
    if (gap === null) continue;
    const { size, height, colors } = walls.post;
    for (const end of [gap, gap + 1]) piece(side, end - size / 2, end + size / 2, size, height, colors);
  }
}

// Nebbia su ogni area non conquistata: leggera su quella da conquistare, piena sulle altre; appena conquistata
// un'area (conquest) la sua nebbia leggera se ne va e quella dopo si alleggerisce. Poi i confini di tutte le aree
export function drawFog(scene, conquered, conquest) {
  const { fog, areaLines, depth } = WORLD_VIEW;
  conquestAreas().forEach((area, index) => {
    const fresh = conquest?.area === index;
    if (index < conquered && !fresh) return;
    const graphics = scene.add.graphics().setDepth(depth.fog);
    graphics.fillStyle(fog.color);
    graphics.fillPoints(rectCorners(areaRect(area)), true);
    if (fresh) fadeFog(scene, graphics, fog.current, 0);
    else if (index > conquered) graphics.setAlpha(1);
    else if (conquest !== null) fadeFog(scene, graphics, 1, fog.current);
    else graphics.setAlpha(fog.current);
  });
  const lines = scene.add.graphics().setDepth(depth.areaLines);
  lines.lineStyle(areaLines.width, areaLines.color, areaLines.alpha);
  const size = WORLD.areaCells;
  for (let index = 0; index <= WORLD.areas; index++) {
    const at = index * size;
    lines.lineBetween(toWorld(at, 0).x, toWorld(at, 0).y, toWorld(at, WORLD_CELLS).x, toWorld(at, WORLD_CELLS).y);
    lines.lineBetween(toWorld(0, at).x, toWorld(0, at).y, toWorld(WORLD_CELLS, at).x, toWorld(WORLD_CELLS, at).y);
  }
}

// Una scatola alta height sul rettangolo di celle rect, nella Graphics: faccia sinistra, destra, poi sopra
function drawBox(graphics, rect, height, colors) {
  const base = rectCorners(rect);
  const top = base.map(({ x, y }) => ({ x, y: y - height }));
  for (const [face, points] of boxFaces(base, top)) {
    graphics.fillStyle(colors[face]);
    graphics.fillPoints(points, true);
  }
}
