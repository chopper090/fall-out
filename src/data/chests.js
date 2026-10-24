// Ricompense degli scrigni: potenza di fuoco per l'esercito che li apre a colpi, fino a fine livello e cumulabile.
// I cancelli danno truppe, gli scrigni potenza. damage alza il danno di tutti i colpi di amount (0.1 = +10%),
// fireRate la cadenza di tutti, eroi compresi; weapon dà la sua arma (data/units.js) alla parte di folla davanti
// allo scrigno quando si apre (CHESTS.armWidth in config/balance.js). Tra le armi solo la raffica: le granate del
// lanciatore volano sopra scrigni e cancelli, e una folla di lanciatori non aprirebbe più niente
export const CHEST_KINDS = {
  damage: { effect: 'damage', amount: 0.1 },
  fireRate: { effect: 'fireRate', amount: 0.1 },
  burst: { effect: 'weapon', weapon: 'burst' },
};
