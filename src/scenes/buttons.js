import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';

// Pulsante arrotondato delle schermate fuori dalla battaglia (mappa, schieramento, eroi): largo width e alto height
// intorno a (x, y), del colore color, con la scritta al centro; agisce quando il dito si alza sopra di lui. Spento
// (enabled false) è più trasparente e non agisce
export function addButton(scene, spec) {
  const { x, y, width, height, onTap, enabled = true } = spec;
  drawButton(scene, spec);
  const zone = scene.add.zone(x, y, width, height).setInteractive();
  if (enabled) zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
}

// Pulsanti uguali a quelli di addButton per una scena che sta sopra un'altra che deve ricevere i tocchi (l'interfaccia
// del mondo): non sono oggetti interattivi di Phaser, che terrebbero per sé i tocchi; ognuno agisce se il dito si
// appoggia e si alza sopra di lui (non se il telefono annulla il tocco). Rettangoli { x, y, width, height } intorno al
// centro: area è un posto da toccare senza disegno, block un riquadro che non fa niente. Tutti coprono la scena sotto:
// covers dice se un punto dello schermo ci cade sopra
export function createButtonBoard(scene) {
  let buttons = [];
  let blocks = [];
  const inside = (rect, x, y) => Math.abs(x - rect.x) <= rect.width / 2 && Math.abs(y - rect.y) <= rect.height / 2;
  scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer) => {
    if (pointer.wasCanceled) return;
    const pressed = (button) => inside(button, pointer.downX, pointer.downY) && inside(button, pointer.x, pointer.y);
    buttons.find((button) => button.enabled !== false && pressed(button))?.onTap();
  });
  return {
    add(spec) {
      drawButton(scene, spec);
      buttons.push(spec);
    },
    area(spec) {
      buttons.push(spec);
    },
    block(rect) {
      blocks.push(rect);
    },
    clear() {
      buttons = [];
      blocks = [];
    },
    covers(x, y) {
      return buttons.some((button) => inside(button, x, y)) || blocks.some((block) => inside(block, x, y));
    },
  };
}

function drawButton(scene, { x, y, width, height, label, color, enabled = true }) {
  const { radius, style, disabledAlpha } = HUD.screenButton;
  const alpha = enabled ? 1 : disabledAlpha;
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, alpha);
  graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  scene.add.text(x, y, label, style).setOrigin(0.5).setAlpha(alpha);
}
