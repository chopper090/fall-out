import { createFpsOverlay } from './fpsOverlay.js';
import { createDebugPanel } from './debugPanel.js';
import { createErrorReport } from './errorReport.js';
import { createMetaPanel } from './metaPanel.js';
import { createPlaytest } from './playtest.js';

// Avvia gli strumenti di sviluppo, compreso il test delle partite di fila con la sua cartella nel pannello, nella
// prima cartella i trucchi di prova sul meta-gioco e sopra di lei il registro degli errori. Il menu delle impostazioni
// li trova nel registro del gioco (devTools) e da lì apre e chiude il pannello. Ricomincia la partita vale solo con una
// battaglia in corso
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
  game.registry.set('devTools', {
    toggle() {
      pane.hidden = !pane.hidden;
    },
  });
}
