import { test } from 'node:test';
import { checker } from '../support/check.js';
import { DEBUG } from '../../src/config/balance.js';
import { createEventBus, EVENTS } from '../../src/core/events.js';
import { createEventLog } from '../../src/debug/eventLog.js';
import { createBot, updateBot } from '../../src/sim/bot.js';
import { battleResult, createBattle, updateBattle } from '../../src/systems/battle.js';

// Il registro degli eventi della battaglia (B11, debug/eventLog.js), sul bus con il suo tap (core/events.js): sente
// ogni evento prima di chi ascolta, tiene gli ultimi DEBUG.eventLog.size con il frame e i valori semplici copiati, e
// non cambia la battaglia

// Il tap sente l'evento prima di chi lo ascolta, con quello che porta; un bus senza tap consegna e basta
test('Bus con il tap: sente ogni evento prima di chi lo ascolta; senza, il bus consegna come prima', (t) => {
  const check = checker(t);
  const heard = [];
  const tapped = createEventBus((name, payload) => heard.push(`tap ${name} ${payload}`));
  tapped.on('ping', (payload) => heard.push(`ascolto ${payload}`));
  tapped.emit('ping', 1);
  tapped.emit('nessuno', 2);
  const plain = createEventBus();
  const got = [];
  plain.on('ping', (payload) => got.push(payload));
  plain.emit('ping', 3);
  check(
    `con il tap: ${heard.join(', ')}; senza: consegnato ${got.join()}`,
    heard.join() === 'tap ping 1,ascolto 1,tap nessuno 2' && got.join() === '3',
  );
  check.done();
});

// Gli ultimi size eventi, dal più vecchio, con il frame della battaglia guardata (0 mentre se ne crea una); di un
// oggetto si tengono i primi fields valori semplici con il loro nome, e cambiarlo dopo (un oggetto riusato) non cambia
// il registro
test('Registro degli eventi: gli ultimi, con il frame e i valori semplici copiati, mai gli oggetti', (t) => {
  const check = checker(t);
  const { size, fields } = DEBUG.eventLog;
  const log = createEventLog();
  const battle = { frame: 0 };
  log.watch(battle);
  for (let i = 0; i < size + 5; i++) {
    battle.frame = i;
    log.tap(EVENTS.STEER, i);
  }
  const list = log.entries();
  check(
    `${size + 5} eventi, ne restano ${list.length}: dal ${JSON.stringify(list[0])} al ${JSON.stringify(list.at(-1))}`,
    list.length === size && list[0].join() === `5,${EVENTS.STEER},5` && list.at(-1)[0] === size + 4,
  );
  const enemy = { type: { armor: 1 }, x: 120, z: 900, hp: 4, alive: true, kind: 'normal' };
  log.tap(EVENTS.ENEMY_HIT, { enemy, damage: 2.5, hero: null });
  log.tap(EVENTS.ENEMY_KILLED, enemy);
  log.watch(null);
  log.tap(EVENTS.STEER_END);
  enemy.x = 0;
  enemy.hp = 0;
  const last = log.entries().slice(-3);
  check(
    `colpito ${JSON.stringify(last[0])}; abbattuto (i primi ${fields} valori) ${JSON.stringify(last[1])}, dopo che l'oggetto è cambiato; senza battaglia ${JSON.stringify(last[2])}`,
    JSON.stringify(last[0]) === `[${size + 4},"${EVENTS.ENEMY_HIT}",{"damage":2.5}]` &&
      JSON.stringify(last[1]) === `[${size + 4},"${EVENTS.ENEMY_KILLED}",{"x":120,"z":900,"hp":4}]` &&
      JSON.stringify(last[2]) === `[0,"${EVENTS.STEER_END}"]`,
  );
  check.done();
});

// Su una battaglia vera, guidata dal bot, il registro tiene gli eventi degli ultimi frame, e la battaglia con il tap
// finisce come quella senza
test('Registro degli eventi: su una battaglia vera tiene gli ultimi eventi e non la cambia', (t) => {
  const check = checker(t);
  const frames = 3000;
  const play = (bus) => {
    const battle = createBattle(11, bus);
    if (bus !== undefined) log.watch(battle);
    const bot = createBot(1000 / 60);
    for (let i = 0; i < frames && !battle.over; i++) {
      updateBot(bot, battle);
      updateBattle(battle, 1000 / 60);
    }
    return battle;
  };
  const log = createEventLog();
  const tapped = play(createEventBus(log.tap));
  const plain = play(undefined);
  const list = log.entries();
  const names = [...new Set(list.map((entry) => entry[1]))].sort();
  const same = JSON.stringify(battleResult(tapped)) === JSON.stringify(battleResult(plain));
  check(
    `dopo ${tapped.frame} frame: ${list.length} eventi dal frame ${list[0]?.[0]} al ${list.at(-1)?.[0]} (${names.join(', ')}); risultato uguale a quello senza tap ${same}`,
    list.length === DEBUG.eventLog.size &&
      list.every((entry, index) => index === 0 || entry[0] >= list[index - 1][0]) &&
      list.at(-1)[0] <= tapped.frame &&
      same,
  );
  check.done();
});
