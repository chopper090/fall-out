// Tipi di cancello, ognuno con il suo effect sull'esercito quando ci passa sotto (systems/army.js).
// charged: ha un numero che si carica sparandogli e ferma i colpi; gli altri sono fissi e i colpi li attraversano.
// plus e minus (effect add): ogni GATES.hitsPerPoint secondi di fuoco dell'esercito il numero sale di uno
// scatto, fino al tetto del livello. Lo scatto del +N è step; quello del negativo lo decide l'ondata (minusStep
// in data/waves.js), più grande: sale verso zero e poi oltre, e girarlo in tempo vale di più del +N che ha
// accanto. multiply e divide moltiplicano o dividono l'esercito per factor, heal ridà amount di vita all'eroe,
// power aggiunge amount al danno di tutti i colpi fino a fine livello (0.2 = +20%). I cancelli d'arma
// (effect weapon) danno la loro arma (data/units.js) alla parte di folla che ci passa sotto.
// malus: cancello rosso, da evitare (quelli con il numero sono rossi finché il numero è negativo)
export const GATE_KINDS = {
  plus: { effect: 'add', charged: true, malus: false, step: 1 },
  minus: { effect: 'add', charged: true, malus: false },
  multiply: { effect: 'multiply', charged: false, malus: false, factor: 2 },
  divide: { effect: 'divide', charged: false, malus: true, factor: 2 },
  heal: { effect: 'heal', charged: false, malus: false, amount: 2 },
  power: { effect: 'power', charged: false, malus: false, amount: 0.2 },
  rifle: { effect: 'weapon', charged: false, malus: false, weapon: 'rifle' },
  burst: { effect: 'weapon', charged: false, malus: false, weapon: 'burst' },
  launcher: { effect: 'weapon', charged: false, malus: false, weapon: 'launcher' },
};
