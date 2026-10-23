// Livello 1. Tetti: maxArmy, soldati al massimo eroe compreso (oltre, i cancelli non aggiungono soldati);
// maxGateValue, valore massimo che un cancello può raggiungere caricandolo con i colpi
export const LIMITS = {
  maxArmy: 100,
  maxGateValue: 10,
};

// Ondate del livello, in ordine. Per ognuna:
// duration, secondi di gioco; scrollSpeed, velocità del campo (unità/s), fissa per tutta l'ondata;
// enemyHp, vita dei nemici normali (gli altri tipi ne hanno una parte o un multiplo, data/enemies.js);
// spawnInterval, secondi tra un arrivo di nemici e il successivo.
// Ogni arrivo è uno sciame con probabilità swarmChance: swarm.count pedine (meglio un multiplo delle
// colonne) su swarm.lanes corsie vicine. Altrimenti è una fila di rowSize nemici affiancati su corsie
// diverse con probabilità rowChance, o un nemico solo. Ogni nemico di una fila o solo è di un tipo
// speciale con la probabilità scritta in specials, altrimenti è normale.
// gates: i cancelli dell'ondata (tipi in data/gates.js). Ogni arrivo di cancelli è una coppia in due corsie
// diverse con probabilità pairChance, con i tipi di una delle coppie in pairs (scelta secondo weight); altrimenti
// è un cancello solo, di un tipo scelto con le probabilità di singles. I +N partono da plus, i negativi da minus
// e salgono di minusStep a ogni scatto: abbastanza da superare il +N accanto, se gli si spara in tempo.
// Livello breve e fitto: i tipi entrano a poco a poco e nell'ultima ondata ci sono tutti
export const WAVES = [
  {
    duration: 25,
    scrollSpeed: 190,
    enemyHp: 6,
    spawnInterval: 1.3,
    rowChance: 0.1,
    rowSize: 2,
    swarmChance: 0,
    swarm: { count: 0, lanes: 1 },
    specials: {},
    gates: {
      plus: 4,
      minus: -2,
      minusStep: 3,
      pairChance: 0.3,
      singles: { plus: 0.85, minus: 0.15 },
      pairs: [{ kinds: ['plus', 'minus'], weight: 1 }],
    },
  },
  {
    duration: 25,
    scrollSpeed: 250,
    enemyHp: 9,
    spawnInterval: 1.25,
    rowChance: 0.2,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 10, lanes: 1 },
    specials: { fast: 0.2 },
    gates: {
      plus: 4,
      minus: -4,
      minusStep: 4,
      pairChance: 0.5,
      singles: { plus: 0.65, minus: 0.25, multiply: 0.1 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.5 },
        { kinds: ['plus', 'multiply'], weight: 0.3 },
        { kinds: ['plus', 'launcher'], weight: 0.2 },
      ],
    },
  },
  {
    duration: 25,
    scrollSpeed: 320,
    enemyHp: 13,
    spawnInterval: 1.1,
    rowChance: 0.25,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 15, lanes: 1 },
    specials: { fast: 0.15, armored: 0.2, shooter: 0.1 },
    gates: {
      plus: 5,
      minus: -6,
      minusStep: 7,
      pairChance: 0.5,
      singles: { plus: 0.5, minus: 0.25, heal: 0.15, power: 0.1 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.35 },
        { kinds: ['plus', 'multiply'], weight: 0.15 },
        { kinds: ['multiply', 'divide'], weight: 0.3 },
        { kinds: ['burst', 'launcher'], weight: 0.2 },
      ],
    },
  },
  {
    duration: 25,
    scrollSpeed: 400,
    enemyHp: 19,
    spawnInterval: 1,
    rowChance: 0.3,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 20, lanes: 2 },
    specials: { fast: 0.15, armored: 0.15, elite: 0.12, shooter: 0.15 },
    gates: {
      plus: 5,
      minus: -8,
      minusStep: 8,
      pairChance: 0.6,
      singles: { plus: 0.4, minus: 0.25, heal: 0.2, power: 0.15 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.3 },
        { kinds: ['plus', 'multiply'], weight: 0.2 },
        { kinds: ['multiply', 'divide'], weight: 0.15 },
        { kinds: ['plus', 'divide'], weight: 0.15 },
        { kinds: ['rifle', 'burst'], weight: 0.1 },
        { kinds: ['rifle', 'launcher'], weight: 0.1 },
      ],
    },
  },
];

// Boss di fine livello: arriva dopo l'ultima ondata e una pausa di LEVEL.breakSeconds, nella corsia lane.
// hp, vita totale, divisa in layers strati uguali; scrollSpeed, velocità del campo mentre c'è il boss.
// Viene avanti con il campo fino a holdZ, a tiro dell'esercito, e lì si pianta: non si scontra mai.
// Da piantato ripete: pausa di restSeconds; avviso di smash.warnSeconds con una zona tonda di raggio
// smash.radius segnata a terra dove sta l'eroe; schiacciamento (i soldati dentro muoiono, l'eroe dentro perde
// la vita del tipo boss); passaggio in un'altra corsia a caso a moveSpeed unità/s.
// Scorta: finché il boss è sulla strada e non sta cambiando corsia, ogni escort.interval secondi gli esce
// uno sciame di escort.count pedine in una corsia a caso: davanti a lui (a escort.gap unità) nella sua corsia,
// al suo fianco nelle altre; non esce se la sua prima fila sarebbe più vicina di escort.minZ, cioè troppo
// vicina all'esercito per dare il tempo di reagire. enemyHp: vita dei nemici normali in questa fase, da cui viene quella della scorta
export const BOSS = {
  hp: 1500,
  layers: 6,
  lane: 1,
  scrollSpeed: 300,
  holdZ: 700,
  restSeconds: 1.5,
  moveSpeed: 160,
  smash: { warnSeconds: 1.2, radius: 120 },
  enemyHp: 19,
  escort: { interval: 3, count: 10, gap: 30, minZ: 400 },
};
