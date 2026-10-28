import { armyOf } from './barracks.js';
import { lineupHeroes } from './heroes.js';
import { villageBonus } from './village.js';

// Cosa porta in battaglia il giocatore (data/loadout.js): gli eroi dello schieramento con i loro numeri, i soldati e le
// armi del villaggio, l'esercito formato in caserma (meta/barracks.js); rules, le regole della battaglia (una casella
// della strada o la sfida), null in una battaglia normale
export function loadoutFrom(profile, rules = null) {
  return { heroes: lineupHeroes(profile), ...villageBonus(profile.village.levels), army: armyOf(profile), rules };
}
