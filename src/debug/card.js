import { DEBUG } from '../config/balance.js';

// Le schede degli strumenti di sviluppo sopra il gioco (il test delle partite di fila, il salvataggio da copiare e
// incollare, il registro degli errori), con l'aspetto di DEBUG.card: un riquadro in basso al centro, nascosto finché
// chi lo usa non lo mostra, con righe di testo, una casella di testo e file di pulsanti. Il testo di una casella si
// copia con view/clipboard.js

export function createCard() {
  const { bottom, width, padding, radius, gap, background, color, font, zIndex } = DEBUG.card;
  const card = document.createElement('div');
  Object.assign(card.style, {
    position: 'fixed',
    display: 'none',
    flexDirection: 'column',
    gap,
    left: '50%',
    bottom,
    transform: 'translateX(-50%)',
    width,
    boxSizing: 'border-box',
    padding,
    borderRadius: radius,
    background,
    color,
    font,
    zIndex,
    touchAction: 'manipulation',
  });
  document.body.appendChild(card);
  return card;
}

export function text(content, bold = false) {
  const { font, titleFont } = DEBUG.card;
  const line = document.createElement('div');
  line.textContent = content;
  line.style.font = bold ? titleFont : font;
  return line;
}

// Una fila di pulsanti larghi uguali: [scritta, azione, scelto]
export function row(buttons) {
  const { gap, button: color, selected, buttonPadding, radius, font } = DEBUG.card;
  const line = document.createElement('div');
  Object.assign(line.style, { display: 'flex', gap });
  for (const [label, onTap, chosen] of buttons) {
    const button = document.createElement('button');
    button.textContent = label;
    Object.assign(button.style, {
      flex: '1',
      padding: buttonPadding,
      border: 'none',
      borderRadius: radius,
      background: chosen ? selected : color,
      color: DEBUG.card.color,
      font,
    });
    button.addEventListener('click', onTap);
    line.append(button);
  }
  return line;
}

// Una casella di testo larga quanto la scheda, con value; readOnly: si legge e si copia, ma non si scrive
export function textBox(value, readOnly) {
  const { textFont, textHeight, color } = DEBUG.card;
  const area = document.createElement('textarea');
  area.readOnly = readOnly;
  area.value = value;
  Object.assign(area.style, { font: textFont, height: textHeight, color, background: 'transparent' });
  Object.assign(area.style, { width: '100%', boxSizing: 'border-box', resize: 'none' });
  return area;
}
