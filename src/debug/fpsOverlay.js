import * as Phaser from 'phaser';
import { DEBUG } from '../config/balance.js';

// Mostra gli FPS reali in alto a sinistra, aggiornati a intervalli regolari
export function createFpsOverlay(game) {
  const { refreshMs, margin, padding, font, color, background } = DEBUG.fpsOverlay;

  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed',
    top: margin,
    left: margin,
    padding,
    font,
    color,
    background,
    pointerEvents: 'none',
  });
  document.body.appendChild(label);

  let elapsed = refreshMs;
  game.events.on(Phaser.Core.Events.POST_STEP, (time, delta) => {
    elapsed += delta;
    if (elapsed < refreshMs) return;
    elapsed = 0;
    label.textContent = `FPS ${Math.round(game.loop.actualFps)}`;
  });
}
