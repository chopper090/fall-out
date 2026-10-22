// Tipi di nemico: tutti cubi rossi, di misure e tonalità diverse. Per ognuno:
// size, lato del cubo in unità del mondo; hpScale, vita in proporzione a quella dell'ondata (almeno 1);
// armor, danno tolto a ogni colpo; extraSpeed, unità/s in più della velocità del campo;
// heroDamage, vita tolta all'eroe se lo tocca; showStats, barra della vita e numeri del danno sopra di lui
export const ENEMY_TYPES = {
  grunt: {
    size: 80,
    hpScale: 1,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 1,
    showStats: true,
    colors: { top: 0xff8a80, front: 0xe53935, side: 0xa52a2a },
  },
  // Cubetti grandi come i nostri soldati, arrivano a blocchi: muoiono in fretta, ma ognuno che arriva
  // si porta via un soldato. Troppo piccoli per barra e numeri
  swarm: {
    size: 22,
    hpScale: 0.1,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 1,
    showStats: false,
    colors: { top: 0xffb4a8, front: 0xff6a5c, side: 0xc4473b },
  },
  // Piccolo e fragile, corre più del campo
  fast: {
    size: 56,
    hpScale: 0.5,
    armor: 0,
    extraSpeed: 250,
    heroDamage: 1,
    showStats: true,
    colors: { top: 0xffa184, front: 0xf4511e, side: 0xb23a14 },
  },
  // La pioggia di colpi deboli lo scalfisce appena
  armored: {
    size: 90,
    hpScale: 1.5,
    armor: 0.6,
    extraSpeed: 0,
    heroDamage: 1,
    showStats: true,
    colors: { top: 0xc9a2a2, front: 0x8e3b3b, side: 0x5c2626 },
  },
  // Grande e con tanta vita: va abbattuto concentrando il fuoco
  elite: {
    size: 120,
    hpScale: 3,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 2,
    showStats: true,
    colors: { top: 0xff5c7a, front: 0xb0102f, side: 0x700a1e },
  },
};

// Sciame: cubetti in griglia, columnsPerLane colonne per corsia, a spacing unità l'uno dall'altro
export const SWARM = {
  columnsPerLane: 5,
  spacing: 32,
};
