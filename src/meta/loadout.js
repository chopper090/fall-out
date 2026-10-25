import { lineupHeroes } from './heroes.js';
import { villageBonus } from './village.js';

// Cosa porta in battaglia il giocatore (data/loadout.js): gli eroi dello schieramento con i loro numeri, i soldati e
// le armi del villaggio; challenge, le regole della sfida (data/village.js), null in una battaglia normale
export function loadoutFrom(profile, challenge = null) {
  return { heroes: lineupHeroes(profile), ...villageBonus(profile.village.levels), challenge };
}
