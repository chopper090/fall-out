import { createFpsOverlay } from './fpsOverlay.js';
import { createDebugPanel } from './debugPanel.js';

// Avvia gli strumenti di sviluppo. Il menu delle impostazioni li trova nel registro del gioco (devTools)
// e da lì apre e chiude il pannello
export function setupDebug(game) {
  createFpsOverlay(game);
  const pane = createDebugPanel(() => game.scene.getScene('Battle').scene.restart());
  game.registry.set('devTools', {
    toggle() {
      pane.hidden = !pane.hidden;
    },
  });
}
