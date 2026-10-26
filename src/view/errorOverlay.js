import { ERROR_SCREEN } from '../config/balance.js';
import { buildLabel } from '../core/build.js';
import { errorLogText } from '../core/errorLog.js';
import { copyText } from './clipboard.js';

// La schermata dell'errore (ERROR_SCREEN), sopra tutto: si apre al primo errore che il gioco non prende, e alle volte
// dopo resta quella. Dice che qualcosa si è rotto, con la versione e il registro degli errori (core/errorLog.js), che
// Copia rilegge a ogni tocco, con gli errori arrivati nel frattempo; Ricarica riapre il gioco da capo
let overlay = null;

export function showErrorOverlay() {
  if (overlay !== null) return;
  const { labels, style } = ERROR_SCREEN;
  overlay = element('div', {
    position: 'fixed',
    inset: '0',
    zIndex: style.zIndex,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: style.shade,
  });
  const panel = element('div', {
    display: 'flex',
    flexDirection: 'column',
    gap: style.gap,
    width: style.width,
    boxSizing: 'border-box',
    padding: style.padding,
    borderRadius: style.radius,
    border: style.border,
    background: style.background,
    color: style.color,
    font: style.font,
  });
  const log = element('textarea', {
    width: '100%',
    height: style.logHeight,
    boxSizing: 'border-box',
    resize: 'none',
    font: style.logFont,
    color: style.color,
    background: 'transparent',
  });
  log.readOnly = true;
  log.value = errorLogText();
  const note = element('div', { color: style.quietColor });
  const copy = () => {
    log.value = errorLogText();
    copyText(log, note, labels);
  };
  const buttons = element('div', { display: 'flex', gap: style.gap });
  const reload = () => location.reload();
  buttons.append(button(labels.copy, style.mainButton, copy), button(labels.reload, style.button, reload));
  panel.append(
    element('div', { font: style.titleFont }, labels.title),
    element('div', {}, labels.text),
    element('div', { color: style.quietColor }, buildLabel()),
    log,
    note,
    buttons,
  );
  overlay.append(panel);
  document.body.append(overlay);
}

// Un elemento della pagina con il suo stile e, se c'è, la sua scritta
function element(tag, css, content = '') {
  const node = document.createElement(tag);
  Object.assign(node.style, css);
  node.textContent = content;
  return node;
}

// Un pulsante largo quanto gli altri della sua fila, con il colore color
function button(label, color, onTap) {
  const { buttonPadding, radius, buttonFont, color: textColor } = ERROR_SCREEN.style;
  const css = { flex: '1', padding: buttonPadding, border: 'none', borderRadius: radius, font: buttonFont };
  const node = element('button', { ...css, background: color, color: textColor }, label);
  node.addEventListener('click', onTap);
  return node;
}
