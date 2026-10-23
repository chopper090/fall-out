import { WEAPONS } from './units.js';

// Eroi in battaglia, fino a 5, ognuno con il suo ruolo, la sua vita (maxHp), un'arma sua e un'abilità automatica
// con ricarica. L'arma parte da una di quelle dei soldati (data/units.js) con numeri propri: i posti della folla
// più vicini all'eroe partono con la stessa arma. Capo e fuciliere hanno il colpo normale, il fucile.
// leader: se muore lui la missione fallisce; gli altri, morti, spariscono con la loro abilità per il resto del
// livello. power: la potenza, per il confronto prima di partire.
// Abilità (ability.kind): shockwave, onda d'urto che colpisce per damage tutti i nemici entro radius dall'eroe,
// quando ce n'è almeno uno; pierce, colpo che perfora la colonna davanti all'eroe fino a range colpendo tutti
// per damage, quando c'è qualcuno; shield, scudo che ferma i colpi nemici per seconds, alzato reactSeconds prima
// che uno arrivi; rapidFire, fuoco rapido: per seconds chi spara entro radius da lui (lui, gli altri eroi e i
// soldati) spara fireRateScale volte più in fretta; parte quando un nemico è davanti a lui, a tiro della sua arma
// ed entro radius di lato.
// Ogni abilità si ricarica in cooldownSeconds. id: lo stesso della chiave; detail: il segno sulla pedina (collare,
// elmo, pennacchio o fascia, config/balance.js)
export const HEROES = {
  leader: {
    id: 'leader',
    name: 'Capo',
    role: 'Comando',
    leader: true,
    maxHp: 5,
    power: 30,
    detail: 'collar',
    colors: { top: 0x7aa6ff, front: 0x3d7bff, side: 0x2a56b8 },
    weapon: { ...WEAPONS.rifle, fireRate: 3, damage: 3 },
    ability: { kind: 'shockwave', cooldownSeconds: 12, radius: 220, damage: 12 },
  },
  sniper: {
    id: 'sniper',
    name: 'Cecchino',
    role: 'Lungo raggio',
    leader: false,
    maxHp: 3,
    power: 25,
    detail: 'plume',
    colors: { top: 0x9ad0ff, front: 0x2f8fe6, side: 0x1f5fa8 },
    weapon: { ...WEAPONS.rifle, fireRate: 1, damage: 3.3, speed: 2200, range: 1400 },
    ability: { kind: 'pierce', cooldownSeconds: 10, damage: 15, range: 1600, width: 40 },
  },
  defender: {
    id: 'defender',
    name: 'Difensore',
    role: 'Difesa',
    leader: false,
    maxHp: 6,
    power: 25,
    detail: 'helmet',
    colors: { top: 0xb8a9ff, front: 0x6a52e6, side: 0x3e2fa6 },
    weapon: { ...WEAPONS.launcher, fireRate: 0.5, damage: 8, radius: 110 },
    ability: { kind: 'shield', cooldownSeconds: 14, seconds: 2, reactSeconds: 0.8 },
  },
  rifleman: {
    id: 'rifleman',
    name: 'Fuciliere',
    role: 'Assalto',
    leader: false,
    maxHp: 4,
    power: 25,
    detail: 'band',
    colors: { top: 0x8fb4ff, front: 0x2f62d9, side: 0x1f3f94 },
    weapon: { ...WEAPONS.rifle, fireRate: 3, damage: 3 },
    ability: { kind: 'rapidFire', cooldownSeconds: 12, seconds: 3, fireRateScale: 2, radius: 160 },
  },
};

// Chi scende in campo e in quale posto (HERO.slots in config/balance.js: 0 e 1 davanti, 2-4 dietro)
export const LINEUP = [
  { hero: 'leader', slot: 0 },
  { hero: 'rifleman', slot: 1 },
  { hero: 'sniper', slot: 3 },
  { hero: 'defender', slot: 4 },
];
