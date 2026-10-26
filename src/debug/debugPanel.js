import { Pane } from 'tweakpane';
import { DEBUG } from '../config/balance.js';

// Pannello Tweakpane, nascosto all'avvio: lo mostra la sezione Sviluppo delle impostazioni.
// Si riduce toccando la barra del titolo; le cartelle partono chiuse, così sul telefono non copre il gioco.
// Gli slider (DEBUG.folders, config/debug.js) modificano direttamente i valori di config/ e data/ mentre il gioco
// gira; il pulsante in fondo fa ripartire la partita, per provare subito i valori "da prossima partita"
export function createDebugPanel(onRestart) {
  const pane = new Pane({ title: DEBUG.panelTitle });
  pane.hidden = true;

  DEBUG.folders.forEach(({ title, target, fields }) => {
    const folder = pane.addFolder({ title, expanded: false });
    Object.entries(fields).forEach(([key, options]) => folder.addBinding(target, key, options));
  });
  pane.addButton({ title: DEBUG.restartLabel }).on('click', onRestart);

  return pane;
}
