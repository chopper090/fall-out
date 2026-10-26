import { setEventSource } from '../core/errorLog.js';
import { createFpsOverlay } from './fpsOverlay.js';
import { createDebugPanel } from './debugPanel.js';
import { createErrorReport } from './errorReport.js';
import { createEventLog } from './eventLog.js';
import { createMetaPanel } from './metaPanel.js';
import { createPlaytest } from './playtest.js';
import { createReplays } from './replay.js';

// Avvia gli strumenti di sviluppo, compreso il test delle partite di fila con la sua cartella nel pannello, nella
// prima cartella i trucchi di prova sul meta-gioco e sopra di lei il registro degli errori e l'ultima battaglia da
// rigiocare. Le battaglie si registrano, con il registro degli eventi che va in ogni errore: la scena della battaglia
// trova i loro strumenti nel registro del gioco (battleTools). Il menu delle impostazioni trova lì anche il pannello
// (devTools) e da lì lo apre e lo chiude. Ricomincia la partita vale solo con una battaglia in corso
export function setupDebug(game) {
  createFpsOverlay(game);
  const restart = () => {
    const battle = game.scene.getScene('Battle');
    if (battle.sys.isActive()) battle.scene.restart();
  };
  const pane = createDebugPanel(restart);
  createPlaytest(game, pane);
  createMetaPanel(game, pane);
  createErrorReport(pane);
  const events = createEventLog();
  setEventSource(events.entries);
  game.registry.set('battleTools', createReplays(pane, events));
  game.registry.set('devTools', {
    toggle() {
      pane.hidden = !pane.hidden;
    },
  });
}
