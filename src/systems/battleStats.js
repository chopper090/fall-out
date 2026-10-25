import { EVENTS } from '../core/events.js';

// Statistiche di ogni eroe schierato, per il riepilogo di fine battaglia: danno fatto ai nemici (dopo l'armatura, il
// colpo di troppo compreso) con la sua arma e la sua abilità, danno subito e nemici abbattuti (chi dà il colpo che
// uccide). I colpi dei soldati non contano per nessun eroe. Restituisce una voce per eroe, in ordine di schieramento
export function createBattleStats(bus, heroes) {
  const byHero = new Map(heroes.map((hero) => [hero, { id: hero.id, damageDealt: 0, damageTaken: 0, kills: 0 }]));
  // Il nemico ha già perso la vita di questo colpo (systems/spawn.js lo sente prima): a zero o sotto, l'ha ucciso
  bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage, hero }) => {
    const entry = byHero.get(hero);
    if (entry === undefined) return;
    entry.damageDealt += damage;
    if (enemy.hp <= 0) entry.kills += 1;
  });
  bus.on(EVENTS.HERO_HIT, ({ hero, damage }) => {
    const entry = byHero.get(hero);
    if (entry !== undefined) entry.damageTaken += damage;
  });
  return [...byHero.values()];
}
