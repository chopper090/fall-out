// Tutti i numeri regolabili del gioco

// Risoluzione logica verticale 9:16
export const DISPLAY = {
  width: 720,
  height: 1280,
  backgroundColor: '#14141c',
};

// Corsie a tutta larghezza, colori alternati (scuro, chiaro, scuro)
export const LANES = {
  count: 3,
  colors: [0x1f1f29, 0x363645],
};

// Eroe: quadrato blu in fondo al campo, parte dalla corsia indicata
export const HERO = {
  size: 80,
  bottomOffset: 160,
  color: 0x3d7bff,
  startLane: 1,
};

// Strumenti di debug, attivi solo in sviluppo
export const DEBUG = {
  fpsOverlay: {
    refreshMs: 500,
    margin: '8px',
    padding: '2px 6px',
    font: '12px monospace',
    color: '#ffffff',
    background: 'rgba(0, 0, 0, 0.6)',
  },
  panelTitle: 'Debug',
};
