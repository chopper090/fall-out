// Tipi di cancello, ognuno con il suo effect sull'esercito quando ci passa sotto (systems/army.js): i cancelli
// danno truppe, o vita agli eroi; la potenza di fuoco la danno gli scrigni (data/chests.js).
// charged: ha un numero che sale a ogni colpo e ferma i colpi; gli altri sono fissi e i colpi li attraversano.
// plus e minus (effect add): ogni colpo che li tocca alza il numero di GATES.perHit, fino al massimo che dà
// l'ondata (data/waves.js), e lì lasciano passare i colpi; il negativo parte sotto zero, sale verso zero e poi
// oltre, fino a un massimo più alto: girarlo in tempo vale più del +N che ha accanto, passarci sotto prima costa
// soldati. multiply moltiplica l'esercito per factor, ma dà al massimo LIMITS.multiplyMax soldati (data/waves.js);
// divide lo divide per factor; heal ridà amount di vita a ogni eroe.
// malus: cancello rosso, da evitare (quelli con il numero sono rossi finché il numero è negativo)
export const GATE_KINDS = {
  plus: { effect: 'add', charged: true, malus: false },
  minus: { effect: 'add', charged: true, malus: false },
  multiply: { effect: 'multiply', charged: false, malus: false, factor: 2 },
  divide: { effect: 'divide', charged: false, malus: true, factor: 2 },
  heal: { effect: 'heal', charged: false, malus: false, amount: 2 },
};
