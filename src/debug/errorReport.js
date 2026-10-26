import { DEBUG } from '../config/balance.js';
import { clearErrors, errorEntries, errorLogText } from '../core/errorLog.js';
import { copyText } from '../view/clipboard.js';
import { createCard, row, text, textBox } from './card.js';

// Il pulsante del registro degli errori (core/errorLog.js) in cima al pannello di sviluppo pane, dove si arriva anche
// sul telefono (il fondo del pannello esce dallo schermo), con le scritte di DEBUG.errorLog: apre una scheda sopra il
// gioco (debug/card.js) con il registro e lo copia subito negli appunti (fuori da https resta selezionato, da copiare a
// mano); dalla scheda lo si copia di nuovo o lo si svuota
export function createErrorReport(pane) {
  const { button, labels } = DEBUG.errorLog;
  const card = createCard();
  const close = () => {
    card.style.display = 'none';
    card.replaceChildren();
  };
  const show = () => {
    const area = textBox(errorLogText(), true);
    const note = text(labels.empty);
    const copy = () => copyText(area, note, labels);
    const clear = () => {
      clearErrors();
      area.value = errorLogText();
      note.textContent = labels.cleared;
    };
    const buttons = [[labels.copy, copy], [labels.clear, clear], [labels.close, close]];
    card.replaceChildren(text(labels.title, true), area, note, row(buttons));
    card.style.display = 'flex';
    if (errorEntries().length > 0) copy();
  };
  pane.addButton({ title: button, index: 0 }).on('click', show);
}
