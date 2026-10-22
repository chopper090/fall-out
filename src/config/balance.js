// Tutti i numeri regolabili del gioco.
// Mondo in prospettiva: x di lato, y in alto, z in avanti; l'eroe sta a z = 0

// Risoluzione logica verticale 9:16
export const DISPLAY = {
  width: 720,
  height: 1280,
  backgroundColor: '#14141c',
};

// Corsie che coprono tutta la larghezza del campo, colori alternati (scuro, chiaro, scuro)
export const LANES = {
  count: 3,
  fieldWidth: 720,
  colors: [0x1f1f29, 0x363645],
};

// Campo che scorre verso l'eroe (unità/s), segnato da trattini sui confini tra le corsie
export const FIELD = {
  scrollSpeed: 400,
  dash: {
    length: 60,
    gap: 60,
    width: 8,
    color: 0x6e6e86,
  },
};

// Telecamera ferma al centro, dietro l'eroe e in alto, inclinata verso il basso
export const CAMERA = {
  height: 1600,
  distance: 900,
  pitchDeg: 46,
  fovDeg: 40,
  drawDistance: 4000,
};

// Eroe: cubo blu, con tetto più chiaro e fianchi più scuri per dare volume
export const HERO = {
  size: 80,
  startLane: 1,
  colors: {
    top: 0x7aa6ff,
    front: 0x3d7bff,
    side: 0x2a56b8,
  },
};

// Arma di base: colpi dritti in avanti (colpi/s, unità/s, gittata in unità), cubetti blu chiaro
export const WEAPON = {
  fireRate: 5,
  speed: 1800,
  range: 2000,
  size: 24,
  flightHeight: 28,
  colors: {
    top: 0xd2e1ff,
    front: 0xa9c4ff,
    side: 0x7f9fe0,
  },
  poolSize: 16,
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
    {
      title: 'Combattimento',
      target: WEAPON,
      fields: {
        fireRate: { label: 'cadenza (colpi/s)', min: 0, max: 20, step: 0.5 },
        speed: { label: 'velocità colpi', min: 200, max: 4000, step: 50 },
        range: { label: 'gittata', min: 300, max: 4000, step: 50 },
      },
    },
    {
      title: 'Camera',
      target: CAMERA,
      fields: {
        height: { label: 'altezza', min: 100, max: 3000, step: 10 },
        distance: { label: 'distanza dietro', min: 50, max: 2000, step: 10 },
        pitchDeg: { label: 'inclinazione (°)', min: 5, max: 85, step: 1 },
        fovDeg: { label: 'campo visivo (°)', min: 20, max: 100, step: 1 },
      },
    },
  ],
};
