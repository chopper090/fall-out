import { Pane } from 'tweakpane';
import { DEBUG } from '../config/balance.js';

// Pannello Tweakpane, chiuso all'avvio: si apre e si chiude toccando la barra del titolo.
// Anche le cartelle partono chiuse, così sul telefono il pannello non copre il gioco.
// Gli slider modificano direttamente i valori di balance.js mentre il gioco gira
export function createDebugPanel() {
  const pane = new Pane({ title: DEBUG.panelTitle, expanded: false });

  DEBUG.folders.forEach(({ title, target, fields }) => {
    const folder = pane.addFolder({ title, expanded: false });
    Object.entries(fields).forEach(([key, options]) => folder.addBinding(target, key, options));
  });

  return pane;
}
