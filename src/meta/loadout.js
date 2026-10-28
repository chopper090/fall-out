import { readyArmy } from './barracks.js';
import { weaponPaths } from './forge.js';
import { lineupHeroes } from './heroes.js';

// Cosa porta in battaglia il giocatore (data/loadout.js): gli eroi dello schieramento con i loro numeri, le armi dei
// soldati con i miglioramenti della fucina (meta/forge.js) e l'esercito formato in caserma senza i caduti
// (meta/barracks.js), che dice anche quanti soldati; rules, le regole della battaglia (una casella della strada o la
// sfida), null in una battaglia normale
export function loadoutFrom(profile, rules = null) {
  const army = readyArmy(profile);
  const soldiers = Object.values(army).reduce((sum, count) => sum + count, 0);
  const weapons = { paths: weaponPaths(profile.weaponLevels), levels: { ...profile.weaponLevels } };
  return { heroes: lineupHeroes(profile), weapons, soldiers, army, rules };
}
