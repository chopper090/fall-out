import { ICONS } from '../config/balance.js';

// Le icone provvisorie (config/icons.js) disegnate con le forme di una grafica di Phaser: l'icona name con il centro in
// (x, y), larga e alta size pixel, del colore color (con l'opacità alpha)
export function drawIcon(graphics, name, { x, y, size, color, alpha = 1 }) {
  const scale = size / 100;
  const at = (value) => value * scale;
  graphics.fillStyle(color, alpha);
  for (const shape of ICONS[name]) {
    if (shape.type === 'circle') graphics.fillCircle(x + at(shape.x), y + at(shape.y), at(shape.r));
    if (shape.type === 'ring') {
      graphics.lineStyle(at(shape.width), color, alpha);
      graphics.strokeCircle(x + at(shape.x), y + at(shape.y), at(shape.r));
    }
    if (shape.type === 'rect') {
      const { w, h } = shape;
      graphics.fillRoundedRect(x + at(shape.x - w / 2), y + at(shape.y - h / 2), at(w), at(h), at(shape.r ?? 0));
    }
    if (shape.type === 'line') {
      graphics.lineStyle(at(shape.width), color, alpha);
      graphics.lineBetween(x + at(shape.x1), y + at(shape.y1), x + at(shape.x2), y + at(shape.y2));
    }
    if (shape.type === 'poly') {
      const points = [];
      for (let index = 0; index < shape.points.length; index += 2) {
        points.push({ x: x + at(shape.points[index]), y: y + at(shape.points[index + 1]) });
      }
      graphics.fillPoints(points, true);
    }
  }
}
