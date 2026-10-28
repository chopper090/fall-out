// Crescita degli eroi (meta/heroes.js). Livelli: da 1 a maxLevel, si comprano uno alla volta (Addestra) con
// l'esperienza delle scorte, che portano le battaglie, e con un po' di materiali: per passare dal livello n al
// successivo servono round(xpBase × n^xpGrowth) punti di esperienza, e levelMaterials.wood × n di legno fino al
// livello levelMaterials.switchAt, poi levelMaterials.gears × (n − switchAt + 1) ingranaggi. Il livello del centro
// città fa da tetto: levelCaps[c − 1] con il centro al livello c. Ogni livello oltre il primo dà levelBonus in più di
// vita e di danno (arma e abilità). Stelle: da 1 a maxStars, con i frammenti dell'eroe; per salire dalla stella n alla
// n + 1 servono starCosts[n - 1] frammenti; ogni stella oltre la prima dà starBonus in più di vita e di danno, e alle
// stelle di abilityStars l'abilità migliora: abilityDamage di danno in più e abilityCooldown di ricarica in meno, ogni
// volta. Reclutamento: un tiro costa cost piastrine; la rarità si pesca con le chance di RARITIES (data/heroes.js), ma
// ogni pity tiri ne arriva almeno uno raro; un eroe già posseduto dà i suoi frammenti. Chi comincia ha startTags
// piastrine
export const GROWTH = {
  maxLevel: 20,
  xpBase: 40,
  xpGrowth: 1.3,
  levelMaterials: { switchAt: 10, wood: 6, gears: 3 },
  levelCaps: [6, 9, 12, 16, 20],
  levelBonus: 0.06,
  maxStars: 5,
  starCosts: [10, 20, 40, 80],
  starBonus: 0.15,
  abilityStars: [3, 5],
  abilityDamage: 0.3,
  abilityCooldown: 0.15,
};

export const RECRUIT = {
  cost: 5,
  pity: 10,
  startTags: 10,
};
