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
// Ogni arrivo è uno sciame con probabilità swarmChance: swarm.count cubetti (meglio un multiplo delle
// colonne) su swarm.lanes corsie vicine. Altrimenti è una fila di rowSize nemici affiancati su corsie
// diverse con probabilità rowChance, o un nemico solo. Ogni nemico di una fila o solo è di un tipo
// speciale con la probabilità scritta in specials, altrimenti è normale.
// I tipi entrano uno alla volta e poi si mescolano, sempre più spesso
export const WAVES = [
  {
    duration: 40,
    scrollSpeed: 100,
    enemyHp: 5,
    spawnInterval: 1.6,
    rowChance: 0.1,
    rowSize: 2,
    swarmChance: 0,
    swarm: { count: 0, lanes: 1 },
    specials: {},
  },
  {
    duration: 40,
    scrollSpeed: 175,
    enemyHp: 9,
    spawnInterval: 1.4,
    rowChance: 0.15,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 10, lanes: 1 },
    specials: {},
  },
  {
    duration: 40,
    scrollSpeed: 250,
    enemyHp: 14,
    spawnInterval: 1.2,
    rowChance: 0.2,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 15, lanes: 1 },
    specials: { fast: 0.25 },
  },
  {
    duration: 40,
    scrollSpeed: 325,
    enemyHp: 21,
    spawnInterval: 1,
    rowChance: 0.25,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 20, lanes: 2 },
    specials: { fast: 0.15, armored: 0.2 },
  },
  {
    duration: 40,
    scrollSpeed: 400,
    enemyHp: 26,
    spawnInterval: 0.9,
    rowChance: 0.3,
    rowSize: 2,
    swarmChance: 0.25,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.15, elite: 0.1 },
  },
];
