import { WORLD_VIEW } from '../config/balance.js';
import { VILLAGE } from '../data/village.js';
import { fillPolygon, hex } from './canvas.js';
import { boxFaces } from './iso.js';

// Immagini del mondo in grigio, disegnate una volta e tenute dal gioco: il tileset del terreno (GROUND_TEXTURE, un
// rombo per tipo di cella, nell'ordine di GROUND_TILES), l'atlante degli edifici (BUILDING_ATLAS: ogni edificio
// costruito, con il nome del suo id, e il suo cantiere, siteFrame(id)) e quello dei segni della strada (ROAD_ATLAS,
// uno per nome di WORLD_VIEW.road.markers, su una cella), visti in isometria come in view/iso.js. Il punto d'appoggio
// di ogni riquadro è il centro del suo posto a terra: chi lo mostra lo mette al centro del posto. La grafica vera
// prenderà il posto delle immagini
export const GROUND_TEXTURE = 'worldGround';
export const GROUND_TILES = { land: 0, territory: 1, road: 2 };
export const BUILDING_ATLAS = 'worldBuildings';
export const ROAD_ATLAS = 'worldRoad';

const HALF_W = WORLD_VIEW.tileWidth / 2;
const HALF_H = WORLD_VIEW.tileHeight / 2;
const PADDING = WORLD_VIEW.atlasPadding;

export function siteFrame(id) {
  return `${id}Site`;
}

// Quanto sale sopra il terreno l'edificio id costruito, in pixel del mondo: fin dove arriva il suo pezzo più alto
export function buildingHeight(id) {
  return partsHeight(WORLD_VIEW.buildings[id]);
}

// Quanto sale sopra il terreno il segno della strada name (WORLD_VIEW.road.markers), in pixel del mondo
export function markerHeight(name) {
  return partsHeight(WORLD_VIEW.road.markers[name]);
}

// Quanto sale il cantiere di un edificio
export function siteHeight() {
  const { plot, post } = WORLD_VIEW.site;
  return Math.max(plot.height, post.height);
}

export function createWorldAtlas(textures) {
  if (!textures.exists(GROUND_TEXTURE)) drawGround(textures);
  if (!textures.exists(BUILDING_ATLAS)) drawBuildings(textures);
  if (!textures.exists(ROAD_ATLAS)) drawRoadMarkers(textures);
}

// Un rombo per tipo di terreno, un po' più largo della cella (seam) ma tagliato al suo riquadro; nel territorio e
// sulla strada con il bordo della cella
function drawGround(textures) {
  const { tileWidth: width, tileHeight: height, ground } = WORLD_VIEW;
  const { tileMargin: margin, tileSpacing: spacing, seam } = ground;
  const kinds = Object.keys(GROUND_TILES);
  const textureWidth = margin * 2 + kinds.length * (width + spacing) - spacing;
  const texture = textures.createCanvas(GROUND_TEXTURE, textureWidth, height + margin * 2);
  const ctx = texture.context;
  kinds.forEach((kind, index) => {
    const left = margin + index * (width + spacing);
    const top = margin;
    // Allargato di grow in alto e in basso, e di quanto serve ai lati perché i bordi restino paralleli
    const diamond = (grow) => [
      { x: left + width / 2, y: top - grow },
      { x: left + width + (grow * width) / height, y: top + height / 2 },
      { x: left + width / 2, y: top + height + grow },
      { x: left - (grow * width) / height, y: top + height / 2 },
    ];
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();
    fillPolygon(ctx, ground[kind], diamond(seam));
    if (kind === 'territory') strokePolygon(ctx, ground.grid, ground.gridWidth, diamond(0));
    if (kind === 'road') strokePolygon(ctx, ground.roadEdge, ground.gridWidth, diamond(0));
    ctx.restore();
  });
  texture.refresh();
}

// Gli edifici e i loro cantieri in fila, ognuno nel suo riquadro
function drawBuildings(textures) {
  const frames = [];
  for (const [id, building] of Object.entries(VILLAGE.buildings)) {
    const [cols, rows] = building.size;
    const parts = WORLD_VIEW.buildings[id];
    frames.push({ name: id, cols, rows, top: buildingHeight(id), draw: (pen) => drawParts(pen, parts) });
    frames.push({ name: siteFrame(id), cols, rows, top: siteHeight(), draw: (pen) => drawSite(pen, cols, rows) });
  }
  drawAtlas(textures, BUILDING_ATLAS, frames);
}

// I segni della strada, ognuno su una cella
function drawRoadMarkers(textures) {
  const frames = Object.entries(WORLD_VIEW.road.markers).map(([name, parts]) => ({
    name,
    cols: 1,
    rows: 1,
    top: partsHeight(parts),
    draw: (pen) => drawParts(pen, parts),
  }));
  drawAtlas(textures, ROAD_ATLAS, frames);
}

// I riquadri frames in fila nell'atlante key, con un margine vuoto tra uno e l'altro, su righe larghe al massimo
// WORLD_VIEW.atlasMaxWidth: ognuno è un posto di cols × rows celle alto top pixel, disegnato da draw con la penna del
// suo riquadro
function drawAtlas(textures, key, frames) {
  const scale = WORLD_VIEW.textureScale;
  let x = PADDING;
  let y = PADDING;
  let rowHeight = 0;
  let width = 0;
  for (const frame of frames) {
    frame.width = Math.ceil((frame.cols + frame.rows) * HALF_W * scale) + PADDING * 2;
    frame.height = Math.ceil((frame.top + (frame.cols + frame.rows) * HALF_H) * scale) + PADDING * 2;
    if (x > PADDING && x + frame.width > WORLD_VIEW.atlasMaxWidth) {
      x = PADDING;
      y += rowHeight + PADDING;
      rowHeight = 0;
    }
    frame.x = x;
    frame.y = y;
    x += frame.width + PADDING;
    rowHeight = Math.max(rowHeight, frame.height);
    width = Math.max(width, x);
  }
  const texture = textures.createCanvas(key, width, y + rowHeight + PADDING);
  const ctx = texture.context;
  for (const frame of frames) {
    // Il punto (col, row) del posto, alto z pixel sopra il terreno, nel riquadro
    const at = (col, row, z) => ({
      x: frame.x + PADDING + (frame.rows + col - row) * HALF_W * scale,
      y: frame.y + PADDING + (frame.top - z + (col + row) * HALF_H) * scale,
    });
    frame.draw({ ctx, at });
    const center = at(frame.cols / 2, frame.rows / 2, 0);
    const added = texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
    added.customPivot = true;
    added.pivotX = (center.x - frame.x) / frame.width;
    added.pivotY = (center.y - frame.y) / frame.height;
  }
  texture.refresh();
}

// Fin dove arrivano i pezzi parts sopra il terreno, in pixel del mondo (con le scritte sopra)
function partsHeight(parts) {
  return Math.max(...parts.map((part) => part.base + part.height + (part.roof?.height ?? part.label?.size ?? 0)));
}

function drawParts(pen, parts) {
  for (const part of parts) {
    drawBox(pen, part.at, part.base, part.height, part.colors);
    if (part.stripes) drawStripes(pen, part);
    if (part.roof) drawRoof(pen, part);
    if (part.flag) drawFlag(pen, part);
    if (part.label) drawLabel(pen, part);
  }
}

// Una scritta dritta appena sopra il pezzo, al centro
function drawLabel({ ctx, at }, { at: [col, row, cols, rows], base, height, label }) {
  const top = at(col + cols / 2, row + rows / 2, base + height);
  ctx.fillStyle = hex(label.color);
  ctx.font = `bold ${label.size * WORLD_VIEW.textureScale}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label.text, top.x, top.y);
}

// Una bandiera appesa in cima al pezzo, verso destra
function drawFlag({ ctx, at }, { at: [col, row, cols, rows], base, height, flag }) {
  const top = at(col + cols / 2, row + rows / 2, base + height);
  const scale = WORLD_VIEW.textureScale;
  const tip = { x: top.x + flag.width * scale, y: top.y + (flag.height * scale) / 2 };
  fillPolygon(ctx, flag.color, [top, tip, { x: top.x, y: top.y + flag.height * scale }]);
}

// Una scatola sul rettangolo rect ([col, row, cols, rows]), da base a base + height: si vedono la faccia a sinistra
// (dall'angolo ovest a quello sud), quella a destra (da sud a est) e il tetto piatto
function drawBox({ ctx, at }, rect, base, height, colors) {
  const faces = boxFaces(corners(at, rect, base), corners(at, rect, base + height));
  for (const [face, points] of faces) fillPolygon(ctx, colors[face], points);
}

// I quattro angoli alti z del rettangolo [col, row, cols, rows], rientrati di inset da ogni lato, nell'ordine nord,
// est, sud, ovest
function corners(at, [col, row, cols, rows], z, inset = 0) {
  return [
    at(col + inset, row + inset, z),
    at(col + cols - inset, row + inset, z),
    at(col + cols - inset, row + rows - inset, z),
    at(col + inset, row + rows - inset, z),
  ];
}

// File sopra il pezzo, da un lato all'altro lungo le righe
function drawStripes({ ctx, at }, { at: [col, row, cols, rows], base, height, stripes }) {
  const top = base + height;
  ctx.strokeStyle = hex(stripes.color);
  ctx.lineWidth = stripes.width;
  for (let index = 1; index < stripes.count; index++) {
    const across = col + (cols * index) / stripes.count;
    const from = at(across, row, top);
    const to = at(across, row + rows, top);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
}

// Tetto a punta sopra il pezzo: prima le due falde dietro, poi quelle davanti
function drawRoof({ ctx, at }, { at: rect, base, height, roof }) {
  const [col, row, cols, rows] = rect;
  const top = base + height;
  const [north, east, south, west] = corners(at, rect, top);
  const peak = at(col + cols / 2, row + rows / 2, top + roof.height);
  fillPolygon(ctx, roof.colors.back, [west, north, peak]);
  fillPolygon(ctx, roof.colors.back, [north, east, peak]);
  fillPolygon(ctx, roof.colors.left, [west, south, peak]);
  fillPolygon(ctx, roof.colors.right, [south, east, peak]);
}

// Cantiere: il terreno battuto, i pali dietro, l'impalcatura tra le cime, poi i pali davanti
function drawSite(pen, cols, rows) {
  const { plot, post, frame } = WORLD_VIEW.site;
  const rect = [0, 0, cols, rows];
  drawBox(pen, rect, 0, plot.height, plot.colors);
  const size = post.size;
  const posts = [
    [0, 0],
    [cols - size, 0],
    [0, rows - size],
    [cols - size, rows - size],
  ];
  const drawPost = ([col, row]) => drawBox(pen, [col, row, size, size], plot.height, post.height, post.colors);
  posts.slice(0, 3).forEach(drawPost);
  const { ctx, at } = pen;
  // Le cime dei pali, e sotto i loro piedi sul terreno battuto: gli angoli del posto rientrati di mezzo palo
  const middle = size / 2;
  const tops = corners(at, rect, plot.height + post.height, middle);
  strokePolygon(ctx, frame.color, frame.width, tops);
  // Una croce sulle due facce davanti
  const [, east, south, west] = corners(at, rect, plot.height, middle);
  strokeLine(ctx, frame.color, frame.width, west, tops[2]);
  strokeLine(ctx, frame.color, frame.width, south, tops[3]);
  strokeLine(ctx, frame.color, frame.width, east, tops[2]);
  strokeLine(ctx, frame.color, frame.width, south, tops[1]);
  drawPost(posts[3]);
}

function strokePolygon(ctx, color, width, points) {
  ctx.strokeStyle = hex(color);
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(({ x, y }, index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.stroke();
}

function strokeLine(ctx, color, width, from, to) {
  ctx.strokeStyle = hex(color);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
