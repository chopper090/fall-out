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

// Eroe: pedina blu, più alta dei soldati (height, in unità del mondo; size è la larghezza della base).
// Ha un'arma sua, più rapida di quella dei soldati: fireRate colpi al secondo da damage ciascuno.
// Ha la sua vita: ogni nemico che lo tocca gliene toglie quanta ne dice il suo tipo (data/enemies.js), a zero muore.
// La sua barra della vita sta sempre sopra la sua testa, larga quanto lui (misure in unità del mondo)
export const HERO = {
  size: 80,
  height: 92,
  fireRate: 3,
  damage: 3,
  startLane: 1,
  maxHp: 5,
  healthBar: {
    height: 12,
    offsetY: 12,
    colors: {
      back: 0x101a33,
      fill: 0x3d7bff,
    },
  },
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

// Livello: ondata da cui si parte (le ondate sono in data/waves.js) e secondi di pausa prima di ognuna;
// prima della prima ondata la pausa dura firstBreakSeconds. La scritta "Ondata N" resta bannerSeconds.
// Partenza rapida: la prima ondata trova la strada già popolata, come se fosse in corso da un po',
// con nemici e cancelli già in arrivo e il più vicino a headStartZ
export const LEVEL = {
  startWave: 1,
  breakSeconds: 3,
  firstBreakSeconds: 0,
  bannerSeconds: 3,
  headStartZ: 1100,
};

// Missione: fallisce se muore l'eroe o se maxEscaped nemici superano l'esercito
export const MISSION = {
  maxEscaped: 3,
};

// Plotoni: i soldati (pedine blu) si raggruppano a size a size, nell'ordine in cui arrivano: ogni plotone
// segue l'eroe con un ritardo di followMs, così la folla ondeggia quando si sposta. Quando qualcuno muore
// i superstiti stringono le file verso l'eroe: chi cambia posto ci arriva con un ritardo di depthMs lungo
// la strada e di sideMs di lato. Misure in unità del mondo
export const PLATOONS = {
  size: 10,
  soldierSize: 20,
  soldierHeight: 30,
  followMs: 90,
  regroup: {
    sideMs: 140,
    depthMs: 50,
  },
  // Numero dei soldati sopra l'esercito, offsetY sopra la testa dell'eroe (sopra la sua barra della vita)
  counter: {
    offsetY: 50,
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

// Folla attorno all'eroe, sparpagliata: i posti stanno su una griglia a nido d'ape (spacing tra due vicini)
// e ognuno è spostato a caso di al massimo jitter, così i soldati non stanno in riga. I primi coreSize
// riempiono il nucleo, largo al massimo coreHalfWidth di lato: un ovale stretto e lungo attorno all'eroe
// (core: quanto conta la distanza di lato, ax, e lungo la strada, az), che anche a metà strada colpisce
// una corsia sola. Gli altri allargano la folla ai lati, ancora a ovale (wings). frontBias sposta i posti
// più ambiti un po' davanti all'eroe, a fargli da scudo; heroGap: spazio libero attorno all'eroe.
// rows e columns: fin dove arriva la griglia dei posti possibili
export const FORMATION = {
  spacing: 30,
  jitter: 3,
  heroGap: 8,
  coreHalfWidth: 64,
  coreSize: 40,
  core: { ax: 1, az: 2.2 },
  wings: { ax: 1.5, az: 1 },
  frontBias: 15,
  rows: 12,
  columns: 10,
};

// Ordine di disegno: il campo sotto, poi pedine, colpi e cancelli (dal più lontano al più vicino a partire
// da world), sopra tutto barre, numeri e scritte
export const DEPTH = {
  field: 0,
  world: 10000,
  overlay: 20000,
};

// Pedine in grigio, come pezzi di un gioco da tavolo: base tonda con il suo spessore, corpo che si stringe
// verso il collo, testa tonda. Ogni tipo è disegnato una volta in un'unica immagine e mostrato in piedi,
// rivolto alla telecamera, grande quanto vuole la sua distanza: la grafica vera prenderà il posto dell'immagine.
// Misure in frazioni della larghezza della pedina: head raggio della testa, neck e waist larghezza del corpo
// in alto e in basso, base altezza dell'ellisse della base; detail: collare, elmo piatto o corona.
// textureScale: pixel dell'immagine per unità del mondo
export const PAWNS = {
  textureScale: 1.6,
  padding: 2,
  baseThickness: 0.1,
  neckDrop: 0.7,
  shadeShare: 0.28,
  highlight: { offset: 0.32, size: 0.38 },
  collar: { width: 1.9, height: 0.32 },
  helmet: { width: 1.15, height: 1.5, brim: 0.32, rim: 1.25 },
  crown: { width: 0.85, height: 0.22, sink: 0.25 },
  shapes: {
    soldier: { head: 0.3, neck: 0.3, waist: 0.66, base: 0.36 },
    hero: { head: 0.22, neck: 0.24, waist: 0.6, base: 0.32, detail: 'collar' },
    grunt: { head: 0.25, neck: 0.27, waist: 0.62, base: 0.34 },
    swarm: { head: 0.36, neck: 0.42, waist: 0.72, base: 0.38 },
    fast: { head: 0.2, neck: 0.2, waist: 0.46, base: 0.3 },
    armored: { head: 0.26, neck: 0.32, waist: 0.68, base: 0.34, detail: 'helmet' },
    elite: { head: 0.22, neck: 0.27, waist: 0.64, base: 0.32, detail: 'crown' },
  },
};

// Arma di base dei soldati (l'eroe ha la sua, in HERO): ognuno spara per conto suo, dritto in avanti,
// fireRate colpi al secondo a testa e ognuno con il suo ritmo, pochi colpi ma forti (unità/s, gittata in unità). Gittata medio-corta: i colpi spariscono
// a circa due terzi dello schermo. Ogni colpo vale un soldato: oltre i soldati disegnati il danno
// del colpo cresce in proporzione. Palline blu chiaro sopra la folla: flightHeight è l'altezza a cui
// si disegna il centro della pallina, poco sopra la testa dei soldati
export const WEAPON = {
  fireRate: 1.5,
  speed: 1800,
  range: 1000,
  damage: 3,
  size: 14,
  flightHeight: 30,
  colors: {
    top: 0xd2e1ff,
    front: 0xa9c4ff,
    side: 0x7f9fe0,
  },
  poolSize: 200,
};

// Nemici: i tipi sono in data/enemies.js; vita, frequenza e composizione degli arrivi le decide l'ondata
// in corso (data/waves.js). Compaiono a spawnDistance in fondo alla strada. Chi tocca l'esercito si scontra
// e sparisce: elimina tanti soldati quanta vita gli resta (almeno quelli che tocca) e all'eroe toglie
// la vita del suo tipo. Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ, già sotto
// il bordo dello schermo. L'armatura toglie danno a ogni colpo, ma ne lascia passare almeno minDamageShare.
// queueGap: spazio che un nemico veloce lascia davanti a sé quando resta in coda a un altro.
// Ogni nemico entra in un punto a caso della sua corsia, restandoci dentro con laneMargin di spazio dal bordo;
// uno sciame si sposta tutto insieme. I cancelli invece stanno sempre al centro della corsia
export const ENEMIES = {
  spawnDistance: 2400,
  despawnZ: -300,
  minDamageShare: 0.25,
  queueGap: 12,
  laneMargin: 8,
  poolSize: 80,
  swarmPoolSize: 8,
};

// Cancelli +N, gialli: uno ogni spawnInterval secondi in una corsia a caso, solo durante le ondate;
// partono da startValue.
// Ogni colpo li carica della sua parte del fuoco dell'esercito: il valore sale di 1 ogni hitsPerPoint secondi
// di fuoco di tutto l'esercito, piccolo o grande che sia. Misure in unità del mondo: larghi poco meno di una corsia
export const GATES = {
  spawnInterval: 4,
  spawnDistance: 2400,
  startValue: 4,
  hitsPerPoint: 0.8,
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

// Effetti visivi, spegnibili dal pannello e in parte dalle impostazioni: lampo e barra di vita sul nemico
// colpito, numero del danno a ogni colpo, scoppio quando muore un nemico o un soldato;
// bordo rosso e scossa (screenAlarm) quando l'eroe è colpito o un nemico supera l'esercito
export const FX = {
  enabled: true,
  screenAlarm: true,
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
  // Lampo: le pedine diventano tutte di colore tint, i cancelli prendono i colori di colors
  hitFlash: {
    durationMs: 90,
    tint: 0xffffff,
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
  // Barra sopra la testa del nemico, larga quanto lui (misure in unità del mondo): resta visibile visibleMs
  // dopo l'ultimo colpo. Lo sciame non ne ha
  healthBar: {
    visibleMs: 1200,
    height: 10,
    offsetY: 12,
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

// Interfaccia della battaglia (pixel dello schermo logico 720x1280): numero di soldati, nemici passati, ondata in corso, scritta all'inizio di ogni ondata, pulsanti di pausa
// e impostazioni con il loro menu, fine missione
export const HUD = {
  armySize: {
    x: 24,
    y: 24,
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
    y: 60,
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
    y: 24,
    label: 'Ondata',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
  },
  // Scritta grande al centro quando arriva un'ondata
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
  // Pulsanti in basso, a portata di pollice: pausa a sinistra, ingranaggio delle impostazioni a destra.
  // Un tocco che parte da un pulsante non sposta l'esercito. Icone: due barre e una ruota dentata
  buttons: {
    radius: 40,
    pause: { x: 72, y: 1208 },
    settings: { x: 648, y: 1208 },
    fill: 0x101a33,
    fillAlpha: 0.8,
    border: 0x7aa6ff,
    borderWidth: 3,
    icon: 0xffffff,
    pauseBar: { width: 9, height: 30, gap: 8 },
    gear: { teeth: 8, outer: 24, inner: 18, hole: 8 },
  },
  // Menu di pausa e impostazioni, sopra la battaglia ferma. Misure in pixel dello schermo logico
  menu: {
    overlayColor: 0x000000,
    overlayAlpha: 0.6,
    panel: { width: 620, padding: 36, radius: 24, color: 0x1c2236, border: 0x7aa6ff, borderWidth: 3 },
    titleHeight: 96,
    rowHeight: 92,
    buttonHeight: 80,
    buttonGap: 20,
    buttonRadius: 18,
    buttonColor: 0x3d7bff,
    quietButtonColor: 0x2b3350,
    toggle: { width: 124, height: 56, onColor: 0x3d7bff, offColor: 0x4a4f63, onLabel: 'Sì', offLabel: 'No' },
    stepper: { size: 56, valueWidth: 112, unit: '×' },
    labels: {
      pauseTitle: 'Pausa',
      settingsTitle: 'Impostazioni',
      resume: 'Riprendi',
      restart: 'Ricomincia',
      settings: 'Impostazioni',
      dev: 'Sviluppo',
      back: 'Indietro',
      close: 'Chiudi',
    },
    titleStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
    textStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '30px',
      color: '#ffffff',
    },
    buttonStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
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

// Swipe: sensibilità (1 = segue il dito) e aggancio al centro corsia quando si alza il dito, solo se
// l'eroe è già a meno di snapRadius dal centro: i nemici entrano in punti diversi della corsia e il dito
// deve poter restare puntato su di loro. Se da metà tra due corsie l'esercito colpisce entrambe,
// ci si aggancia anche lì.
// La folla resta sempre dentro la strada: i punti di aggancio fuori portata si spostano al bordo
export const CONTROLS = {
  sensitivity: 1,
  snapEnabled: true,
  snapRadius: 30,
  snapSpeed: 1500,
};

// Impostazioni per tutti i giocatori, nell'ingranaggio: valgono subito e si salvano sul telefono.
// Ognuna cambia un valore qui sopra (target e key): quelle con min e max si regolano a passi di step,
// le altre sono interruttori
export const SETTINGS = {
  storageKey: 'fall-out.settings',
  version: 1,
  entries: [
    { id: 'sensitivity', label: 'Sensibilità swipe', target: CONTROLS, key: 'sensitivity', min: 0.5, max: 2, step: 0.25 },
    { id: 'snap', label: 'Aggancio al centro corsia', target: CONTROLS, key: 'snapEnabled' },
    { id: 'screenAlarm', label: 'Scossa e bordo rosso', target: FX, key: 'screenAlarm' },
    { id: 'damageNumbers', label: 'Numeri del danno', target: FX, key: 'showDamageNumbers' },
    { id: 'healthBars', label: 'Barre della vita', target: FX, key: 'showHealthBars' },
  ],
};

// Schermo degli strumenti di sviluppo: contatore FPS, acceso dal pannello
export const DEV_SCREEN = {
  showFps: false,
};

// Strumenti di sviluppo: il pannello si apre dalla sezione Sviluppo dell'ingranaggio e resta aperto
// finché non lo si richiude da lì. Durante lo sviluppo ci sono anche nel link pubblico
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
      title: 'Schermo',
      target: DEV_SCREEN,
      fields: {
        showFps: { label: 'mostra FPS' },
      },
    },
    {
      title: 'Comandi',
      target: CONTROLS,
      fields: {
        sensitivity: { label: 'sensibilità', min: 0.5, max: 2, step: 0.05 },
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
        firstBreakSeconds: { label: 'pausa prima della prima ondata (s)', min: 0, max: 10, step: 0.5 },
        headStartZ: { label: 'nemico più vicino all\'avvio (da prossima partita)', min: 500, max: 2400, step: 50 },
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
        fireRate: { label: 'cadenza eroe (colpi/s)', min: 0, max: 10, step: 0.5 },
        damage: { label: 'danno colpo eroe', min: 0, max: 20, step: 0.5 },
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
        hitsPerPoint: { label: 'secondi di fuoco dell\'esercito per +1', min: 0.1, max: 5, step: 0.1 },
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
