import { DEBUG } from '../config/balance.js';
import { exportSave, importSave } from '../core/save.js';
import { copyText, createCard, row, text, textBox } from './card.js';

// Il salvataggio save da copiare e da incollare, in una scheda sopra il gioco (debug/card.js, scritte in
// DEBUG.saveTransfer): per portarlo su un altro telefono o mandarlo a chi sviluppa. Si copia il testo di core/save.js
// exportSave; quello incollato lo controlla importSave, che tiene quello di adesso nella copia di riserva, e poi la
// pagina si ricarica, così nessuna scena resta con il profilo di prima. Sul telefono, con il server di sviluppo (http),
// gli appunti non si leggono: il testo si incolla a mano nella casella
export function createSaveTransfer(save) {
  const { labels } = DEBUG.saveTransfer;
  const card = createCard();
  const close = () => {
    card.style.display = 'none';
    card.replaceChildren();
  };
  const open = (...children) => {
    card.replaceChildren(...children);
    card.style.display = 'flex';
  };
  return {
    showExport() {
      const area = textBox(exportSave(save), true);
      const note = text('');
      const buttons = [[labels.copy, () => copyText(area, note, labels)], [labels.close, close]];
      open(text(labels.exportTitle, true), area, note, row(buttons));
    },
    showImport() {
      const area = textBox('', false);
      const note = text(labels.importHint);
      const load = () => {
        const result = importSave(save, area.value);
        if (result === 'imported') location.reload();
        else note.textContent = labels[result];
      };
      open(text(labels.importTitle, true), area, note, row([[labels.load, load], [labels.close, close]]));
    },
  };
}
