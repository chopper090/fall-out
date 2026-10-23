// Tipi di nemico: tutti pedine rosse, di misure, tonalità e sagome diverse. Per ognuno:
// size, larghezza della base in unità del mondo (è anche l'ingombro per colpi e scontri);
// height, altezza della pedina (la sagoma è in PAWNS, config/balance.js);
// hpScale, vita in proporzione a quella dell'ondata (almeno 1);
// armor, danno tolto a ogni colpo; extraSpeed, unità/s in più della velocità del campo;
// heroDamage, vita tolta all'eroe se lo tocca (o se lo colpisce con un suo colpo); healthBar e damageNumbers,
// barra della vita e numeri del danno sopra di lui quando è colpito; hitFlash, lampo a ogni colpo;
// fire, solo per chi spara (systems/enemyFire.js)
export const ENEMY_TYPES = {
  grunt: {
    size: 68,
    height: 92,
    hpScale: 1,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 1,
    healthBar: true,
    damageNumbers: true,
    hitFlash: true,
    colors: { top: 0xff8a80, front: 0xe53935, side: 0xa52a2a },
  },
  // Pedine piccole e tonde, grandi come i nostri soldati, arrivano a blocchi: muoiono in fretta, ma ognuna
  // che arriva si porta via un soldato. Troppo piccole per barra e numeri
  swarm: {
    size: 19,
    height: 30,
    hpScale: 0.1,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 1,
    healthBar: false,
    damageNumbers: false,
    hitFlash: true,
    colors: { top: 0xffb4a8, front: 0xff6a5c, side: 0xc4473b },
  },
  // Piccolo, slanciato e fragile, corre più del campo
  fast: {
    size: 48,
    height: 80,
    hpScale: 0.5,
    armor: 0,
    extraSpeed: 250,
    heroDamage: 1,
    healthBar: true,
    damageNumbers: true,
    hitFlash: true,
    colors: { top: 0xffa184, front: 0xf4511e, side: 0xb23a14 },
  },
  // Con l'elmo piatto: la pioggia di colpi deboli lo scalfisce appena
  armored: {
    size: 76,
    height: 96,
    hpScale: 1.5,
    armor: 1.8,
    extraSpeed: 0,
    heroDamage: 1,
    healthBar: true,
    damageNumbers: true,
    hitFlash: true,
    colors: { top: 0xc9a2a2, front: 0x8e3b3b, side: 0x5c2626 },
  },
  // Grande, con la corona e tanta vita: va abbattuto concentrando il fuoco
  elite: {
    size: 102,
    height: 146,
    hpScale: 3,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 2,
    healthBar: true,
    damageNumbers: true,
    hitFlash: true,
    colors: { top: 0xff5c7a, front: 0xb0102f, side: 0x700a1e },
  },
  // Tiratore: con la canna puntata verso di noi. Arrivato a fire.stopZ, appena oltre la gittata dei nostri colpi,
  // si ferma per fire.stopSeconds e spara ogni fire.interval secondi, il primo dopo fire.firstDelay: intanto
  // si possono solo schivare i suoi colpi. Poi riparte con il campo come gli altri ed entra a tiro.
  // I suoi colpi sono in ENEMY_SHOT (config/balance.js)
  shooter: {
    size: 62,
    height: 112,
    hpScale: 1,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 1,
    healthBar: true,
    damageNumbers: true,
    hitFlash: true,
    fire: { stopZ: 1150, stopSeconds: 3, interval: 1, firstDelay: 0.4 },
    colors: { top: 0xf48fb1, front: 0xc2185b, side: 0x880e4f },
  },
  // Boss di fine livello: enorme, con le corna. La sua vita la decide il livello (BOSS, data/waves.js) ed è
  // divisa in strati, che mostra la barra in alto: niente barra piccola, e lampeggia solo quando si rompe
  // uno strato (a ogni colpo resterebbe sempre bianco). heroDamage: vita tolta all'eroe dallo schiacciamento
  boss: {
    size: 200,
    height: 300,
    armor: 0,
    extraSpeed: 0,
    heroDamage: 2,
    healthBar: false,
    damageNumbers: true,
    hitFlash: false,
    colors: { top: 0xff7a6b, front: 0x9e1b1b, side: 0x5a0d0d },
  },
};

// Sciame: pedine in griglia, columnsPerLane colonne per corsia, a spacing unità l'uno dall'altro
export const SWARM = {
  columnsPerLane: 5,
  spacing: 32,
};
