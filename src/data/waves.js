// Livello 1. Tetti: maxArmy, soldati al massimo eroe compreso (oltre, i cancelli non danno più nulla);
// maxGateValue, valore massimo che un cancello può raggiungere caricandolo con i colpi
export const LIMITS = {
  maxArmy: 100,
  maxGateValue: 10,
};

// Ondate del livello, in ordine. Per ognuna:
// duration, secondi di gioco; scrollSpeed, velocità del campo (unità/s), fissa per tutta l'ondata;
// enemyHp, vita dei nemici; spawnInterval, secondi tra un arrivo di nemici e il successivo;
// rowChance, probabilità che un arrivo sia una fila di rowSize nemici affiancati su corsie diverse
export const WAVES = [
  { duration: 40, scrollSpeed: 100, enemyHp: 5, spawnInterval: 2, rowChance: 0, rowSize: 2 },
  { duration: 40, scrollSpeed: 175, enemyHp: 9, spawnInterval: 1.6, rowChance: 0.15, rowSize: 2 },
  { duration: 40, scrollSpeed: 250, enemyHp: 14, spawnInterval: 1.3, rowChance: 0.25, rowSize: 2 },
  { duration: 40, scrollSpeed: 325, enemyHp: 21, spawnInterval: 1, rowChance: 0.35, rowSize: 3 },
  { duration: 40, scrollSpeed: 400, enemyHp: 30, spawnInterval: 0.8, rowChance: 0.45, rowSize: 3 },
];
