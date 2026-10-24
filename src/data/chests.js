// Ricompense degli scrigni per l'esercito che li apre a colpi, fino a fine livello e cumulabili (la vita si ridà
// subito, fino alla vita piena). I cancelli danno
// truppe normali, gli scrigni il resto: damage alza il danno di tutti i colpi di amount (0.1 = +10%), fireRate la
// cadenza di tutti, eroi compresi; heal ridà amount di vita a ogni eroe; weapon dà la sua arma (data/units.js) ai
// soldati normali della parte di folla davanti allo scrigno quando si apre (CHESTS.armWidth in config/balance.js);
// elite aggiunge count truppe élite (ELITE, data/units.js). Tra le armi solo la raffica: le granate del lanciatore
// volano sopra scrigni e cancelli, e una folla di lanciatori non aprirebbe più niente.
// value: quanto vale la ricompensa, misurato con il simulatore (vittorie in più a parità di colpi, 1 per +10% di
// danno): lo scrigno chiede i colpi dell'ondata (chests.hits in data/waves.js) per value, così più truppe o bonus
// più forti chiedono più colpi
// Misure (tutti gli scrigni dello stesso tipo, a parità di colpi; vittorie in più rispetto a scrigni vuoti, +10% di
// danno = 1): +20% di danno 1,3; cadenza 1,5, perché fa aprire anche gli scrigni più in fretta; 5 élite 1,5; 10
// élite 2; vita e raffica quasi niente per il bot. I value seguono le misure; vita e raffica costano poco apposta:
// la vita serve quando un eroe è ferito, la raffica cambia il modo di sparare
export const CHEST_KINDS = {
  damage: { effect: 'damage', amount: 0.1, value: 1 },
  bigDamage: { effect: 'damage', amount: 0.2, value: 1.3 },
  fireRate: { effect: 'fireRate', amount: 0.1, value: 1.5 },
  heal: { effect: 'heal', amount: 2, value: 0.4 },
  burst: { effect: 'weapon', weapon: 'burst', value: 0.4 },
  elite: { effect: 'elite', count: 5, value: 1.5 },
  bigElite: { effect: 'elite', count: 10, value: 2 },
};
