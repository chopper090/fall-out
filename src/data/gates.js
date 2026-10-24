// Tipi di cancello, ognuno con il suo effect sull'esercito quando ci passa sotto (systems/army.js).
// charged: ha un numero che sale a ogni colpo e ferma i colpi; gli altri sono fissi e i colpi li attraversano.
// plus e minus (effect add): ogni colpo che li tocca alza il numero di GATES.perHit, fino al massimo che dà
// l'ondata (data/waves.js), e lì lasciano passare i colpi; il negativo parte sotto zero, sale verso zero e poi
// oltre, fino a un massimo più alto: girarlo in tempo vale più del +N che ha accanto, passarci sotto prima costa
// soldati. multiply moltiplica l'esercito per factor, ma dà al massimo LIMITS.multiplyMax soldati (data/waves.js);
// divide lo divide per factor; heal ridà amount di vita a ogni eroe,
// power aggiunge amount al danno di tutti i colpi fino a fine livello (0.2 = +20%). I cancelli d'arma
// (effect weapon) danno la loro arma (data/units.js) alla parte di folla che ci passa sotto.
// malus: cancello rosso, da evitare (quelli con il numero sono rossi finché il numero è negativo)
export const GATE_KINDS = {
  plus: { effect: 'add', charged: true, malus: false },
  minus: { effect: 'add', charged: true, malus: false },
  multiply: { effect: 'multiply', charged: false, malus: false, factor: 2 },
  divide: { effect: 'divide', charged: false, malus: true, factor: 2 },
  heal: { effect: 'heal', charged: false, malus: false, amount: 2 },
  power: { effect: 'power', charged: false, malus: false, amount: 0.2 },
  rifle: { effect: 'weapon', charged: false, malus: false, weapon: 'rifle' },
  burst: { effect: 'weapon', charged: false, malus: false, weapon: 'burst' },
  launcher: { effect: 'weapon', charged: false, malus: false, weapon: 'launcher' },
};
