// L'orologio del gioco, l'unico: l'ora vera del telefono (in millisecondi) più uno scarto che va solo avanti, per
// gli strumenti di sviluppo e le prove. Tutto quello che chiede che ora è (cantieri, fattoria, seme della battaglia,
// registro delle partite) passa da qui
let offsetMs = 0;

export function now() {
  return Date.now() + offsetMs;
}

// Porta l'orologio avanti di ms millisecondi; indietro no: per il villaggio sarebbe l'orologio del telefono che torna
// indietro
export function advanceClock(ms) {
  if (Number.isFinite(ms) && ms > 0) offsetMs += ms;
}

// Di nuovo l'ora vera, senza scarto
export function resetClock() {
  offsetMs = 0;
}
