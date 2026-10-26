import { test } from 'node:test';
import { checker } from '../support/check.js';
import { CONTROLS } from '../../src/config/balance.js';
import { EVENTS } from '../../src/core/events.js';
import { periodMs } from '../../src/core/time.js';
import { createKeySteer, keyDirection, steerByKeys } from '../../src/scenes/keyboard.js';
import { createBattle } from '../../src/systems/battle.js';

// La tastiera sul PC in battaglia (B9): i tasti tenuti guidano l'esercito con gli stessi comandi dello swipe
// (scenes/keyboard.js), qui su una battaglia vera ferma, senza disegno, a 60 frame al secondo

const FRAME_MS = periodMs(60);
// I tasti di ogni parte, premuti o no
const keysOf = (downs) => downs.map((isDown) => ({ isDown }));
const keys = (left, right) => ({ left: keysOf(left), right: keysOf(right) });

// Una battaglia con i comandi della tastiera e il conto dei comandi mandati
function keyBattle() {
  const battle = createBattle(1);
  const steer = createKeySteer(battle.bus);
  const sent = { steer: 0, end: 0 };
  battle.bus.on(EVENTS.STEER, () => {
    sent.steer += 1;
  });
  battle.bus.on(EVENTS.STEER_END, () => {
    sent.end += 1;
  });
  const frames = (direction, count) => {
    for (let i = 0; i < count; i++) steerByKeys(steer, direction, FRAME_MS);
  };
  return { battle, sent, frames };
}

// Di quanto va l'esercito tenendo i tasti verso direction per count frame, con la sensibilità dello swipe sensitivity
function moved(direction, count, sensitivity) {
  const start = CONTROLS.sensitivity;
  CONTROLS.sensitivity = sensitivity;
  const { battle, frames } = keyBattle();
  const x0 = battle.army.x;
  frames(direction, count);
  CONTROLS.sensitivity = start;
  return battle.army.x - x0;
}

// Tenendo un tasto per 0,2 s l'esercito va di keyboardSpeed × 0,2 da quella parte, con qualunque sensibilità dello
// swipe (la battaglia la moltiplica, la tastiera la toglie)
test("Tastiera: l'esercito va a keyboardSpeed al secondo, qualunque sia la sensibilità dello swipe", (t) => {
  const check = checker(t);
  const count = 12;
  const expected = (CONTROLS.keyboardSpeed * count * FRAME_MS) / 1000;
  const right = moved(1, count, 1);
  const left = moved(-1, count, 1);
  const low = moved(1, count, 0.5);
  const high = moved(1, count, 2);
  const near = (value) => Math.abs(value - expected) < 1e-9;
  const round = (value) => Math.round(value * 100) / 100;
  check(
    `tastiera a ${CONTROLS.keyboardSpeed}/s per ${count} frame: a destra +${round(right)} (attesi ${round(expected)}), a sinistra ${round(left)}; con la sensibilità dello swipe a 0,5 +${round(low)} e a 2 +${round(high)}`,
    near(right) && near(-left) && near(low) && near(high),
  );
  check.done();
});

// Da che parte spingono i tasti: frecce o lettere da una parte, nessuno o tutte e due le parti fermi. Tenendoli si
// guida a ogni frame; lasciati, un solo STEER_END e l'esercito, a meno di snapRadius dal centro della corsia, ci si
// aggancia come a fine swipe; fermi senza tasti niente comandi; lasciati a menu aperto, ripartendo nessun aggancio in
// più (lo manda già la battaglia)
test('Tastiera: frecce e A/D spingono da una parte; lasciati i tasti ci si aggancia come a fine swipe, una volta', (t) => {
  const check = checker(t);
  const directions = [
    keyDirection(keys([false, false], [true, false])),
    keyDirection(keys([false, true], [false, false])),
    keyDirection(keys([true, false], [false, true])),
    keyDirection(keys([false, false], [false, false])),
  ];
  check(
    `direzioni: freccia a destra ${directions[0]}, A ${directions[1]}, sinistra e D insieme ${directions[2]}, nessun tasto ${directions[3]}`,
    directions.join() === '1,-1,0,0',
  );
  const { battle, sent, frames } = keyBattle();
  const center = battle.army.x;
  frames(1, 1);
  const off = battle.army.x - center;
  const held = { ...sent };
  frames(0, 3);
  const released = { ...sent };
  const snap = battle.army.snapTarget;
  frames(1, 2);
  battle.bus.emit(EVENTS.GAME_RESUMED);
  frames(0, 3);
  check(
    `un frame a destra: +${off} dal centro della corsia (raggio ${CONTROLS.snapRadius}), ${held.steer} STEER e ${held.end} STEER_END; lasciati: ${released.end - held.end} STEER_END in 3 frame, aggancio a ${snap}; lasciati a menu aperto: ${sent.end - released.end} STEER_END in più`,
    off > 0 &&
      off <= CONTROLS.snapRadius &&
      held.steer === 1 &&
      held.end === 0 &&
      released.steer === 1 &&
      released.end === 1 &&
      snap === center &&
      sent.steer === 3 &&
      sent.end === 1,
  );
  check.done();
});
