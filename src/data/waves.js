// Livello 1. maxArmy: soldati in campo al massimo, capo compreso; quelli in più restano dietro come riserve
// (ARMY.reserves in config/balance.js). multiplyMax: soldati in più al massimo da un ×2
export const LIMITS = {
  maxArmy: 100,
  multiplyMax: 30,
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
// è un cancello solo, di un tipo scelto con le probabilità di singles. I +N partono da plus, i negativi da minus;
// ogni colpo li alza di uno (GATES.perHit) fino al loro massimo, plusMax e minusMax: un negativo girato in tempo
// vale più del +N che ha accanto. I cancelli danno truppe (e vita agli eroi), gli scrigni potenza di fuoco.
// chests: gli scrigni dell'ondata (ricompense in data/chests.js): servono hits colpi per aprirli, e la ricompensa
// si sceglie con le probabilità di rewards. Lo scrigno resta a tiro meno a lungo nelle ondate veloci: hits tiene
// conto di quanti colpi fa in tempo a sparare una folla centrata su di lui.
// Livello breve e fitto: i tipi entrano a poco a poco e nell'ultima ondata ci sono tutti. Vita dei nemici
// tarata su quattro eroi in campo (data/heroes.js)
export const WAVES = [
  {
    duration: 25,
    scrollSpeed: 190,
    enemyHp: 10,
    spawnInterval: 1.3,
    rowChance: 0.1,
    rowSize: 2,
    swarmChance: 0,
    swarm: { count: 0, lanes: 1 },
    specials: {},
    gates: {
      plus: 1,
      minus: -6,
      plusMax: 5,
      minusMax: 8,
      pairChance: 0.3,
      singles: { plus: 0.85, minus: 0.15 },
      pairs: [{ kinds: ['plus', 'minus'], weight: 1 }],
    },
    chests: { hits: 70, rewards: { damage: 0.5, fireRate: 0.5 } },
  },
  {
    duration: 25,
    scrollSpeed: 250,
    enemyHp: 26,
    spawnInterval: 1.25,
    rowChance: 0.2,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 10, lanes: 1 },
    specials: { fast: 0.2 },
    gates: {
      plus: 1,
      minus: -14,
      plusMax: 6,
      minusMax: 9,
      pairChance: 0.5,
      singles: { plus: 0.65, minus: 0.25, multiply: 0.1 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.6 },
        { kinds: ['plus', 'multiply'], weight: 0.4 },
      ],
    },
    chests: { hits: 135, rewards: { damage: 0.4, fireRate: 0.4, burst: 0.2 } },
  },
  {
    duration: 25,
    scrollSpeed: 320,
    enemyHp: 47,
    spawnInterval: 1.1,
    rowChance: 0.25,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 15, lanes: 1 },
    specials: { fast: 0.15, armored: 0.2, shooter: 0.1 },
    gates: {
      plus: 1,
      minus: -26,
      plusMax: 6,
      minusMax: 10,
      pairChance: 0.5,
      singles: { plus: 0.6, minus: 0.25, heal: 0.15 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.45 },
        { kinds: ['plus', 'multiply'], weight: 0.2 },
        { kinds: ['multiply', 'divide'], weight: 0.35 },
      ],
    },
    chests: { hits: 115, rewards: { damage: 0.425, fireRate: 0.425, burst: 0.15 } },
  },
  {
    duration: 25,
    scrollSpeed: 400,
    enemyHp: 73,
    spawnInterval: 1,
    rowChance: 0.3,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 20, lanes: 2 },
    specials: { fast: 0.15, armored: 0.15, elite: 0.12, shooter: 0.15 },
    gates: {
      plus: 1,
      minus: -34,
      plusMax: 7,
      minusMax: 11,
      pairChance: 0.6,
      singles: { plus: 0.55, minus: 0.25, heal: 0.2 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.35 },
        { kinds: ['plus', 'multiply'], weight: 0.25 },
        { kinds: ['multiply', 'divide'], weight: 0.2 },
        { kinds: ['plus', 'divide'], weight: 0.2 },
      ],
    },
    chests: { hits: 95, rewards: { damage: 0.5, fireRate: 0.5 } },
  },
];

// Potenza consigliata per il livello, da confrontare con quella dello schieramento prima di partire
export const LEVEL_INFO = {
  recommendedPower: 105,
};

// Boss di fine livello: arriva dopo l'ultima ondata e una pausa di LEVEL.breakSeconds, nella corsia lane.
// hp, vita totale, divisa in layers strati uguali; scrollSpeed, velocità del campo mentre c'è il boss.
// Viene avanti con il campo fino a holdZ, a tiro dell'esercito, e lì si pianta: non si scontra mai.
// Da piantato ripete: pausa di restSeconds; avviso di smash.warnSeconds con una zona tonda di raggio
// smash.radius segnata a terra dove sta il capo; schiacciamento (i soldati dentro muoiono, gli eroi dentro perdono
// la vita del tipo boss); passaggio in un'altra corsia a caso a moveSpeed unità/s.
// Scorta: finché il boss è sulla strada e non sta cambiando corsia, ogni escort.interval secondi gli esce
// uno sciame di escort.count pedine in una corsia a caso: davanti a lui (a escort.gap unità) nella sua corsia,
// al suo fianco nelle altre; non esce se la sua prima fila sarebbe più vicina di escort.minZ, cioè troppo
// vicina all'esercito per dare il tempo di reagire. enemyHp: vita dei nemici normali in questa fase, da cui viene quella della scorta
export const BOSS = {
  hp: 3900,
  layers: 6,
  lane: 1,
  scrollSpeed: 300,
  holdZ: 700,
  restSeconds: 1.5,
  moveSpeed: 160,
  smash: { warnSeconds: 1.2, radius: 120 },
  enemyHp: 44,
  escort: { interval: 3, count: 10, gap: 30, minZ: 400 },
};
