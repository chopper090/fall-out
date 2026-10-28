// Crescita degli eroi (meta/heroes.js). Livelli: da 1 a maxLevel, si comprano uno alla volta (Addestra) con
// l'esperienza delle scorte, che portano le battaglie, e con un po' di materiali: per passare dal livello n al
// successivo servono round(xpBase × n^xpGrowth) punti di esperienza, e levelMaterials.wood × n di legno fino al
// livello levelMaterials.switchAt, poi levelMaterials.gears × (n − switchAt + 1) ingranaggi. Il livello del centro
// città fa da tetto: levelCaps[c − 1] con il centro al livello c. Ogni livello oltre il primo dà levelBonus in più di
// vita e di danno (arma e abilità). Stelle: da 1 a maxStars, con i frammenti dell'eroe; per salire dalla stella n alla
// n + 1 servono starCosts[n - 1] frammenti; ogni stella oltre la prima dà starBonus in più di vita e di danno. Gradi
// del potere: da 1 a maxGrade, anche loro con i frammenti dell'eroe (gradeCosts[g - 1] per salire dal grado g); ogni
// grado oltre il primo dà al potere gradeDamage di forza in più e gradeCooldown di ricarica in meno, ogni volta.
// Reclutamento: un tiro costa cost piastrine; la rarità si pesca con le chance di RARITIES (data/heroes.js), con
// le garanzie di pity (almeno una rara ogni 10 tiri, una epica ogni 30, una leggendaria ogni 100); un eroe già
// posseduto dà i suoi frammenti. Chi comincia ha startTags piastrine. Gli eroi che il reclutamento non dà (i mitici) si
// ottengono con assemble dei loro frammenti, che arrivano con la conquista di un'area (fragments.conquest, all'eroe che
// tocca a quell'area) e con una sfida del giorno vinta (fragments.daily, all'eroe che tocca a quel giorno)
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
  maxGrade: 5,
  gradeCosts: [6, 12, 24, 48],
  gradeDamage: 0.15,
  gradeCooldown: 0.08,
};

export const RECRUIT = {
  cost: 5,
  pity: { rare: 10, epic: 30, legendary: 100 },
  startTags: 10,
  assemble: 60,
  fragments: { conquest: 10, daily: 5 },
};
