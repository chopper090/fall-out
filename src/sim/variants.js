import { ARMY } from '../config/balance.js';
import { CATEGORIES } from '../data/heroes.js';
import { BOSS, WAVES } from '../data/waves.js';

// Modi di cambiare il rapporto di potenza (SIM.sweeps), per vedere quanto si vince a ogni rapporto: ognuno cambia
// i dati del gioco di un valore. Si applicano una volta sola, nel processo che gioca quel punto (sim/worker.js)
export const VARIANTS = {
  // Vita di tutti i nemici, boss e scorta compresi
  enemyHp(factor) {
    for (const wave of WAVES) wave.enemyHp = Math.round(wave.enemyHp * factor);
    BOSS.hp = Math.round(BOSS.hp * factor);
    BOSS.enemyHp = Math.round(BOSS.enemyHp * factor);
  },
  // Danno delle armi e delle abilità di tutti gli eroi (i numeri sono delle loro categorie)
  heroDamage(factor) {
    for (const { weapon, ability } of Object.values(CATEGORIES)) {
      weapon.damage *= factor;
      if (ability.share !== undefined) ability.share *= factor;
    }
  },
  heroHp(factor) {
    for (const category of Object.values(CATEGORIES)) category.maxHp *= factor;
  },
  startSoldiers(count) {
    ARMY.startSize += count;
  },
};
