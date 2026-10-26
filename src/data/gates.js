// Tipi di cancello: partono dal numero che gli dà l'ondata (data/waves.js, la lista con il loro nome) e a ogni colpo
// salgono, fino al massimo dell'ondata che dice max. plus dà soldati e cresce; minus parte negativo (malus: da solo
// arriva in una corsia esterna, per poterlo schivare), e girato dà poco; deep, solo nelle battaglie con le porte
// tutte negative, parte molto più in basso e girato può arrivare fin dove arriva un plus. La potenza di fuoco la
// danno gli scrigni (data/chests.js)
export const GATE_KINDS = {
  plus: { malus: false, max: 'plusMax' },
  minus: { malus: true, max: 'minusMax' },
  deep: { malus: true, max: 'plusMax' },
};
