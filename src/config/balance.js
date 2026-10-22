import { WAVES } from '../data/waves.js';

// Tutti i numeri regolabili del gioco (i dati del livello sono in data/).
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

// Campo che scorre verso l'eroe, segnato da trattini sui confini tra le corsie.
// La velocità la decide l'ondata in corso (data/waves.js)
export const FIELD = {
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
  nearDepth: 10,
};

// Eroe: cubo blu, con tetto più chiaro e fianchi più scuri per dare volume.
// Ha la sua vita: ogni nemico che lo tocca gliene toglie ENEMIES.heroDamage, a zero muore
export const HERO = {
  size: 80,
  startLane: 1,
  maxHp: 5,
  colors: {
    top: 0x7aa6ff,
    front: 0x3d7bff,
    side: 0x2a56b8,
  },
};

// Esercito: soldati di partenza, eroe compreso
export const ARMY = {
  startSize: 1,
};

// Livello: ondata da cui si parte (le ondate sono in data/waves.js) e secondi di pausa prima di ognuna
export const LEVEL = {
  startWave: 1,
  breakSeconds: 3,
};

// Missione: fallisce se muore l'eroe o se maxEscaped nemici superano l'esercito
export const MISSION = {
  maxEscaped: 3,
};

// Plotoni: i soldati (cubetti blu) stanno in blocchi da size, columns per fila. Il plotone incompleto
// si riempie per primo, poi ne nasce uno nuovo. I posti dei plotoni, in ordine di arrivo, sono in layout
// come [colonna, fila]: fila 1 davanti all'eroe (gli fa da scudo), 0 ai suoi lati, -1 dietro.
// gap: spazio tra i blocchi e l'eroe. Con 6 plotoni la folla occupa circa il 70% della strada.
// Seguono l'eroe con un ritardo di followMs; oltre maxPlatoons il numero cresce ma i blocchi no.
// Misure in unità del mondo
export const PLATOONS = {
  size: 10,
  columns: 5,
  maxPlatoons: 6,
  soldierSize: 20,
  spacing: 32,
  gap: 20,
  layout: [
    [0, 1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
    [0, -1],
  ],
  followMs: 90,
  // Numero dei soldati sopra l'esercito, offsetY sopra la cima dell'eroe
  counter: {
    offsetY: 75,
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
};

// Arma di base: eroe e soldati sparano ognuno per conto suo, dritto in avanti, fireRate colpi al secondo
// a testa e ognuno con il suo ritmo (unità/s, gittata in unità). Gittata medio-corta: i colpi spariscono
// a circa due terzi dello schermo. Ogni colpo vale un soldato: oltre i soldati disegnati il danno
// del colpo cresce in proporzione. Cubetti blu chiaro sopra la folla
export const WEAPON = {
  fireRate: 5,
  speed: 1800,
  range: 1000,
  damage: 1,
  size: 14,
  flightHeight: 26,
  colors: {
    top: 0xd2e1ff,
    front: 0xa9c4ff,
    side: 0x7f9fe0,
  },
  poolSize: 200,
};

// Nemici: cubi rossi; vita, frequenza e file su più corsie le decide l'ondata in corso (data/waves.js).
// Compaiono a spawnDistance in fondo alla strada. Chi tocca l'esercito si scontra e sparisce: elimina
// tanti soldati quanta vita gli resta (almeno quelli che tocca) e all'eroe toglie heroDamage di vita.
// Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ, già sotto il bordo dello schermo
export const ENEMIES = {
  size: 80,
  spawnDistance: 2400,
  heroDamage: 1,
  despawnZ: -300,
  colors: {
    top: 0xff8a80,
    front: 0xe53935,
    side: 0xa52a2a,
  },
  poolSize: 24,
};

// Cancelli +N, gialli: uno ogni spawnInterval secondi in una corsia a caso, solo durante le ondate;
// partono da startValue.
// Ogni colpo li carica di una parte dell'esercito (1 / soldati disegnati): il valore sale di 1
// ogni hitsPerPoint colpi di tutto l'esercito. Misure in unità del mondo: larghi poco meno di una corsia
export const GATES = {
  spawnInterval: 5,
  spawnDistance: 2400,
  startValue: 3,
  hitsPerPoint: 3,
  width: 220,
  depth: 16,
  postWidth: 16,
  postHeight: 150,
  beamHeight: 56,
  colors: {
    top: 0xffe680,
    front: 0xf5c518,
    side: 0xc99a00,
  },
  // Insegna "+N" sulla trave; minScale la tiene leggibile anche lontano
  sign: {
    minScale: 0.5,
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#1a1a1a',
    },
  },
  poolSize: 6,
};

// Effetti visivi, spegnibili dal pannello: lampo e barra di vita sul nemico colpito,
// numero del danno a ogni colpo, scoppio quando muore un nemico o un soldato;
// bordo rosso e scossa quando l'eroe è colpito o un nemico supera l'esercito
export const FX = {
  enabled: true,
  showHealthBars: true,
  showDamageNumbers: true,
  // Scossa: ampiezza in pixel, frequenza in radianti al millisecondo
  damage: {
    flashMs: 300,
    edgeWidth: 28,
    color: 0xff1a1a,
    maxAlpha: 0.55,
    shakeMs: 250,
    shakeAmplitude: 14,
    shakeFrequency: 0.09,
  },
  hitFlash: {
    durationMs: 90,
    colors: {
      top: 0xffffff,
      front: 0xffffff,
      side: 0xe0e0e0,
    },
  },
  death: {
    durationMs: 160,
    growth: 0.6,
  },
  // Barra sopra il nemico (misure in unità del mondo): resta visibile visibleMs dopo l'ultimo colpo
  healthBar: {
    visibleMs: 1200,
    width: 80,
    height: 10,
    offsetY: 24,
    colors: {
      back: 0x2b1416,
      fill: 0xe53935,
    },
  },
  // Numero "-danno" che sale di rise unità e sfuma; minScale lo tiene leggibile anche lontano.
  // I colpi sullo stesso nemico entro mergeMs si sommano nello stesso numero
  damageNumber: {
    durationMs: 600,
    mergeMs: 150,
    rise: 70,
    minScale: 0.6,
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    },
  },
  poolSize: 16,
};

// Interfaccia della battaglia (pixel dello schermo logico 720x1280): barra della vita dell'eroe,
// numero di soldati, nemici passati, ondata in corso, scritta prima di ogni ondata e fine missione
export const HUD = {
  armySize: {
    x: 24,
    y: 58,
    label: 'Esercito',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
  },
  escaped: {
    x: 24,
    y: 94,
    label: 'Nemici passati',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
  },
  // Ondata in corso, in alto a destra (x è il bordo destro della scritta)
  wave: {
    x: 696,
    y: 58,
    label: 'Ondata',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
  },
  // Scritta grande al centro durante la pausa prima di ogni ondata
  waveBanner: {
    y: 480,
    label: 'Ondata',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '76px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    },
  },
  heroBar: {
    x: 24,
    y: 24,
    width: 360,
    height: 22,
    labelGap: 16,
    label: 'Eroe',
    colors: {
      back: 0x101a33,
      fill: 0x3d7bff,
    },
    labelStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
  },
  // Schermata di fine livello: missione fallita o livello completato
  gameOver: {
    overlayColor: 0x000000,
    overlayAlpha: 0.65,
    failedTitle: 'Missione fallita',
    completedTitle: 'Livello completato',
    distanceLabel: 'Distanza',
    hint: 'Tocca per ricominciare',
    unitsPerMeter: 100,
    lineGap: 90,
    tapDelayMs: 600,
    titleStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
    textStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
      color: '#ffffff',
    },
  },
};

// Swipe: sensibilità (1 = segue il dito) e aggancio al centro corsia quando si alza il dito.
// Se da metà tra due corsie l'esercito colpisce entrambe, ci si aggancia anche lì.
// La folla resta sempre dentro la strada: i punti di aggancio fuori portata si spostano al bordo
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
  restartLabel: 'Ricomincia la partita',
  folders: [
    {
      title: 'Comandi',
      target: CONTROLS,
      fields: {
        sensitivity: { label: 'sensibilità', min: 0.25, max: 3, step: 0.05 },
        snapEnabled: { label: 'aggancio' },
        snapRadius: { label: 'raggio (px)', min: 0, max: 120, step: 1 },
        snapSpeed: { label: 'velocità (px/s)', min: 100, max: 3000, step: 50 },
      },
    },
    {
      title: 'Livello',
      target: LEVEL,
      fields: {
        startWave: { label: 'ondata iniziale (da prossima partita)', min: 1, max: WAVES.length, step: 1 },
        breakSeconds: { label: 'pausa tra le ondate (s)', min: 0, max: 10, step: 0.5 },
      },
    },
    {
      title: 'Combattimento',
      target: WEAPON,
      fields: {
        fireRate: { label: 'cadenza (colpi/s a testa)', min: 0, max: 20, step: 0.5 },
        speed: { label: 'velocità colpi', min: 200, max: 4000, step: 50 },
        range: { label: 'gittata', min: 300, max: 4000, step: 50 },
      },
    },
    {
      title: 'Esercito',
      target: ARMY,
      fields: {
        startSize: { label: 'soldati con l\'eroe (da prossima partita)', min: 1, max: 200, step: 1 },
      },
    },
    {
      title: 'Plotoni',
      target: PLATOONS,
      fields: {
        size: { label: 'soldati a plotone (da prossima partita)', min: 1, max: 10, step: 1 },
        followMs: { label: 'ritardo (ms)', min: 0, max: 400, step: 10 },
      },
    },
    {
      title: 'Eroe',
      target: HERO,
      fields: {
        maxHp: { label: 'vita eroe (da prossima partita)', min: 1, max: 30, step: 1 },
      },
    },
    {
      title: 'Missione',
      target: MISSION,
      fields: {
        maxEscaped: { label: 'nemici che possono passare', min: 1, max: 20, step: 1 },
      },
    },
    {
      title: 'Cancelli',
      target: GATES,
      fields: {
        spawnInterval: { label: 'ogni (s)', min: 1, max: 15, step: 0.5 },
        startValue: { label: 'valore iniziale', min: 1, max: 20, step: 1 },
        hitsPerPoint: { label: 'colpi dell\'esercito per +1', min: 1, max: 10, step: 1 },
      },
    },
    {
      title: 'Effetti',
      target: FX,
      fields: {
        enabled: { label: 'attivi' },
        showHealthBars: { label: 'barra vita' },
        showDamageNumbers: { label: 'numeri danno' },
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
