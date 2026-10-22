import { Pane } from 'tweakpane';
import { DEBUG } from '../config/balance.js';

// Pannello Tweakpane, chiuso all'avvio: si apre e si chiude toccando la barra del titolo
export function createDebugPanel() {
  return new Pane({ title: DEBUG.panelTitle, expanded: false });
}
