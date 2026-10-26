import { test } from 'node:test';
import { checker } from '../support/check.js';
import { advanceClock, now, resetClock } from '../../src/core/clock.js';

// L'orologio del gioco (core/clock.js), con l'ora vera ferma a un valore noto: senza scarto è l'ora vera; lo scarto va
// solo avanti (un salto indietro, zero, un valore che non è un numero o infinito non cambiano niente), si somma, e
// resetClock lo azzera
test("Orologio: l'ora vera più uno scarto che va solo avanti, e si azzera", (t) => {
  const check = checker(t);
  const REAL = 1_800_000_000_000;
  const MINUTE = 60000;
  const HOUR = 60 * MINUTE;
  t.mock.method(Date, 'now', () => REAL);
  resetClock();
  const plain = now() - REAL;
  advanceClock(HOUR);
  const ahead = now() - REAL;
  for (const ms of [-2 * HOUR, 0, Number.NaN, Infinity, '5']) advanceClock(ms);
  const ignored = now() - REAL;
  advanceClock(30 * MINUTE);
  const added = now() - REAL;
  resetClock();
  const reset = now() - REAL;
  check(
    `orologio: senza scarto +${plain} ms; avanti di 1 h +${ahead / MINUTE} min; dopo un salto indietro, zero, NaN, infinito e una scritta +${ignored / MINUTE} min; altri 30 min +${added / MINUTE} min; azzerato +${reset} ms`,
    plain === 0 && ahead === HOUR && ignored === HOUR && added === HOUR + 30 * MINUTE && reset === 0,
  );
  check.done();
});
