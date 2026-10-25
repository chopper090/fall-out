import { FX, WORLD_VIEW } from '../config/balance.js';

// Effetti del mondo (scenes/World.js), spenti da FX.enabled: il premio di una raccolta che sale e sfuma sopra la sua
// casella, grande uguale sullo schermo a ogni zoom, e la nebbia di un'area che cambia piano piano

// La scritta text sale dal punto del mondo (x, y) e sfuma
export function floatGain(scene, x, y, text) {
  if (!FX.enabled) return;
  const { durationMs, rise, style } = FX.worldGain;
  const zoom = scene.cameras.main.zoom;
  const label = scene.add.text(x, y, text, style).setOrigin(0.5, 1).setScale(1 / zoom);
  label.setDepth(WORLD_VIEW.depth.overlays);
  const destroy = () => label.destroy();
  scene.tweens.add({ targets: label, y: y - rise / zoom, alpha: 0, duration: durationMs, onComplete: destroy });
}

// La nebbia graphics passa dalla trasparenza from a to (senza effetti, subito)
export function fadeFog(scene, graphics, from, to) {
  if (!FX.enabled) {
    graphics.setAlpha(to);
    return;
  }
  graphics.setAlpha(from);
  scene.tweens.add({ targets: graphics, alpha: to, duration: FX.fogReveal.durationMs });
}
