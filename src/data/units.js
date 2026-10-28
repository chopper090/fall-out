// Armi dei soldati: ogni posto della folla parte con l'arma dell'eroe più vicino, gli scrigni d'arma la cambiano
// alla parte di folla che sta davanti a loro quando si aprono (data/chests.js). Gli eroi hanno un'arma loro,
// presa da queste con numeri propri (data/heroes.js). Per ognuna: name, lo stesso della chiave; fireRate, colpi
// al secondo a soldato; damage, danno di ogni colpo; speed, unità/s; range, fin dove arriva davanti agli eroi;
// size, grandezza del colpo; colors, del colpo; soldierColors, dei soldati che la usano; label, il nome sopra lo
// scrigno che la dà.
// Fucile (straight): colpi dritti, medio raggio. Élite: il fucile delle truppe élite, con il doppio del danno; non
// lo dà nessuno scrigno. Raffica (fan): pellets colpi deboli per volta, aperti a ventaglio
// di spreadDeg gradi in tutto, a corto raggio. Lanciatore (lob): granate lente a parabola, alte arcHeight, che
// volano sopra tutto e scoppiano in fondo alla gittata colpendo forte tutti i nemici entro radius (i soldati, con la
// fucina dal livello autoAimLevel, mirano invece al nemico più vicino davanti: systems/combat.js); senza mira non
// toccano cancelli e scrigni né chi è già più vicino: da solo non difende, in mezzo agli altri sfonda.
// Scoppia appena oltre dove si pianta il boss (BOSS.holdZ), abbastanza vicino da colpirlo
export const WEAPONS = {
  rifle: {
    name: 'rifle',
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
  elite: {
    name: 'elite',
    kind: 'straight',
    fireRate: 1.5,
    damage: 6,
    speed: 1900,
    range: 1000,
    size: 16,
    label: 'Fucile élite',
    colors: { top: 0xffffff, front: 0xc5d3ff, side: 0x8fa4e8 },
    soldierColors: { top: 0xf2f5ff, front: 0xa9bdff, side: 0x6d86d9 },
  },
  burst: {
    name: 'burst',
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
    name: 'launcher',
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

// Truppe élite (le danno gli scrigni, data/chests.js): hanno lives vite (un colpo nemico o uno schiacciamento ne
// toglie una, uno scontro tante quanta vita resta al nemico), sparano con weapon, l'arma élite, che non cambia mai, e
// stanno nei posti della folla più vicini agli eroi. Pedine più grandi dei soldati (size e height in unità del
// mondo), color argento con il pennacchio, per vederle a colpo d'occhio
export const ELITE = { lives: 3, weapon: 'elite', size: 26, height: 40 };

// Tipi di soldati che la caserma addestra (meta/barracks.js): ognuno con il suo nome (label), la sua arma (weapon, in
// WEAPONS) e il livello della caserma da cui si addestra (barracks): fucilieri dal primo, raffica dal secondo,
// lanciatori dal terzo, élite dal quinto
export const SOLDIER_TYPES = {
  rifle: { label: 'Fucilieri', weapon: 'rifle', barracks: 1 },
  burst: { label: 'Raffica', weapon: 'burst', barracks: 2 },
  launcher: { label: 'Lanciatori', weapon: 'launcher', barracks: 3 },
  elite: { label: 'Élite', weapon: 'elite', barracks: 5 },
};
