import { ENEMY_TYPES } from '../data/enemies.js';
import { WEAPONS } from '../data/units.js';
import { HEROES } from '../data/heroes.js';
import { BOSS, LIMITS, WAVES } from '../data/waves.js';
import { CHEST_KINDS } from '../data/chests.js';

// Tutti i numeri regolabili del gioco (i dati del livello sono in data/).
// Mondo in prospettiva: x di lato, y in alto, z in avanti; gli eroi davanti stanno a z = 0

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

// Eroi (data/heroes.js): pedine blu, più alte dei soldati (height, in unità del mondo; size è la larghezza
// della base), in uno dei cinque posti di slots (dx di lato e dz lungo la strada rispetto al punto guidato
// dallo swipe): due davanti e tre dietro. Posti stretti quanto basta perché i colpi dritti dei due davanti
// prendano anche un nemico esattamente al centro e perché gli eroi arrivino al centro delle corsie laterali
// senza uscire dalla strada. L'esercito parte nella corsia startLane.
// Ogni eroe ha la sua vita: ogni nemico che lo tocca, o lo colpisce con un suo colpo, gliene toglie quanta ne dice
// il suo tipo (data/enemies.js); a zero muore. Sopra la testa di ognuno la barra della vita e sopra quella la
// barra della ricarica dell'abilità (cooldownBar), misure in unità del mondo; le barre sono larghe barShare della
// sua base, così quelle di due eroi affiancati restano separate
export const HERO = {
  size: 80,
  height: 92,
  barShare: 0.8,
  startLane: 1,
  slots: [
    { dx: -40, dz: 0 },
    { dx: 40, dz: 0 },
    { dx: -80, dz: -75 },
    { dx: 0, dz: -75 },
    { dx: 80, dz: -75 },
  ],
  healthBar: {
    height: 12,
    offsetY: 12,
    colors: {
      back: 0x101a33,
      fill: 0x3d7bff,
    },
  },
  cooldownBar: {
    height: 5,
    offsetY: 4,
    colors: {
      back: 0x101a33,
      fill: 0xffe680,
    },
  },
};

// Esercito: soldati di partenza, capo compreso. Riserve, i soldati oltre il tetto della folla (LIMITS.maxArmy in
// data/waves.js): alzano il danno di tutti i colpi fino a maxBonus (0.3 = +30%), sempre meno man mano che
// crescono: le prime halfCount riserve ne danno metà, le successive halfCount metà di quello che resta, e così via
export const ARMY = {
  startSize: 1,
  reserves: { maxBonus: 0.3, halfCount: 20 },
};

// Livello: ondata da cui si parte (le ondate e il boss sono in data/waves.js) e secondi di pausa prima di ognuna
// e prima del boss (che aspetta anche la strada libera); prima della prima ondata la pausa dura firstBreakSeconds.
// La scritta "Ondata N" o "Boss" resta bannerSeconds. Partenza rapida: la prima ondata trova la strada già
// popolata, come se fosse in corso da un po', con nemici e cancelli già in arrivo e il più vicino a headStartZ.
// startWithBoss: la partita parte direttamente dal boss, per provarlo
export const LEVEL = {
  startWave: 1,
  startWithBoss: false,
  breakSeconds: 3,
  firstBreakSeconds: 0,
  bannerSeconds: 3,
  headStartZ: 1100,
};

// Potenza (systems/power.js): scale porta la radice di danno al secondo per vita a numeri comodi; blastTargets,
// nemici presi in media da una granata; levelScale pesa la potenza del livello, tarata con il bot perché a rapporto 1
// (nostra potenza uguale a quella del livello) si vinca circa metà delle partite. bands: fasce di difficoltà dalla
// più facile, ognuna da un rapporto from in su, con il suo nome e il suo colore, e la parte di partite che promette
// di vincere: da wins in su, fino a wins della fascia più facile. Tarate con il simulatore (npm run sim) cambiando
// la vita dei nemici. Limite noto: per noi contano solo eroi e soldati di partenza, ma in battaglia combattono
// soprattutto i soldati presi ai cancelli
export const POWER = {
  scale: 5,
  blastTargets: 2,
  levelScale: 0.0302,
  bands: [
    { from: 1.35, label: 'Facile', color: 0x66bb6a, wins: 0.7 },
    { from: 1, label: 'Normale', color: 0xffe680, wins: 0.5 },
    { from: 0.7, label: 'Difficile', color: 0xffa726, wins: 0.25 },
    { from: 0.6, label: 'Molto difficile', color: 0xef5350, wins: 0.1 },
    { from: 0, label: 'Proibitiva', color: 0xab47bc, wins: 0 },
  ],
};

// Missione: fallisce se muore il capo (leader, data/heroes.js) o se maxEscaped nemici superano l'esercito
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
  // Numero dei soldati sopra l'esercito, offsetY sopra la testa del capo (sopra le sue barre)
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

// Folla attorno agli eroi, sparpagliata: i posti stanno su una griglia a nido d'ape (spacing tra due vicini)
// e ognuno è spostato a caso di al massimo jitter, così i soldati non stanno in riga. I primi coreSize
// riempiono il nucleo, largo al massimo coreHalfWidth di lato: un ovale stretto e lungo attorno agli eroi
// (core: quanto conta la distanza di lato, ax, e lungo la strada, az), che anche a metà strada colpisce
// una corsia sola. Gli altri allargano la folla ai lati, ancora a ovale (wings). frontBias sposta i posti
// più ambiti un po' davanti agli eroi, a fargli da scudo; heroGap: spazio libero attorno a ogni eroe.
// rows e columns: fin dove arriva la griglia dei posti possibili
export const FORMATION = {
  spacing: 30,
  jitter: 3,
  heroGap: 8,
  coreHalfWidth: 110,
  coreSize: 40,
  core: { ax: 1, az: 2.2 },
  wings: { ax: 1.5, az: 1 },
  frontBias: 15,
  rows: 12,
  columns: 10,
};

// Ordine di disegno: il campo sotto, i segni a terra (zona del boss, ombre e scoppi delle granate, cerchio degli
// scrigni aperti), poi pedine, colpi, cancelli e scrigni (dal più lontano al più vicino a partire da world), sopra
// tutto barre, numeri e scritte
export const DEPTH = {
  field: 0,
  marks: 1,
  world: 10000,
  overlay: 20000,
};

// Pedine in grigio, come pezzi di un gioco da tavolo: base tonda con il suo spessore, corpo che si stringe
// verso il collo, testa tonda. Ogni tipo è disegnato una volta in un'unica immagine e mostrato in piedi,
// rivolto alla telecamera, grande quanto vuole la sua distanza: la grafica vera prenderà il posto dell'immagine.
// Misure in frazioni della larghezza della pedina: head raggio della testa, neck e waist larghezza del corpo
// in alto e in basso, base altezza dell'ellisse della base; detail: collare, elmo piatto, corona, corna
// (horns: punti di ogni corno in raggi della testa), canna (muzzle: bordo e foro in raggi della testa) o pennacchio
// (plume: larghezza, altezza e affondamento nella testa, in raggi della testa) o fascia (band: altezza e
// spostamento del centro dal centro della testa, in raggi della testa). Gli eroi hanno tutti la sagoma hero,
// ognuno con il suo segno (data/heroes.js).
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
  horns: { inner: [0.35, 0.85], outer: [0.88, 0.3], tip: [1.55, 1.75] },
  muzzle: { ring: 0.8, hole: 0.5, holeColor: 0x1a0a0a },
  plume: { width: 0.35, height: 1.1, sink: 0.3 },
  band: { height: 0.36, offset: -0.3 },
  shapes: {
    rifleSoldier: { head: 0.3, neck: 0.3, waist: 0.66, base: 0.36 },
    burstSoldier: { head: 0.26, neck: 0.24, waist: 0.56, base: 0.34 },
    launcherSoldier: { head: 0.28, neck: 0.36, waist: 0.74, base: 0.38, detail: 'helmet' },
    hero: { head: 0.22, neck: 0.24, waist: 0.6, base: 0.32 },
    grunt: { head: 0.25, neck: 0.27, waist: 0.62, base: 0.34 },
    swarm: { head: 0.36, neck: 0.42, waist: 0.72, base: 0.38 },
    fast: { head: 0.2, neck: 0.2, waist: 0.46, base: 0.3 },
    armored: { head: 0.26, neck: 0.32, waist: 0.68, base: 0.34, detail: 'helmet' },
    elite: { head: 0.22, neck: 0.27, waist: 0.64, base: 0.32, detail: 'crown' },
    shooter: { head: 0.26, neck: 0.24, waist: 0.56, base: 0.34, detail: 'muzzle' },
    boss: { head: 0.16, neck: 0.36, waist: 0.84, base: 0.34, detail: 'horns' },
  },
};

// Scudo del difensore: un anello a terra attorno all'esercito, a margin dal suo bordo, finché dura
export const SHIELD_RING = {
  color: 0x9ad0ff,
  fillAlpha: 0.12,
  ringWidth: 5,
  ringAlpha: 0.8,
  margin: 20,
};

// Zona che il boss sta per schiacciare, segnata a terra sotto le pedine: un cerchio rosso che si riempie
// man mano che il colpo si avvicina (opacità da fillAlpha.from a fillAlpha.to), con il bordo (larghezza
// in pixel). segments: lati del cerchio
export const SMASH_ZONE = {
  segments: 32,
  color: 0xff1a1a,
  fillAlpha: { from: 0.12, to: 0.45 },
  ringWidth: 6,
  ringAlpha: 0.9,
};

// Colpi dell'esercito (le armi sono in data/units.js): palline sopra la folla, flightHeight è l'altezza a cui si
// disegna il centro dei colpi dritti, poco sopra la testa dei soldati. Le riserve oltre la folla in campo alzano
// il danno di tutti i colpi (ARMY.reserves). Le granate hanno un'ombra a terra, di colore shadow.color,
// larga quanto la granata, che mostra dove sono. Nell'ultima parte della gittata (fade.share) i colpi dritti
// sbiadiscono fino a sparire e si rimpiccioliscono fino a fade.minScale, sempre più in fretta verso la fine
// (fade.curve: 1 regolare, più grande resta pieno più a lungo): la fine della gittata non è una riga e i colpi
// che colpiscono poco prima si vedono ancora bene
export const SHOTS = {
  flightHeight: 30,
  shadow: { color: 0x000000, alpha: 0.35 },
  fade: { share: 0.25, minScale: 0.5, curve: 2 },
  poolSize: 200,
  grenadePoolSize: 60,
};

// Colpi dei nemici che sparano: palline rosse più grandi e più lente delle nostre, che volano dritte dal tiratore
// verso il punto dove stava uno degli eroi, a caso, quando ha sparato, e oltre. Si fermano sulla prima pedina
// dell'esercito che toccano: un soldato muore, un eroe perde la vita del tipo del tiratore; con lo scudo del
// difensore alzato si fermano senza fare danno. Passano tra i nostri colpi senza
// scontrarsi. Spariscono oltre despawnZ o fuori dalla strada; flightHeight: altezza a cui si disegnano
export const ENEMY_SHOT = {
  speed: 450,
  size: 22,
  flightHeight: 40,
  despawnZ: -300,
  colors: {
    top: 0xffb4a8,
    front: 0xe53935,
    side: 0xa52a2a,
  },
  poolSize: 24,
};

// Nemici: i tipi sono in data/enemies.js; vita, frequenza e composizione degli arrivi le decide l'ondata
// in corso (data/waves.js). Compaiono a spawnDistance in fondo alla strada. Chi tocca l'esercito si scontra
// e sparisce: elimina tanti soldati quanta vita gli resta (almeno quelli che tocca) e a ogni eroe che tocca toglie
// la vita del suo tipo. Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ, già sotto
// il bordo dello schermo. L'armatura toglie danno a ogni colpo, ma ne lascia passare almeno minDamageShare.
// queueGap: spazio che un nemico lascia davanti a sé quando resta in coda a un altro.
// Ogni nemico entra in un punto a caso della sua corsia, restandoci dentro con laneMargin di spazio dal bordo;
// uno sciame si sposta tutto insieme. I cancelli invece stanno sempre al centro della corsia.
// Freno: a campo fermo (durante il boss) ogni colpo frena chi cammina da solo, il boss e la sua scorta: il freno
// sale di brake.strength volte la parte di vita che il colpo toglie (un colpo che toglie un decimo della vita, con
// strength 12, frena di 1.2, cioè del tutto), fino al maxBrake del tipo (data/enemies.js), e torna a zero da solo:
// ne resta una parte che si dimezza ogni brake.halfLifeMs. Con freno 1 il nemico è fermo, con 0.65 va al 35%
export const ENEMIES = {
  spawnDistance: 2400,
  despawnZ: -300,
  minDamageShare: 0.25,
  queueGap: 12,
  laneMargin: 8,
  brake: { strength: 12, halfLifeMs: 700 },
  poolSize: 80,
  swarmPoolSize: 8,
  shooterPoolSize: 8,
};

// Cancelli (tipi in data/gates.js, quali e con che numeri lo decide l'ondata in data/waves.js): uno o una coppia
// ogni spawnInterval secondi, sempre al centro della corsia, solo durante le ondate. Ogni colpo che tocca uno con
// il numero lo alza di perHit, fino al massimo del cancello. Gialli se aiutano, rossi (malusColors) se tolgono.
// Misure in unità del mondo: larghi poco meno di una corsia
export const GATES = {
  spawnInterval: 4,
  spawnDistance: 2400,
  perHit: 1,
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
  malusColors: {
    top: 0xff8a80,
    front: 0xe53935,
    side: 0xa52a2a,
  },
  // Insegna sulla trave ("+N", "−N", "×2", "+2 vita"...): minScale la tiene leggibile anche lontano; le scritte
  // lunghe si rimpiccioliscono in proporzione, per occupare al massimo maxWidthShare della trave.
  // words: la parola dopo il numero di guarigione, e dopo il numero al massimo (max). Scritta scura su tutti
  // i cancelli
  sign: {
    minScale: 0.5,
    maxWidthShare: 0.9,
    words: { heal: 'vita', max: 'MAX' },
    // Barra appesa sotto la trave dei cancelli con il numero (offsetY dalla cima dei pali, negativo = sotto):
    // si riempie di fill dal numero di partenza al massimo, su un fondo chiaro trasparente
    bar: {
      height: 12,
      offsetY: -10,
      widthShare: 0.8,
      back: { color: 0xffffff, alpha: 0.25 },
      fill: 0xffffff,
    },
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#1a1a1a',
    },
  },
  poolSize: 8,
};

// Scrigni (ricompense in data/chests.js; colpi per aprirli e ricompense le decide l'ondata in data/waves.js): uno
// ogni everyGates arrivi di cancelli, a metà tra due arrivi (il primo dell'ondata dopo firstAfterGates intervalli
// dei cancelli), al centro di una corsia a caso, solo durante le ondate; compaiono a spawnDistance in fondo alla
// strada. Fermano i colpi dritti e ognuno toglie uno al contatore (le granate ci volano sopra); a zero lo scrigno
// si apre. armWidth: larghezza della parte di folla, centrata sullo scrigno, che prende l'arma di uno scrigno
// d'arma. Misure in unità del mondo: una cassa gialla come tutti i bonus, con il coperchio più chiaro e largo
// overhang in più per lato
export const CHESTS = {
  everyGates: 2,
  firstAfterGates: 1.5,
  spawnDistance: 2400,
  width: 130,
  depth: 90,
  height: 64,
  lid: { height: 22, overhang: 8 },
  armWidth: 220,
  colors: GATES.colors,
  lidColors: { top: 0xfff2b3, front: 0xffd84d, side: 0xe0b22a },
  // Sul fronte della cassa i colpi che mancano, sopra il coperchio la ricompensa ("+10% danno", "Raffica"), a
  // rewardOffsetY: minScale le tiene leggibili anche lontano. words: le parole dopo le percentuali
  sign: {
    minScale: 0.5,
    rewardOffsetY: 34,
    words: { damage: 'danno', fireRate: 'cadenza' },
    hitsStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#1a1a1a',
    },
    rewardStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffe680',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
  poolSize: 6,
};

// Effetti visivi, spegnibili dal pannello e in parte dalle impostazioni: lampo e barra di vita sul nemico
// colpito, lampo arancione del tiratore che spara, numero del danno a ogni colpo, scoppio quando muore
// un nemico o un soldato;
// bordo rosso e scossa (screenAlarm) quando un eroe è colpito o un nemico supera l'esercito, scossa quando
// il boss schiaccia, disco sotto i nemici frenati
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
  // Lampo: le pedine diventano tutte di colore tint; cancelli e scrigni schiariscono i loro colori verso il bianco
  // di lighten (da 0 a 1), così restano gialli o rossi e si vede sempre se un negativo è già girato
  hitFlash: {
    durationMs: 90,
    tint: 0xffffff,
    lighten: 0.55,
  },
  death: {
    durationMs: 160,
    growth: 0.6,
  },
  // Lampo arancione del tiratore quando spara, per capire da dove arriva il colpo
  muzzleFlash: {
    durationMs: 140,
    tint: 0xffb74d,
  },
  // Insegna di un cancello quando il suo numero cambia, e contatore di uno scrigno colpito: si ingrandisce di scale
  // e torna normale in durationMs
  gateBump: {
    durationMs: 140,
    scale: 0.25,
  },
  // Scrigno aperto: a terra un cerchio largo burstRadius, di colore color, che sfuma in burstMs; la ricompensa sale
  // di rise unità e sfuma in durationMs. Gli effetti scorrono con il campo
  chestOpen: {
    durationMs: 1000,
    rise: 140,
    burstMs: 300,
    burstRadius: 110,
    color: 0xffe680,
    alpha: 0.45,
  },
  // Boss: quando si rompe uno strato della sua vita lampeggia per flashMs, e il numero degli strati
  // sulla barra in alto si ingrandisce di pulseScale e torna normale in pulseMs
  bossLayer: {
    flashMs: 160,
    pulseMs: 350,
    pulseScale: 0.6,
  },
  // Abilità degli eroi: l'anello dell'onda d'urto si allarga fino al suo raggio e sfuma in durationMs; la scia
  // del colpo perforante sfuma; dove lo scudo ferma un colpo resta per blockMs un lampo largo blockRadius;
  // il fuoco rapido ha un anello giallo a terra grande quanto il suo raggio, che sfuma negli ultimi fadeMs
  shockwave: {
    durationMs: 350,
    color: 0x7aa6ff,
    alpha: 0.6,
    ringWidth: 8,
  },
  pierce: {
    durationMs: 250,
    color: 0xd2e1ff,
    alpha: 0.7,
  },
  shield: {
    blockRadius: 24,
    blockMs: 160,
    color: 0xffffff,
    alpha: 0.8,
  },
  rapidFire: {
    color: 0xffe680,
    fillAlpha: 0.1,
    ringWidth: 5,
    ringAlpha: 0.7,
    fadeMs: 400,
  },
  // Freno dei nemici a campo fermo: sotto chi è frenato un disco a terra di colore color, largo radiusShare della
  // sua base, con opacità maxAlpha a freno pieno (in proporzione al freno); sotto minBrake non si disegna
  brake: {
    color: 0x9ad0ff,
    maxAlpha: 0.55,
    radiusShare: 0.75,
    minBrake: 0.05,
  },
  // Scoppio di una granata: un cerchio a terra grande quanto il suo raggio, di colore color, che sfuma in
  // durationMs e scorre con il campo
  blast: {
    durationMs: 180,
    color: 0xffb74d,
    alpha: 0.3,
  },
  // Schiacciamento del boss: la zona colpita diventa di colore color e sfuma in impactMs; con screenAlarm
  // trema anche lo schermo, come quando un eroe è colpito
  bossSmash: {
    impactMs: 250,
    color: 0xffffff,
    alpha: 0.7,
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

// Interfaccia della battaglia (pixel dello schermo logico 720x1280): numero di soldati, nemici passati, danno e
// cadenza in più, ondata in corso, scritta all'inizio di ogni ondata e del boss, barra della vita del boss,
// pulsanti di pausa e impostazioni con il loro menu, fine missione
export const HUD = {
  // Soldati in campo sul tetto del livello e, quando ci sono, le riserve
  armySize: {
    x: 24,
    y: 24,
    label: 'Esercito',
    reservesLabel: 'riserve',
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
  // Danno in più degli scrigni e delle riserve e cadenza in più degli scrigni, sotto l'ondata; si vede solo quando
  // c'è, separati da separator
  power: {
    x: 696,
    y: 60,
    label: 'Danno',
    fireRateLabel: 'Cadenza',
    separator: ' · ',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffe680',
      stroke: '#000000',
      strokeThickness: 5,
    },
  },
  // Ondata in corso, in alto a destra (x è il bordo destro della scritta); dopo l'ultima, il boss
  wave: {
    x: 696,
    y: 24,
    label: 'Ondata',
    bossLabel: 'Boss',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
  },
  // Scritta grande al centro quando arriva un'ondata o il boss
  waveBanner: {
    y: 480,
    label: 'Ondata',
    bossLabel: 'Boss',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '76px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    },
  },
  // Barra della vita del boss, sotto le scritte in alto e larga quasi tutto lo schermo: mostra uno strato
  // alla volta, ognuno del suo colore, e dietro si vede già il colore del prossimo. Dentro, a destra,
  // il numero degli strati rimasti
  bossBar: {
    x: 24,
    y: 104,
    width: 672,
    height: 34,
    back: 0x2b1416,
    colors: [0xe53935, 0xff8a80, 0xb0102f],
    count: {
      inset: 12,
      prefix: '×',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      },
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
  // Schermata prima della battaglia: eroi schierati con nome e ruolo, la nostra potenza e quella dei nemici, la fascia
  // di difficoltà e tocco per partire. La barra delle fasce va da proibitiva a facile, ogni fascia larga quanto il suo
  // tratto di rapporto tra gauge.min e gauge.max (le due fasce in fondo si fermano lì), con un segno sul rapporto
  lineup: {
    title: 'Schieramento',
    titleY: 200,
    heroY: 560,
    heroScale: 1.4,
    // Colonne larghe columnWidth, strette insieme alle pedine in modo che tutti gli eroi stiano in rowWidth
    columnWidth: 200,
    rowWidth: 660,
    nameOffsetY: 70,
    roleOffsetY: 110,
    powerY: 760,
    powerLabel: 'Potenza',
    levelLabel: '· nemici',
    bandY: 830,
    gauge: {
      y: 890,
      width: 600,
      height: 26,
      min: 0.4,
      max: 1.6,
      marker: { width: 10, height: 48, color: 0xffffff },
    },
    hint: 'Tocca per partire',
    hintY: 1040,
    titleStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
    nameStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
    roleStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#a9c4ff',
    },
    powerStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#ffe680',
    },
    // Il colore lo dà la fascia
    bandStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
    },
    hintStyle: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
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
  // Test delle partite di fila, il gate della Fase 3 (debug/playtest.js): acceso finché si fa il test. games:
  // partite del test; storageKey e version: il registro salvato sul telefono; questions: le domande della scheda
  // sotto la schermata di fine, ognuna con le sue risposte e il nome breve per il riepilogo; labels: le scritte
  // della scheda e del pannello; card: l'aspetto della scheda
  playtest: {
    enabled: true,
    games: 10,
    storageKey: 'fall-out.playtest',
    version: 1,
    title: 'Test delle 10 partite',
    questions: [
      { id: 'boredom', label: 'Ti ha annoiato?', short: 'noia', options: ['no', "un po'", 'sì'] },
      {
        id: 'difficulty',
        label: "Com'era la difficoltà?",
        short: 'difficoltà',
        options: ['troppo facile', 'giusta', 'troppo difficile'],
      },
    ],
    labels: {
      of: 'di',
      summary: 'Vedi il riepilogo',
      copy: 'Copia il riepilogo',
      copied: 'Copiato: incollalo nella chat',
      copyHint: 'Tieni premuto sul testo per copiarlo',
      newTest: 'Nuovo test',
      close: 'Chiudi',
      done: 'Test finito',
      enabled: 'attivo',
      played: 'partite',
    },
    card: {
      bottom: '12px',
      width: 'min(92vw, 400px)',
      padding: '10px 12px',
      radius: '10px',
      gap: '6px',
      background: 'rgba(16, 18, 24, 0.92)',
      color: '#ffffff',
      font: '15px Arial, sans-serif',
      titleFont: 'bold 15px Arial, sans-serif',
      textFont: '12px monospace',
      textHeight: '40vh',
      button: '#2a2f3a',
      selected: '#3d7bff',
      buttonPadding: '10px 4px',
      zIndex: '10',
    },
  },
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
        startWithBoss: { label: 'parti dal boss (da prossima partita)' },
        breakSeconds: { label: 'pausa tra le ondate (s)', min: 0, max: 10, step: 0.5 },
        firstBreakSeconds: { label: 'pausa prima della prima ondata (s)', min: 0, max: 10, step: 0.5 },
        headStartZ: { label: 'nemico più vicino all\'avvio (da prossima partita)', min: 500, max: 2400, step: 50 },
      },
    },
    {
      title: 'Colpi a fine gittata',
      target: SHOTS.fade,
      fields: {
        share: { label: 'sfumano nell\'ultima parte (0-1)', min: 0, max: 1, step: 0.05 },
        minScale: { label: 'grandezza alla fine', min: 0, max: 1, step: 0.05 },
        curve: { label: 'resta pieno più a lungo (1 = regolare)', min: 1, max: 4, step: 0.5 },
      },
    },
    {
      title: 'Fucile',
      target: WEAPONS.rifle,
      fields: {
        fireRate: { label: 'cadenza (colpi/s a testa)', min: 0, max: 20, step: 0.5 },
        damage: { label: 'danno', min: 0, max: 20, step: 0.5 },
        speed: { label: 'velocità colpi (dal prossimo colpo)', min: 200, max: 4000, step: 50 },
        range: { label: 'gittata', min: 300, max: 4000, step: 50 },
      },
    },
    {
      title: 'Raffica',
      target: WEAPONS.burst,
      fields: {
        fireRate: { label: 'cadenza (raffiche/s a testa)', min: 0, max: 20, step: 0.5 },
        damage: { label: 'danno di ogni colpo', min: 0, max: 20, step: 0.1 },
        pellets: { label: 'colpi per raffica', min: 1, max: 9, step: 1 },
        spreadDeg: { label: 'apertura (°)', min: 0, max: 90, step: 1 },
        range: { label: 'gittata', min: 200, max: 2000, step: 25 },
      },
    },
    {
      title: 'Lanciatore',
      target: WEAPONS.launcher,
      fields: {
        fireRate: { label: 'cadenza (granate/s a testa)', min: 0, max: 5, step: 0.1 },
        damage: { label: 'danno', min: 0, max: 50, step: 0.5 },
        radius: { label: 'raggio dello scoppio', min: 10, max: 300, step: 5 },
        range: { label: 'dove scoppia (distanza)', min: 300, max: 2400, step: 25 },
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
      title: 'Riserve',
      target: ARMY.reserves,
      fields: {
        maxBonus: { label: 'danno in più al massimo (0.3 = +30%)', min: 0, max: 1, step: 0.05 },
        halfCount: { label: 'riserve per metà del danno in più', min: 1, max: 100, step: 1 },
      },
    },
    {
      title: 'Tetti del livello',
      target: LIMITS,
      fields: {
        maxArmy: { label: 'soldati in campo (da prossima partita)', min: 10, max: 300, step: 10 },
        multiplyMax: { label: 'soldati in più al massimo da un ×2', min: 5, max: 200, step: 5 },
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
      title: 'Capo',
      target: HEROES.leader,
      fields: {
        maxHp: { label: 'vita (da prossima partita)', min: 1, max: 30, step: 1 },
      },
    },
    {
      title: 'Onda d\'urto del capo',
      target: HEROES.leader.ability,
      fields: {
        cooldownSeconds: { label: 'ricarica (s)', min: 1, max: 30, step: 0.5 },
        radius: { label: 'raggio', min: 50, max: 500, step: 10 },
        damage: { label: 'danno', min: 1, max: 50, step: 1 },
      },
    },
    {
      title: 'Fuciliere',
      target: HEROES.rifleman,
      fields: {
        maxHp: { label: 'vita (da prossima partita)', min: 1, max: 30, step: 1 },
      },
    },
    {
      title: 'Fuoco rapido del fuciliere',
      target: HEROES.rifleman.ability,
      fields: {
        cooldownSeconds: { label: 'ricarica (s)', min: 1, max: 30, step: 0.5 },
        seconds: { label: 'dura (s)', min: 0.5, max: 10, step: 0.5 },
        fireRateScale: { label: 'cadenza (volte)', min: 1, max: 5, step: 0.1 },
        radius: { label: 'raggio', min: 50, max: 400, step: 10 },
      },
    },
    {
      title: 'Cecchino',
      target: HEROES.sniper,
      fields: {
        maxHp: { label: 'vita (da prossima partita)', min: 1, max: 30, step: 1 },
      },
    },
    {
      title: 'Colpo perforante del cecchino',
      target: HEROES.sniper.ability,
      fields: {
        cooldownSeconds: { label: 'ricarica (s)', min: 1, max: 30, step: 0.5 },
        damage: { label: 'danno', min: 1, max: 50, step: 1 },
      },
    },
    {
      title: 'Difensore',
      target: HEROES.defender,
      fields: {
        maxHp: { label: 'vita (da prossima partita)', min: 1, max: 30, step: 1 },
      },
    },
    {
      title: 'Scudo del difensore',
      target: HEROES.defender.ability,
      fields: {
        cooldownSeconds: { label: 'ricarica (s)', min: 1, max: 30, step: 0.5 },
        seconds: { label: 'dura (s)', min: 0.5, max: 10, step: 0.5 },
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
      title: 'Tiratori',
      target: ENEMY_TYPES.shooter.fire,
      fields: {
        stopZ: { label: 'si ferma a (distanza)', min: 300, max: 2000, step: 50 },
        stopSeconds: { label: 'fermo per (s)', min: 0, max: 10, step: 0.5 },
        interval: { label: 'un colpo ogni (s)', min: 0.2, max: 5, step: 0.1 },
      },
    },
    {
      title: 'Freno a campo fermo',
      target: ENEMIES.brake,
      fields: {
        strength: { label: 'forza (per parte di vita tolta)', min: 0, max: 50, step: 1 },
        halfLifeMs: { label: 'si dimezza in (ms)', min: 50, max: 5000, step: 50 },
      },
    },
    {
      title: 'Colpi nemici',
      target: ENEMY_SHOT,
      fields: {
        speed: { label: 'velocità (dal prossimo colpo)', min: 100, max: 2000, step: 25 },
      },
    },
    {
      title: 'Boss',
      target: BOSS,
      fields: {
        hp: { label: 'vita (dal prossimo boss)', min: 100, max: 10000, step: 50 },
        layers: { label: 'strati (dal prossimo boss)', min: 1, max: 20, step: 1 },
        spawnZ: { label: 'entra a (dal prossimo boss)', min: 1000, max: 2400, step: 50 },
        walkSpeed: { label: 'velocità di marcia (dal prossimo boss)', min: 20, max: 600, step: 10 },
        holdZ: { label: 'si pianta a (dal prossimo boss)', min: 400, max: 1000, step: 25 },
        restSeconds: { label: 'pausa tra gli attacchi (s)', min: 0, max: 5, step: 0.1 },
        moveSpeed: { label: 'velocità di lato', min: 20, max: 600, step: 10 },
      },
    },
    {
      title: 'Schiacciamento del boss',
      target: BOSS.smash,
      fields: {
        warnSeconds: { label: 'avviso (s)', min: 0.3, max: 3, step: 0.1 },
        radius: { label: 'raggio della zona (dal prossimo attacco)', min: 40, max: 300, step: 10 },
      },
    },
    {
      title: 'Scorta del boss',
      target: BOSS.escort,
      fields: {
        interval: { label: 'ogni (s)', min: 0.5, max: 10, step: 0.5 },
        count: { label: 'pedine', min: 1, max: 30, step: 1 },
        minZ: { label: 'non esce più vicina di', min: 0, max: 1500, step: 50 },
        walkSpeed: { label: 'velocità di marcia (dalla prossima)', min: 20, max: 800, step: 10 },
      },
    },
    {
      title: 'Cancelli',
      target: GATES,
      fields: {
        spawnInterval: { label: 'ogni (s)', min: 1, max: 15, step: 0.5 },
        perHit: { label: 'numero in più a ogni colpo', min: 1, max: 5, step: 1 },
      },
    },
    {
      title: 'Scrigni',
      target: CHESTS,
      fields: {
        everyGates: { label: 'uno ogni (arrivi di cancelli)', min: 1, max: 6, step: 1 },
      },
    },
    {
      title: 'Danno degli scrigni',
      target: CHEST_KINDS.damage,
      fields: {
        amount: { label: 'danno in più (0.1 = +10%)', min: 0, max: 1, step: 0.05 },
      },
    },
    {
      title: 'Cadenza degli scrigni',
      target: CHEST_KINDS.fireRate,
      fields: {
        amount: { label: 'cadenza in più (0.1 = +10%)', min: 0, max: 1, step: 0.05 },
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

// Simulatore di bilanciamento (src/sim, si avvia con npm run sim): un bot gioca games partite per il livello com'è
// e per ogni punto di sweeps, dai semi firstSeed in su, a fps frame al secondo fissi, al massimo maxSeconds di gioco
// a partita; ogni processo gioca chunk partite di un punto.
// bot (sim/bot.js): sceglie dove andare ogni thinkMs. Guarda i nemici fino a lookAhead oltre la gittata del fucile
// e ognuno vale la sua vita, il boss bossValue e una pedina dello sciame swarmValue; i cancelli fino a gateLookAhead,
// e valgono gateWeight a soldato (healValue soldati per punto di vita ridato al capo); gli scrigni valgono
// chestWeight per rewardValue della ricompensa (in soldati; lo scrigno d'arma niente). Più lontano, meno vale:
// diviso per 1 + distanza / distanceScale. Dai colpi nemici si tiene a shotMargin in più del necessario.
// sweeps: i modi di cambiare il rapporto di potenza, con i loro valori (per la vita e il danno un fattore, per i
// soldati quanti in più). flags, quando il resoconto segnala qualcosa: lossJump, un tratto in cui si perde
// almeno questa parte di partite in più del tratto prima; flatLoss e flatHurt, un tratto dopo il primo in cui si
// perde meno di flatLoss e l'esercito perde meno di flatHurt soldati per minuto; idleSeconds, secondi in media
// senza niente a tiro in un tratto; firstTargetSeconds, secondi prima del primo bersaglio a tiro; bossSeconds, un
// boss più breve o più lungo; flatSweep, un modo di cambiare la potenza che sposta le vittorie meno di così da un
// capo all'altro; confidenceZ, ampiezza dell'intervallo di confidenza delle vittorie (1,96 = 95%)
export const SIM = {
  games: 200,
  firstSeed: 1,
  fps: 60,
  maxSeconds: 400,
  chunk: 25,
  bot: {
    thinkMs: 500,
    lookAhead: 300,
    bossValue: 40,
    swarmValue: 3,
    gateLookAhead: 1100,
    gateWeight: 0.3,
    healValue: 6,
    chestWeight: 1,
    rewardValue: { damage: 15, fireRate: 15, weapon: 0 },
    distanceScale: 500,
    shotMargin: 10,
  },
  sweeps: [
    { id: 'enemyHp', label: 'Vita dei nemici', unit: '×', values: [0.5, 0.6, 0.7, 0.8, 0.9, 1.15, 1.3, 1.5, 1.8, 2.1] },
    { id: 'heroDamage', label: 'Danno degli eroi', unit: '×', values: [0.5, 0.75, 1.5, 2, 3] },
    { id: 'heroHp', label: 'Vita degli eroi', unit: '×', values: [0.5, 1.5, 2, 3] },
    { id: 'startSoldiers', label: 'Soldati di partenza', unit: '+', values: [5, 10, 20, 40] },
  ],
  flags: {
    lossJump: 0.15,
    flatLoss: 0.02,
    flatHurt: 10,
    idleSeconds: 5,
    firstTargetSeconds: 3,
    bossSeconds: { min: 8, max: 30 },
    flatSweep: 0.05,
    confidenceZ: 1.96,
  },
};
