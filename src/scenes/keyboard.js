import { CONTROLS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { perFrame } from '../core/time.js';

// La tastiera sul PC, accanto al dito che resta il comando principale; senza Phaser: i tasti li dà la scena.
// In battaglia i tasti tenuti guidano l'esercito con gli stessi comandi dello swipe: STEER a ogni frame, che la
// battaglia moltiplica per la sensibilità dello swipe (qui si toglie, come fa il bot: la tastiera va sempre a
// CONTROLS.keyboardSpeed), e STEER_END quando si lasciano, per agganciarsi come a fine swipe

// Le caselle della pagina dove si scrive (quelle del pannello di sviluppo, la scheda del salvataggio)
const TEXT_FIELDS = 'input:not([type="checkbox"]), textarea, select';

export function createKeySteer(bus) {
  const steer = { bus, steering: false };
  // Ripartendo dalla pausa la battaglia manda già il suo STEER_END: i tasti lasciati a menu aperto non ne mandano
  // un altro
  bus.on(EVENTS.GAME_RESUMED, () => {
    steer.steering = false;
  });
  return steer;
}

// Da che parte spingono i tasti tenuti: -1 a sinistra, 1 a destra, 0 da nessuna (o da tutte e due). keys: { left,
// right }, i tasti di ogni parte, ognuno con il suo isDown
export function keyDirection({ left, right }) {
  const held = (keys) => keys.some((key) => key.isDown);
  return Number(held(right)) - Number(held(left));
}

// Un frame della battaglia, lungo deltaMs, con i tasti che spingono verso direction
export function steerByKeys(steer, direction, deltaMs) {
  if (direction !== 0) {
    steer.steering = true;
    steer.bus.emit(EVENTS.STEER, (direction * perFrame(CONTROLS.keyboardSpeed, deltaMs)) / CONTROLS.sensitivity);
  } else if (steer.steering) {
    steer.steering = false;
    steer.bus.emit(EVENTS.STEER_END);
  }
}

// Si sta scrivendo in una casella della pagina: i tasti sono suoi, non del gioco
export function typingInPage() {
  const field = document.activeElement;
  return field !== null && (field.isContentEditable || field.matches(TEXT_FIELDS));
}
