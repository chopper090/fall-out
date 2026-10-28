import { HEROES, LINEUP } from './heroes.js';

// Cosa porta in battaglia una partita (systems/battle.js createBattle), dal meta-gioco (meta/loadout.js): heroes, gli
// eroi in campo con i loro numeri e il loro posto; soldiers, i soldati di partenza in più (la caserma, élite comprese);
// army, quanti ne ha l'esercito per tipo (data/units.js SOLDIER_TYPES), che dà anche le proporzioni dei soldati che
// arrivano dalle porte (systems/army.js); weapons, le armi dei soldati migliorate dalla fucina (paths, i
// miglioramenti di ogni arma: meta/forge.js weaponPaths);
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
  weapons: { paths: {} },
  rules: null,
};
