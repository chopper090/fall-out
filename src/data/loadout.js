import { HEROES, LINEUP } from './heroes.js';

// Cosa porta in battaglia una partita (systems/battle.js createBattle), dal meta-gioco (meta/loadout.js): heroes, gli
// eroi in campo con i loro numeri e il loro posto; soldiers, i soldati di partenza in più (la caserma); weapons, le
// migliorie delle armi dei soldati (la fucina: damage e fireRate in più, autoAim per il lanciatore che mira da solo);
// challenge, le regole della sfida (data/village.js), null in una battaglia normale.
// STARTING_LOADOUT è quello di una battaglia senza meta-gioco (il simulatore e le prove): lo schieramento di partenza
// con i numeri di base e senza villaggio
export const STARTING_LOADOUT = {
  heroes: LINEUP.map(({ hero, slot }) => ({ hero: HEROES[hero], slot })),
  soldiers: 0,
  weapons: { damage: 0, fireRate: 0, autoAim: false },
  challenge: null,
};
