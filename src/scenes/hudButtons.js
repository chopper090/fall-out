import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';

// Pulsanti rotondi in basso: pausa a sinistra, ingranaggio delle impostazioni a destra.
// Un pulsante agisce solo se il dito si appoggia e si alza sopra di lui. Non sono oggetti interattivi:
// così uno swipe che ci passa sopra arriva comunque alla battaglia
export function createHudButtons(scene, { onPause, onSettings }) {
  const { pause, settings } = HUD.buttons;
  const graphics = scene.add.graphics();
  drawBase(graphics, pause);
  drawPauseIcon(graphics, pause);
  drawGearButton(graphics, settings);
  const actions = new Map([
    [pause, onPause],
    [settings, onSettings],
  ]);
  scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer) => {
    if (!graphics.visible) return;
    const pressed = buttonAt(pointer.downX, pointer.downY);
    if (pressed && pressed === buttonAt(pointer.x, pointer.y)) actions.get(pressed)();
  });

  return {
    setVisible(visible) {
      graphics.setVisible(visible);
    },
  };
}

// Un tocco partito sopra un pulsante non guida l'esercito
export function isOnHudButton(x, y) {
  return buttonAt(x, y) !== null;
}

function buttonAt(x, y) {
  const { radius, pause, settings } = HUD.buttons;
  return [pause, settings].find((button) => (x - button.x) ** 2 + (y - button.y) ** 2 <= radius ** 2) ?? null;
}

// Il pulsante rotondo con l'ingranaggio delle impostazioni, con il centro in (x, y): anche fuori dalla battaglia
// (scenes/buttons.js)
export function drawGearButton(graphics, { x, y }) {
  drawBase(graphics, { x, y });
  drawGearIcon(graphics, { x, y });
}

function drawBase(graphics, { x, y }) {
  const { radius, fill, fillAlpha, border, borderWidth } = HUD.buttons;
  graphics.fillStyle(fill, fillAlpha);
  graphics.fillCircle(x, y, radius);
  graphics.lineStyle(borderWidth, border);
  graphics.strokeCircle(x, y, radius);
}

// Due barre verticali
function drawPauseIcon(graphics, { x, y }) {
  const { icon, pauseBar } = HUD.buttons;
  const { width, height, gap } = pauseBar;
  graphics.fillStyle(icon);
  graphics.fillRect(x - gap / 2 - width, y - height / 2, width, height);
  graphics.fillRect(x + gap / 2, y - height / 2, width, height);
}

// Ruota dentata: per ogni dente il bordo sale dal raggio interno a quello esterno per metà del suo spicchio,
// poi un foro al centro del colore del pulsante
function drawGearIcon(graphics, { x, y }) {
  const { icon, fill, gear } = HUD.buttons;
  const { teeth, outer, inner, hole } = gear;
  const span = (Math.PI * 2) / teeth;
  const at = (radius, angle) => ({ x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle) });
  const points = [];
  for (let tooth = 0; tooth < teeth; tooth++) {
    const start = tooth * span;
    points.push(at(inner, start), at(outer, start), at(outer, start + span / 2), at(inner, start + span / 2));
  }
  graphics.fillStyle(icon);
  graphics.fillPoints(points, true);
  graphics.fillCircle(x, y, inner);
  graphics.fillStyle(fill);
  graphics.fillCircle(x, y, hole);
}
