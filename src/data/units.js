// Armi dei soldati: all'inizio tutti hanno il fucile, i cancelli d'arma la cambiano alla parte di folla che ci
// passa sotto. L'eroe ha la sua arma, dritta come il fucile ma con cadenza e danno suoi (HERO, config/balance.js).
// Per ognuna: fireRate, colpi al secondo a soldato; damage, danno di ogni colpo; speed, unità/s; range, fin dove
// arriva davanti all'eroe; size, grandezza del colpo; colors, del colpo; soldierColors, dei soldati che la usano;
// label, il nome sull'insegna del suo cancello.
// Fucile (straight): colpi dritti, medio raggio. Raffica (fan): pellets colpi deboli per volta, aperti a ventaglio
// di spreadDeg gradi in tutto, a corto raggio. Lanciatore (lob): granate lente a parabola, alte arcHeight, che
// volano sopra tutto e scoppiano sempre in fondo alla gittata colpendo forte tutti i nemici entro radius; non
// caricano i cancelli e non toccano chi è già più vicino: da solo non difende, in mezzo agli altri sfonda.
// Scoppia poco prima di dove si pianta il boss (BOSS.holdZ), abbastanza vicino da colpirlo
export const WEAPONS = {
  rifle: {
    kind: 'straight',
    fireRate: 1.5,
    damage: 3,
    speed: 1800,
    range: 1000,
    size: 14,
    label: 'Fucile',
    colors: { top: 0xd2e1ff, front: 0xa9c4ff, side: 0x7f9fe0 },
    soldierColors: { top: 0x7aa6ff, front: 0x3d7bff, side: 0x2a56b8 },
  },
  burst: {
    kind: 'fan',
    fireRate: 2.5,
    damage: 1.4,
    speed: 1500,
    range: 700,
    size: 9,
    pellets: 3,
    spreadDeg: 20,
    label: 'Raffica',
    colors: { top: 0xe0fbff, front: 0x9ee7ff, side: 0x5cc4e6 },
    soldierColors: { top: 0x9be7ff, front: 0x29b6f6, side: 0x0277bd },
  },
  launcher: {
    kind: 'lob',
    fireRate: 0.7,
    damage: 20,
    speed: 900,
    range: 650,
    size: 20,
    radius: 120,
    arcHeight: 260,
    label: 'Lanciatore',
    colors: { top: 0xc5b8ff, front: 0x4a3bc9, side: 0x2a1f8a },
    soldierColors: { top: 0xb8a9ff, front: 0x6a52e6, side: 0x3e2fa6 },
  },
};

// L'arma con cui parte ogni posto della folla (systems/army.js)
export const START_WEAPON = 'rifle';
