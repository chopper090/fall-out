import { HERO, PAWNS, PLATOONS, WEAPON } from '../config/balance.js';
import { ENEMY_TYPES } from '../data/enemies.js';

// Atlante delle pedine: ogni tipo è disegnato una volta, in piedi e visto un po' dall'alto, in un'unica
// immagine, così Phaser le disegna tutte insieme anche sui telefoni. Ogni riquadro sa dov'è il suo punto
// d'appoggio (il centro della base): chi lo mostra lo mette sul punto del terreno dove sta la pedina.
// La texture appartiene al gioco e resta tra una partita e l'altra: si disegna solo la prima volta
export const PAWN_ATLAS = 'pawns';

// Soldato ed eroe, poi un tipo per ogni nemico: il nome è anche quello del riquadro
const KINDS = {
  soldier: { size: PLATOONS.soldierSize, height: PLATOONS.soldierHeight, colors: HERO.colors },
  hero: { size: HERO.size, height: HERO.height, colors: HERO.colors },
  ...Object.fromEntries(
    Object.entries(ENEMY_TYPES).map(([name, type]) => [name, { size: type.size, height: type.height, colors: type.colors }]),
  ),
};
const ENEMY_FRAMES = new Map(Object.entries(ENEMY_TYPES).map(([name, type]) => [type, name]));

// Riquadro dell'atlante di un tipo di nemico
export function enemyFrame(type) {
  return ENEMY_FRAMES.get(type);
}

// Quanto la cima della pedina sta sopra il suo punto d'appoggio, in unità del mondo
export function pawnTop(name) {
  const { size, height } = KINDS[name];
  return height - (PAWNS.shapes[name].base * size) / 2;
}

export function createPawnAtlas(textures) {
  if (textures.exists(PAWN_ATLAS)) return;
  const { textureScale, padding } = PAWNS;
  const frames = Object.entries(KINDS).map(([name, kind]) => ({
    name,
    ...kind,
    width: Math.ceil(kind.size * textureScale) + padding * 2,
    height: Math.ceil(kind.height * textureScale) + padding * 2,
  }));
  const shot = { name: 'shot', width: Math.ceil(WEAPON.size * textureScale) + padding * 2 };
  shot.height = shot.width;

  // Riquadri in fila, uno accanto all'altro, con un margine vuoto tra uno e l'altro
  let x = padding;
  for (const frame of [...frames, shot]) {
    frame.x = x;
    x += frame.width + padding;
  }
  const atlasHeight = Math.max(...frames.map((frame) => frame.height));
  const texture = textures.createCanvas(PAWN_ATLAS, x, atlasHeight);
  const ctx = texture.context;

  for (const frame of frames) {
    const baseY = drawPawn(ctx, frame, PAWNS.shapes[frame.name]);
    setPivot(texture.add(frame.name, 0, frame.x, 0, frame.width, frame.height), 0.5, baseY / frame.height);
  }
  drawShot(ctx, shot);
  setPivot(texture.add(shot.name, 0, shot.x, 0, shot.width, shot.height), 0.5, 0.5);
  texture.refresh();
}

function setPivot(frame, x, y) {
  frame.customPivot = true;
  frame.pivotX = x;
  frame.pivotY = y;
}

// Base tonda con il suo spessore, corpo che si stringe verso il collo, testa tonda con un riflesso.
// Il fianco destro del corpo è più scuro, per dare volume. Dettagli: collare (eroe),
// elmo piatto (corazzato), corona (élite). Restituisce l'altezza del punto d'appoggio nel riquadro
function drawPawn(ctx, frame, shape) {
  const { padding } = PAWNS;
  const { colors } = frame;
  const width = frame.width - padding * 2;
  const height = frame.height - padding * 2;
  const left = frame.x + padding;
  const cx = left + width / 2;
  const baseRy = (shape.base * width) / 2;
  const thickness = PAWNS.baseThickness * width;
  const baseY = padding + height - baseRy;
  const baseTop = baseY - thickness;
  const headR = shape.head * width;
  // Corona ed elmo sporgono sopra la testa: la testa scende di quanto sporgono
  const crownHeight = shape.detail === 'crown' ? PAWNS.crown.height * width : 0;
  const capHeight = shape.detail === 'helmet' ? PAWNS.helmet.brim * headR : 0;
  const headY = padding + crownHeight + capHeight + headR;
  const neckY = headY + headR * PAWNS.neckDrop;

  fillEllipse(ctx, colors.side, cx, baseY, width / 2, baseRy);
  ctx.fillStyle = hex(colors.side);
  ctx.fillRect(left, baseTop, width, thickness);
  fillEllipse(ctx, colors.top, cx, baseTop, width / 2, baseRy);

  const waist = (shape.waist * width) / 2;
  const neck = (shape.neck * width) / 2;
  fillPolygon(ctx, colors.side, [
    [cx - waist, baseTop],
    [cx + waist, baseTop],
    [cx + neck, neckY],
    [cx - neck, neckY],
  ]);
  const lit = 1 - PAWNS.shadeShare;
  fillPolygon(ctx, colors.front, [
    [cx - waist, baseTop],
    [cx - waist + 2 * waist * lit, baseTop],
    [cx - neck + 2 * neck * lit, neckY],
    [cx - neck, neckY],
  ]);
  if (shape.detail === 'collar') {
    fillEllipse(ctx, colors.top, cx, neckY, neck * PAWNS.collar.width, headR * PAWNS.collar.height);
  }

  if (shape.detail === 'helmet') drawHelmet(ctx, colors, cx, headY, headR);
  else drawHead(ctx, colors, cx, headY, headR);
  if (shape.detail === 'crown') drawCrown(ctx, colors, cx, headY - headR, headR, crownHeight);

  return baseY;
}

function drawHead(ctx, colors, cx, cy, radius) {
  const { offset, size } = PAWNS.highlight;
  fillEllipse(ctx, colors.front, cx, cy, radius, radius);
  fillEllipse(ctx, colors.top, cx - radius * offset, cy - radius * offset, radius * size, radius * size);
}

// Elmo piatto: un cilindro basso con la tesa più larga e più scura
function drawHelmet(ctx, colors, cx, cy, radius) {
  const { width, height, brim } = PAWNS.helmet;
  const half = radius * width;
  ctx.fillStyle = hex(colors.front);
  ctx.fillRect(cx - half, cy - radius, half * 2, radius * height);
  fillEllipse(ctx, colors.top, cx, cy - radius, half, radius * brim);
  fillEllipse(ctx, colors.side, cx, cy - radius + radius * height, half * PAWNS.helmet.rim, radius * brim);
}

// Corona a tre punte appoggiata sulla testa
function drawCrown(ctx, colors, cx, headTop, radius, crownHeight) {
  const half = radius * PAWNS.crown.width;
  const foot = headTop + radius * PAWNS.crown.sink;
  fillPolygon(ctx, colors.top, [
    [cx - half, foot],
    [cx - half, headTop - crownHeight],
    [cx - half / 2, headTop - crownHeight / 3],
    [cx, headTop - crownHeight],
    [cx + half / 2, headTop - crownHeight / 3],
    [cx + half, headTop - crownHeight],
    [cx + half, foot],
  ]);
}

// Colpo: una pallina con il suo riflesso
function drawShot(ctx, frame) {
  const radius = frame.width / 2 - PAWNS.padding;
  const cx = frame.x + frame.width / 2;
  const cy = frame.height / 2;
  drawHead(ctx, WEAPON.colors, cx, cy, radius);
}

function fillEllipse(ctx, color, cx, cy, rx, ry) {
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillPolygon(ctx, color, points) {
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function hex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}
