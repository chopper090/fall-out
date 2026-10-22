import { Pane } from 'tweakpane';
import { CONTROLS, DEBUG } from '../config/balance.js';

// Pannello Tweakpane, chiuso all'avvio: si apre e si chiude toccando la barra del titolo.
// Gli slider modificano direttamente i valori di balance.js mentre il gioco gira
export function createDebugPanel() {
  const pane = new Pane({ title: DEBUG.panelTitle, expanded: false });

  const { title, fields } = DEBUG.controlsFolder;
  const folder = pane.addFolder({ title });
  Object.entries(fields).forEach(([key, options]) => folder.addBinding(CONTROLS, key, options));

  return pane;
}
