// Ricompense degli scrigni per l'esercito che li apre a colpi, fino a fine livello e cumulabili. I cancelli danno
// truppe normali, gli scrigni potenza: damage alza il danno di tutti i colpi di amount (0.1 = +10%), fireRate la
// cadenza di tutti, eroi compresi; weapon dà la sua arma (data/units.js) alla parte di folla davanti allo scrigno
// quando si apre (CHESTS.armWidth in config/balance.js); elite aggiunge count truppe élite (ELITE, data/units.js).
// Tra le armi solo la raffica: le granate del lanciatore volano sopra scrigni e cancelli, e una folla di lanciatori
// non aprirebbe più niente. value: quanto vale la ricompensa, 1 per +10% di danno: lo scrigno chiede i colpi
// dell'ondata (chests.hits in data/waves.js) per value, così più truppe o bonus più forti chiedono più colpi
export const CHEST_KINDS = {
  damage: { effect: 'damage', amount: 0.1, value: 1 },
  fireRate: { effect: 'fireRate', amount: 0.1, value: 1 },
  burst: { effect: 'weapon', weapon: 'burst', value: 1 },
  elite: { effect: 'elite', count: 8, value: 1.3 },
};
