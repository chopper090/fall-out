// Icone provvisorie dell'interfaccia (view/icons.js), in grigio: ognuna è una lista di forme semplici in un quadrato
// di 100 × 100 con il centro in (0, 0) (x verso destra, y verso il basso, da -50 a 50), disegnate tutte del colore
// dell'icona. Chi le usa chiede solo il nome: le immagini vere prenderanno il loro posto, con gli stessi nomi.
// Forme: circle (centro x, y e raggio r), ring (come circle, solo il bordo largo width), rect (centro x, y, larghezza
// w, altezza h, angoli tondi di raggio r), line (da x1, y1 a x2, y2, larga width), poly (i punti, [x, y, x, y, ...])
export const ICONS = {
  heroes: [
    { type: 'circle', x: 0, y: -22, r: 16 },
    { type: 'poly', points: [-30, 42, -30, 16, -16, 2, 16, 2, 30, 16, 30, 42] },
  ],
  build: [
    { type: 'line', x1: -30, y1: 34, x2: 8, y2: -4, width: 11 },
    { type: 'poly', points: [-8, -26, 14, -48, 40, -22, 18, 0] },
  ],
  road: [
    { type: 'line', x1: -24, y1: 44, x2: -24, y2: -42, width: 8 },
    { type: 'poly', points: [-20, -42, 36, -24, -20, -6] },
  ],
  catalog: [
    { type: 'rect', x: -16, y: 2, w: 28, h: 66, r: 4 },
    { type: 'rect', x: 16, y: 2, w: 28, h: 66, r: 4 },
    { type: 'line', x1: 0, y1: -34, x2: 0, y2: 38, width: 3 },
  ],
  daily: [
    { type: 'ring', x: 0, y: 0, r: 40, width: 8 },
    { type: 'ring', x: 0, y: 0, r: 22, width: 8 },
    { type: 'circle', x: 0, y: 0, r: 8 },
  ],
  army: [
    { type: 'circle', x: -28, y: -10, r: 11 },
    { type: 'poly', points: [-46, 40, -46, 16, -36, 6, -20, 6, -10, 16, -10, 40] },
    { type: 'circle', x: 28, y: -10, r: 11 },
    { type: 'poly', points: [10, 40, 10, 16, 20, 6, 36, 6, 46, 16, 46, 40] },
    { type: 'circle', x: 0, y: -24, r: 14 },
    { type: 'poly', points: [-20, 44, -20, 12, -10, -4, 10, -4, 20, 12, 20, 44] },
  ],
  upgrade: [{ type: 'poly', points: [0, -42, 36, -4, 13, -4, 13, 40, -13, 40, -13, -4, -36, -4] }],
  collect: [
    { type: 'circle', x: 0, y: 12, r: 30 },
    { type: 'poly', points: [-14, -16, 14, -16, 8, -34, -8, -34] },
  ],
  info: [
    { type: 'ring', x: 0, y: 0, r: 40, width: 8 },
    { type: 'rect', x: 0, y: 10, w: 11, h: 32, r: 3 },
    { type: 'circle', x: 0, y: -19, r: 7 },
  ],
  challenge: [
    { type: 'line', x1: -32, y1: 32, x2: 30, y2: -30, width: 8 },
    { type: 'line', x1: 32, y1: 32, x2: -30, y2: -30, width: 8 },
    { type: 'line', x1: -34, y1: 16, x2: -16, y2: 34, width: 8 },
    { type: 'line', x1: 34, y1: 16, x2: 16, y2: 34, width: 8 },
  ],
  accelerate: [{ type: 'poly', points: [8, -46, -26, 6, -3, 6, -10, 46, 26, -8, 3, -8] }],
  lock: [
    { type: 'ring', x: 0, y: -10, r: 18, width: 8 },
    { type: 'rect', x: 0, y: 16, w: 54, h: 40, r: 6 },
  ],
  close: [
    { type: 'line', x1: -28, y1: -28, x2: 28, y2: 28, width: 10 },
    { type: 'line', x1: 28, y1: -28, x2: -28, y2: 28, width: 10 },
  ],
};
