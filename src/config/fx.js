import { FONT } from './styles.js';

// Effetti visivi, spegnibili dal pannello e in parte dalle impostazioni: lampo e barra di vita sul nemico
// colpito, lampo arancione del tiratore che spara, numero del danno a ogni colpo e danno totale quando un nemico
// muore, scoppio quando muore un nemico o un soldato, lampo sull'élite colpita che resta in piedi;
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
  // Lampo: le pedine diventano tutte di colore tint; gli scrigni schiariscono i loro colori verso il bianco di
  // lighten (da 0 a 1), così restano gialli
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
  // Contatore di uno scrigno colpito: si ingrandisce di scale e torna normale in durationMs
  chestBump: {
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
      fontFamily: FONT,
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    },
  },
  // Danno totale preso da un nemico quando muore (con i numeri del danno): più grande, più in alto, rosato come i
  // nemici e un po' trasparente, per non confondersi con i numeri di ogni colpo; parte offset unità sopra la sua testa,
  // oltre i numeri dei colpi di prima che stanno ancora salendo, sale di rise e sfuma da alpha a zero in durationMs
  damageTotal: {
    durationMs: 1100,
    offset: 160,
    rise: 90,
    alpha: 0.65,
    minScale: 0.85,
    style: {
      fontFamily: FONT,
      fontSize: '54px',
      fontStyle: 'bold',
      color: '#ff9a85',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
  // Scritta al centro dello schermo (pixel dello schermo logico) quando l'esercito passa sotto un cancello: il suo
  // numero e label ("+12 soldati", gialla; "−8 soldati", rossa con malusStyle), così con due cancelli vicini si vede
  // quale si è preso. Parte a y, sale di rise e sfuma in durationMs: con fadeCurve più grande resta piena più a lungo
  gatePass: {
    durationMs: 1300,
    y: 620,
    rise: 70,
    fadeCurve: 2,
    label: 'soldati',
    style: {
      fontFamily: FONT,
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffe680',
      stroke: '#000000',
      strokeThickness: 8,
    },
    malusStyle: {
      fontFamily: FONT,
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ff6b5e',
      stroke: '#000000',
      strokeThickness: 8,
    },
  },
  // Premio preso, dove l'esercito l'ha raccolto: a terra un anello del colore della sua cassa (LOOT.colors, la faccia
  // davanti), spesso ringWidth, si allarga fino a burstRadius e sfuma da alpha in burstMs. La sua quantità la dice la
  // scritta vicino agli eroi (lootGain)
  lootPick: {
    burstMs: 350,
    burstRadius: 90,
    ringWidth: 6,
    alpha: 0.9,
  },
  // Premio preso, vicino agli eroi (pixel dello schermo logico): offsetY sopra il numero dei soldati la quantità con la
  // sua parola ("+1 legno"), più piccola della scritta dei cancelli e del colore della sua cassa, almeno edge dal
  // bordo dello schermo; più tipi insieme stanno uno sopra l'altro, a rowHeight. I premi dello stesso tipo presi mentre
  // la scritta è ferma (holdMs) si sommano in quella ("+3 legno"), che riparte; poi sale di rise e sfuma in fadeMs.
  // Compare, e a ogni premio in più, ingrandita di popScale, che torna normale in popMs
  lootGain: {
    holdMs: 800,
    fadeMs: 500,
    offsetY: 56,
    rowHeight: 44,
    rise: 40,
    edge: 12,
    popMs: 180,
    popScale: 0.35,
    style: {
      fontFamily: FONT,
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
  // Nel mondo (fx/worldFx.js): il premio di una raccolta sale sopra la casella di rise pixel dello schermo e sfuma in
  // durationMs; la nebbia di un'area conquistata se ne va in durationMs, come quella leggera dell'area dopo arriva; la
  // casella da toccare per andare avanti (cellFlash) si accende e si spegne pulses volte, pulseMs a salire e
  // altrettanti a scendere, piena di color con l'opacità alpha e con il bordo largo lineWidth pixel del mondo (senza
  // effetti resta accesa ferma per lo stesso tempo)
  worldGain: {
    durationMs: 1300,
    rise: 70,
    style: {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffe680',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
  fogReveal: { durationMs: 1200 },
  cellFlash: { color: 0xffe680, alpha: 0.55, lineWidth: 4, pulseMs: 280, pulses: 3 },
  poolSize: 16,
};
