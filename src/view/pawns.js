import { ENEMY_SHOT, HERO, PAWNS, PLATOONS } from '../config/balance.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { CATEGORIES, HEROES, RARITIES } from '../data/heroes.js';
import { ELITE, WEAPONS } from '../data/units.js';
import { artImage } from './art.js';
import { fillPolygon, hex } from './canvas.js';

// Atlante delle pedine: ogni tipo è disegnato una volta, in piedi e visto un po' dall'alto, in un'unica
// immagine, così Phaser le disegna tutte insieme anche sui telefoni. Ogni riquadro sa dov'è il suo punto
// d'appoggio (il centro della base): chi lo mostra lo mette sul punto del terreno dove sta la pedina.
// Una pedina con il suo disegno vero (view/art.js, gruppo pawns: il nome del riquadro; un eroe anche quello della sua
// categoria, categoryFrame) lo ha al posto della figura fatta dal codice, nello stesso riquadro e con lo stesso punto
// d'appoggio. La texture appartiene al gioco e resta tra una partita e l'altra: si disegna solo la prima volta
export const PAWN_ATLAS = 'pawns';

// Un soldato per ogni arma (quelli con l'arma élite sono le élite, più grandi), un eroe per ognuno (stessa sagoma,
// segno e colori della sua categoria, la base del colore della sua rarità), poi un tipo per ogni nemico: il nome è
// anche quello del riquadro; art, i nomi dei disegni veri che possono prenderne il posto, nell'ordine
const KINDS = {
  ...Object.fromEntries(
    Object.entries(WEAPONS).map(([name, weapon]) => [
      soldierFrame(name),
      {
        size: name === ELITE.weapon ? ELITE.size : PLATOONS.soldierSize,
        height: name === ELITE.weapon ? ELITE.height : PLATOONS.soldierHeight,
        colors: weapon.soldierColors,
        shape: PAWNS.shapes[soldierFrame(name)],
        art: [soldierFrame(name)],
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.values(HEROES).map((hero) => [
      heroFrame(hero),
      {
        size: HERO.size,
        height: HERO.height,
        colors: hero.colors,
        rim: RARITIES[hero.rarity].rim,
        shape: { ...PAWNS.shapes.hero, detail: hero.detail },
        art: [heroFrame(hero), categoryFrame(hero.category)],
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ENEMY_TYPES).map(([name, type]) => [
      name,
      { size: type.size, height: type.height, colors: type.colors, shape: PAWNS.shapes[name], art: [name] },
    ]),
  ),
};
const ENEMY_FRAMES = new Map(Object.entries(ENEMY_TYPES).map(([type, data]) => [data, type]));

// Riquadro dei soldati che usano l'arma con questo nome
export function soldierFrame(weaponName) {
  return `${weaponName}Soldier`;
}

// Riquadro di un eroe
export function heroFrame(hero) {
  return `${hero.id}Hero`;
}

// Nome del disegno vero di tutti gli eroi della categoria category (data/heroes.js CATEGORIES)
export function categoryFrame(category) {
  return `${category}Hero`;
}

// Misura in pixel della figura del riquadro name senza il margine, quella a cui si carica il suo disegno vero
// (scenes/Preload.js); name può essere anche il disegno di una categoria di eroi (categoryFrame). Null se non c'è
export function pawnArtSize(name) {
  const isCategory = Object.keys(CATEGORIES).some((category) => categoryFrame(category) === name);
  const kind = KINDS[name] ?? (isCategory ? { size: HERO.size, height: HERO.height } : null);
  if (kind === null) return null;
  const { textureScale } = PAWNS;
  return { width: Math.ceil(kind.size * textureScale), height: Math.ceil(kind.height * textureScale) };
}

// Riquadro dei colpi di un'arma
export function shotFrame(weapon) {
  return `${weapon.name}Shot`;
}

// Riquadro dell'atlante di un tipo di nemico
export function enemyFrame(type) {
  return ENEMY_FRAMES.get(type);
}

// Quanto la cima della pedina sta sopra il suo punto d'appoggio, in unità del mondo
export function pawnTop(name) {
  const { size, height, shape } = KINDS[name];
  return height - (shape.base * size) / 2;
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
  // Colpi: quelli di ogni arma e quello dei nemici, palline dei loro colori
  const balls = [
    ...Object.values(WEAPONS).map((weapon) => ({ name: shotFrame(weapon), size: weapon.size, colors: weapon.colors })),
    { name: 'enemyShot', size: ENEMY_SHOT.size, colors: ENEMY_SHOT.colors },
  ].map((ball) => ({ ...ball, width: Math.ceil(ball.size * textureScale) + padding * 2 }));
  for (const ball of balls) ball.height = ball.width;

  // Riquadri in file, uno accanto all'altro con un margine vuoto tra uno e l'altro, a capo quando la fila passerebbe
  // PAWNS.atlasWidth (le texture troppo larghe i telefoni non le caricano)
  let x = padding;
  let top = 0;
  let rowHeight = 0;
  for (const frame of [...frames, ...balls]) {
    if (x + frame.width > PAWNS.atlasWidth) {
      x = padding;
      top += rowHeight + padding;
      rowHeight = 0;
    }
    frame.x = x;
    frame.y = top;
    x += frame.width + padding;
    rowHeight = Math.max(rowHeight, frame.height);
  }
  const all = [...frames, ...balls];
  const atlasWidth = Math.max(...all.map((frame) => frame.x + frame.width)) + padding;
  const texture = textures.createCanvas(PAWN_ATLAS, atlasWidth, top + rowHeight);
  const ctx = texture.context;

  // Ogni riquadro si disegna come se la sua fila fosse in cima: lo si sposta giù della sua fila
  const inRow = (frame, draw) => {
    ctx.save();
    ctx.translate(0, frame.y);
    const result = draw();
    ctx.restore();
    return result;
  };
  for (const frame of frames) {
    const art = artImage(textures, 'pawns', frame.art);
    inRow(frame, () => (art === null ? drawPawn(ctx, frame, frame.shape) : drawArt(ctx, frame, art)));
    setPivot(
      texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height),
      0.5,
      baseOf(frame) / frame.height,
    );
  }
  for (const ball of balls) {
    inRow(ball, () => drawBall(ctx, ball));
    setPivot(texture.add(ball.name, 0, ball.x, ball.y, ball.width, ball.height), 0.5, 0.5);
  }
  texture.refresh();
}

// Il disegno vero image nel riquadro della pedina, senza il margine
function drawArt(ctx, frame, image) {
  const { padding } = PAWNS;
  ctx.drawImage(image, frame.x + padding, padding, frame.width - padding * 2, frame.height - padding * 2);
}

// Altezza del punto d'appoggio nel riquadro (dall'alto): il centro della base, mezza base sopra il fondo della figura
function baseOf(frame) {
  const { padding } = PAWNS;
  return frame.height - padding - (frame.shape.base * (frame.width - padding * 2)) / 2;
}

function setPivot(frame, x, y) {
  frame.customPivot = true;
  frame.pivotX = x;
  frame.pivotY = y;
}

// Base tonda con il suo spessore (la faccia di sopra del colore della rarità, per gli eroi: rim), corpo che si stringe
// verso il collo, testa tonda con un riflesso.
// Il fianco destro del corpo è più scuro, per dare volume. Dettagli: collare (capo, guardiano), elmo piatto
// (corazzato, difensore, granatiere e soldato con il lanciatore), corona (élite nemica, veterano), canna (tiratore,
// esploratore), corna (boss), pennacchio (cecchino, tiratore scelto e truppe élite), fascia (fuciliere). Il punto
// d'appoggio è al centro della base (baseOf)
function drawPawn(ctx, frame, shape) {
  const { padding } = PAWNS;
  const { colors } = frame;
  const width = frame.width - padding * 2;
  const left = frame.x + padding;
  const cx = left + width / 2;
  const baseRy = (shape.base * width) / 2;
  const thickness = PAWNS.baseThickness * width;
  const baseY = baseOf(frame);
  const baseTop = baseY - thickness;
  const headR = shape.head * width;
  // Corona, elmo e corna sporgono sopra la testa: la testa scende di quanto sporgono
  const crownHeight = shape.detail === 'crown' ? PAWNS.crown.height * width : 0;
  const capHeight = shape.detail === 'helmet' ? PAWNS.helmet.brim * headR : 0;
  const hornHeight = shape.detail === 'horns' ? (PAWNS.horns.tip[1] - 1) * headR : 0;
  const plumeHeight = shape.detail === 'plume' ? PAWNS.plume.height * headR : 0;
  const headY = padding + crownHeight + capHeight + hornHeight + plumeHeight + headR;
  const neckY = headY + headR * PAWNS.neckDrop;

  fillEllipse(ctx, colors.side, cx, baseY, width / 2, baseRy);
  ctx.fillStyle = hex(colors.side);
  ctx.fillRect(left, baseTop, width, thickness);
  if (frame.rim === undefined) fillEllipse(ctx, colors.top, cx, baseTop, width / 2, baseRy);
  else fillRim(ctx, frame.rim, cx, baseTop, width / 2, baseRy);

  const waist = (shape.waist * width) / 2;
  const neck = (shape.neck * width) / 2;
  fillPolygon(ctx, colors.side, [
    { x: cx - waist, y: baseTop },
    { x: cx + waist, y: baseTop },
    { x: cx + neck, y: neckY },
    { x: cx - neck, y: neckY },
  ]);
  const lit = 1 - PAWNS.shadeShare;
  fillPolygon(ctx, colors.front, [
    { x: cx - waist, y: baseTop },
    { x: cx - waist + 2 * waist * lit, y: baseTop },
    { x: cx - neck + 2 * neck * lit, y: neckY },
    { x: cx - neck, y: neckY },
  ]);
  if (shape.detail === 'collar') {
    fillEllipse(ctx, colors.top, cx, neckY, neck * PAWNS.collar.width, headR * PAWNS.collar.height);
  }

  if (shape.detail === 'horns') drawHorns(ctx, colors, cx, headY, headR);
  if (shape.detail === 'helmet') drawHelmet(ctx, colors, cx, headY, headR);
  else drawHead(ctx, colors, cx, headY, headR);
  if (shape.detail === 'crown') drawCrown(ctx, colors, cx, headY - headR, headR, crownHeight);
  if (shape.detail === 'plume') drawPlume(ctx, colors, cx, headY - headR, headR, plumeHeight);
  if (shape.detail === 'muzzle') drawMuzzle(ctx, colors, cx, headY, headR);
  if (shape.detail === 'band') drawBand(ctx, colors, cx, headY, headR);

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
    { x: cx - half, y: foot },
    { x: cx - half, y: headTop - crownHeight },
    { x: cx - half / 2, y: headTop - crownHeight / 3 },
    { x: cx, y: headTop - crownHeight },
    { x: cx + half / 2, y: headTop - crownHeight / 3 },
    { x: cx + half, y: headTop - crownHeight },
    { x: cx + half, y: foot },
  ]);
}

// Corna: due punte che partono dai lati della testa e salgono verso l'esterno. Si disegnano prima della testa,
// che ne copre la radice. Punti in raggi della testa, dal suo centro: x verso l'esterno, y verso l'alto
function drawHorns(ctx, colors, cx, cy, radius) {
  const { inner, outer, tip } = PAWNS.horns;
  for (const side of [-1, 1]) {
    fillPolygon(
      ctx,
      colors.top,
      [inner, outer, tip].map(([x, y]) => ({ x: cx + side * x * radius, y: cy - y * radius })),
    );
  }
}

// Pennacchio: una punta sottile sopra la testa
function drawPlume(ctx, colors, cx, headTop, radius, plumeHeight) {
  const half = radius * PAWNS.plume.width;
  const foot = headTop + radius * PAWNS.plume.sink;
  fillPolygon(ctx, colors.top, [
    { x: cx - half, y: foot },
    { x: cx + half, y: foot },
    { x: cx, y: headTop - plumeHeight },
  ]);
}

// Canna puntata verso di noi al posto della faccia: un bordo scuro e il foro nero
function drawMuzzle(ctx, colors, cx, cy, radius) {
  const { ring, hole, holeColor } = PAWNS.muzzle;
  fillEllipse(ctx, colors.side, cx, cy, radius * ring, radius * ring);
  fillEllipse(ctx, holeColor, cx, cy, radius * hole, radius * hole);
}

// Fascia: una striscia scura attorno alla testa, poco sopra il centro, tagliata sul bordo della testa
function drawBand(ctx, colors, cx, cy, radius) {
  const { height, offset } = PAWNS.band;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = hex(colors.side);
  ctx.fillRect(cx - radius, cy + radius * (offset - height / 2), radius * 2, radius * height);
  ctx.restore();
}

// Colpo: una pallina con il suo riflesso
function drawBall(ctx, frame) {
  const radius = frame.width / 2 - PAWNS.padding;
  const cx = frame.x + frame.width / 2;
  const cy = frame.height / 2;
  drawHead(ctx, frame.colors, cx, cy, radius);
}

function fillEllipse(ctx, color, cx, cy, rx, ry) {
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Ellisse dei colori colors: uno solo pieno, più di uno sfumati da sinistra a destra
function fillRim(ctx, colors, cx, cy, rx, ry) {
  if (colors.length === 1) {
    fillEllipse(ctx, colors[0], cx, cy, rx, ry);
    return;
  }
  const gradient = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
  colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), hex(color)));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
