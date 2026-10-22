// Tutti i numeri regolabili del gioco

// Risoluzione logica verticale 9:16
export const DISPLAY = {
  width: 720,
  height: 1280,
  backgroundColor: '#14141c',
};

// Testo provvisorio della Fase 0
export const TITLE = {
  text: 'FALL-OUT · Fase 0',
  style: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '48px',
    color: '#ffffff',
  },
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
