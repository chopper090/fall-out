import { createFpsOverlay } from './fpsOverlay.js';
import { createDebugPanel } from './debugPanel.js';

// Avvia gli strumenti di debug
export function setupDebug(game) {
  createFpsOverlay(game);
  createDebugPanel(() => game.scene.getScene('Battle').scene.restart());
}
