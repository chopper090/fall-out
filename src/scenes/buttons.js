import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';

// Pulsante arrotondato delle schermate fuori dalla battaglia (schieramento, eroi): largo width e alto height intorno
// a (x, y), del colore color, con la scritta al centro; agisce quando il dito si alza sopra di lui. Spento (enabled
// false) è più trasparente e non agisce
export function addButton(scene, { x, y, width, height, label, color, onTap, enabled = true }) {
  const { radius, style, disabledAlpha } = HUD.screenButton;
  const alpha = enabled ? 1 : disabledAlpha;
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, alpha);
  graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  scene.add.text(x, y, label, style).setOrigin(0.5).setAlpha(alpha);
  const zone = scene.add.zone(x, y, width, height).setInteractive();
  if (enabled) zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
}
