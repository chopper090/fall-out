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

// Campo che scorre verso l'eroe (px/s), segnato da trattini sui confini tra le corsie
export const FIELD = {
  scrollSpeed: 400,
  dash: {
    length: 60,
    gap: 60,
    width: 6,
    color: 0x6e6e86,
  },
};

// Eroe: quadrato blu in fondo al campo, parte dalla corsia indicata
export const HERO = {
  size: 80,
  bottomOffset: 160,
  color: 0x3d7bff,
  startLane: 1,
};

// Swipe: sensibilità (1 = segue il dito) e aggancio al centro corsia quando si alza il dito
export const CONTROLS = {
  sensitivity: 1,
  snapEnabled: true,
  snapRadius: 108,
  snapSpeed: 1500,
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
  folders: [
    {
      title: 'Comandi',
      target: CONTROLS,
      fields: {
        sensitivity: { label: 'sensibilità', min: 0.25, max: 3, step: 0.05 },
        snapEnabled: { label: 'aggancio' },
        snapRadius: { label: 'raggio (px, 120 = confine)', min: 0, max: 120, step: 1 },
        snapSpeed: { label: 'velocità (px/s)', min: 100, max: 3000, step: 50 },
      },
    },
    {
      title: 'Campo',
      target: FIELD,
      fields: {
        scrollSpeed: { label: 'scorrimento (px/s)', min: 0, max: 1500, step: 10 },
      },
    },
  ],
};
