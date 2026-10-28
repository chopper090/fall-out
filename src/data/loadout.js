import { HEROES, LINEUP } from './heroes.js';

// Cosa porta in battaglia una partita (systems/battle.js createBattle), dal meta-gioco (meta/loadout.js): heroes, gli
// eroi in campo con i loro numeri e il loro posto; soldiers, i soldati di partenza in più (la caserma, élite comprese);
// army, quanti ne ha l'esercito per tipo (data/units.js SOLDIER_TYPES), che dà anche le proporzioni dei soldati che
// arrivano dalle porte (systems/army.js); weapons, le
// migliorie delle armi dei soldati (la fucina: damage e fireRate in più, autoAim per il lanciatore che mira da solo);
// rules, le regole della battaglia (quanto sono duri i nemici, il tipo e il numero sulla strada, enemyHpScale, type e
// number: una casella della strada, data/road.js, o la sfida, data/village.js), null in una battaglia normale.
// STARTING_LOADOUT è quello di una battaglia senza meta-gioco (il simulatore e le prove): lo schieramento di partenza
// con i numeri di base e senza villaggio, con cinque fucilieri ogni lanciatore: forte come la folla di prima della
// caserma, che prendeva l'arma dall'eroe più vicino (un lanciatore ogni tre fucilieri, attorno al Difensore: dietro a
// tutti i lanciatori durano di più, e ne bastano meno)
export const STARTING_LOADOUT = {
  heroes: LINEUP.map(({ hero, slot }) => ({ hero: HEROES[hero], slot })),
  soldiers: 0,
  army: { rifle: 5, burst: 0, launcher: 1, elite: 0 },
  weapons: { damage: 0, fireRate: 0, autoAim: false },
  rules: null,
};
