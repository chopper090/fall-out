// Livello 1. Tetti: maxArmy, soldati al massimo eroe compreso (oltre, i cancelli non danno più nulla);
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
    specials: { fast: 0.15, armored: 0.2 },
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
    specials: { fast: 0.15, armored: 0.15, elite: 0.12 },
  },
];
