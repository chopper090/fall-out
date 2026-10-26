// Prova nel browser del B9, il gioco che perde il fuoco e la tastiera sul PC. Nel mondo, a metà di un trascinamento o
// di un pizzico il gioco perde il fuoco: i gesti si dimenticano, la vista non segue più le dita e alzandole non è un
// tocco. In battaglia, perso il fuoco si apre la pausa e la battaglia si ferma; Esc chiude il menu e lo riapre; la
// freccia a destra e A spostano l'esercito a CONTROLS.keyboardSpeed al secondo e lasciate si ferma, anche se lasciate
// dopo aver perso il fuoco; a menu aperto e scrivendo in una casella della pagina i tasti non fanno niente; il dito
// guida come prima. Lasciata la battaglia niente resta in ascolto del fuoco; foto della pausa; errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('b9');
const { send, evaluate, shot, run } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
const until = async (expression, seconds) => {
  for (let i = 0; i < seconds * 4; i++) {
    if ((await evaluate(expression)) === true) return true;
    await pause(250);
  }
  return false;
};
const active = (name) => evaluate(`window.__game.scene.isActive('${name}') === true`);
const page = (x, y) =>
  evaluate(
    `(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${x} * r.width / 720, r.top + ${y} * r.height / 1280]; })()`,
  );
const mouse = async (type, x, y, buttons = 1) => {
  const [px, py] = await page(x, y);
  await send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', buttons, clickCount: 1 });
};
const touch = async (type, points) => {
  const touchPoints = [];
  for (const [id, x, y] of points) {
    const [px, py] = await page(x, y);
    touchPoints.push({ x: px, y: py, id });
  }
  await send('Input.dispatchTouchEvent', { type, touchPoints });
};
const texts = (name) =>
  evaluate(`(() => {
  const all = (list) => list.flatMap((o) => (o.type === 'Container' ? all(o.list) : [o]));
  return all(window.__game.scene.getScene('${name}').children.list).filter((o) => o.type === 'Text').map((t) => t.text);
})()`);
// I tasti come li manda la tastiera del PC
const KEYS = {
  right: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
  a: { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 },
  esc: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
};
const keyDown = (name) => send('Input.dispatchKeyEvent', { type: 'keyDown', ...KEYS[name] });
const keyUp = (name) => send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEYS[name] });
const press = async (name) => {
  await keyDown(name);
  await sleep(60);
  await keyUp(name);
  await pause(400);
};
// Il gioco perde il fuoco (come con la tendina delle notifiche o un'altra finestra) e lo riprende subito: la pausa
// resta aperta, ma il passo del tempo del gioco torna normale
const blur = () => evaluate(`window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); 0`);
const camera = () =>
  evaluate(
    `(() => { const c = window.__game.scene.getScene('World').cameras.main; return { zoom: c.zoom, x: c.scrollX, y: c.scrollY }; })()`,
  );
const gestures = () =>
  evaluate(`(() => {
  const g = window.__game.scene.getScene('World').gestures;
  return { touches: g.touches.size, press: g.press !== null, pinch: g.pinch !== null };
})()`);
const sameView = (a, b) => a.zoom === b.zoom && a.x === b.x && a.y === b.y;
const viewText = (c) => `${Math.round(c.x)},${Math.round(c.y)} ×${c.zoom.toFixed(3)}`;
// Chi ascolta il fuoco e la pagina nascosta, senza quelli dei tasti di Phaser (che li toglie da solo)
const awayListeners = () =>
  evaluate(`(() => {
  const mine = (name) => window.__game.events.listeners(name).filter((fn) => fn.name !== 'resetKeys').length;
  return { blur: mine('blur'), hidden: mine('hidden') };
})()`);
const battleState = () =>
  evaluate(`(() => {
  const s = window.__game.scene.getScene('Battle');
  const ui = window.__game.scene.getScene('BattleUI');
  return { x: s.battle.army.x, ms: s.battle.ms, paused: s.paused, menuOpen: ui.menuOpen, maxX: s.battle.army.maxX };
})()`);
const reopen = async () => {
  await game.reload();
  await pause(500);
};

try {
  await game.open('e2eb9');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await evaluate(`localStorage.clear(); 0`);
  await reopen();
  const { CONTROLS, HUD } = await run('return { CONTROLS: balance.CONTROLS, HUD: balance.HUD };');
  const listenersBefore = await awayListeners();

  // Nel mondo: a metà di un trascinamento il gioco perde il fuoco; il dito si dimentica, la vista non lo segue più e
  // alzandolo non è un tocco
  const start = await camera();
  await mouse('mousePressed', 60, 450);
  for (let i = 1; i <= 3; i++) await mouse('mouseMoved', 60, 450 + i * 50);
  await pause(200);
  const dragging = await gestures();
  const dragged = await camera();
  await blur();
  const dropped = await gestures();
  for (let i = 4; i <= 6; i++) await mouse('mouseMoved', 60, 450 + i * 50);
  await mouse('mouseReleased', 60, 750, 0);
  await pause(300);
  const after = await camera();
  const sheet = await evaluate(`window.__game.scene.getScene('WorldUI').sheet`);
  ok(
    dragging.touches === 1 &&
      dragging.press &&
      !sameView(start, dragged) &&
      dropped.touches === 0 &&
      !dropped.press &&
      sameView(dragged, after) &&
      sheet === null &&
      !(await active('PauseMenu')),
    `mondo, trascinamento: vista da ${viewText(start)} a ${viewText(dragged)} con ${dragging.touches} dito; perso il fuoco: dita ${dropped.touches}, gesto ${dropped.press}; poi la vista resta a ${viewText(after)}, alzando il dito scheda ${JSON.stringify(sheet)}`,
  );

  // Lo stesso a metà di un pizzico con due dita: lo zoom non segue più le dita
  await touch('touchStart', [[1, 300, 500]]);
  await touch('touchStart', [
    [1, 300, 500],
    [2, 420, 700],
  ]);
  await touch('touchMove', [
    [1, 280, 460],
    [2, 440, 740],
  ]);
  await pause(200);
  const pinching = await gestures();
  const pinched = await camera();
  await blur();
  const unpinched = await gestures();
  await touch('touchMove', [
    [1, 240, 400],
    [2, 480, 800],
  ]);
  await pause(200);
  const afterPinch = await camera();
  await touch('touchEnd', []);
  await pause(300);
  ok(
    pinching.pinch &&
      pinching.touches === 2 &&
      pinched.zoom !== dragged.zoom &&
      !unpinched.pinch &&
      unpinched.touches === 0 &&
      afterPinch.zoom === pinched.zoom &&
      (await evaluate(`window.__game.scene.getScene('WorldUI').sheet`)) === null,
    `mondo, pizzico: zoom da ${dragged.zoom.toFixed(3)} a ${pinched.zoom.toFixed(3)} con ${pinching.touches} dita; perso il fuoco: pizzico ${unpinched.pinch}, dita ${unpinched.touches}; poi lo zoom resta ${afterPinch.zoom.toFixed(3)}`,
  );

  // In battaglia, quella della prima casella, con il capo che non cade e i nemici passati che non contano
  await run(`const { writeSave } = await import(url('/src/core/save.js'));
    const { ROAD_TILES } = await import(url('/src/meta/road.js'));
    const save = window.__game.registry.get('save');
    save.profile.road = { at: ROAD_TILES.find((t) => t.kind === 'battle').index, done: false };
    writeSave(save);
    const s = window.__game.scene.getScene('World');
    s.navigate('Lineup', { mode: 'road', tile: save.profile.road.at });
    return 0;`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  await pause(300);
  await game.gameTap(HUD.lineup.startButton.x, HUD.lineup.startButton.y);
  const fighting = await until(`window.__game.scene.isActive('BattleUI') === true`, 5);
  await pause(1000);
  await run(`const b = window.__game.scene.getScene('Battle').battle;
    b.army.leader.hp = b.army.leader.maxHp = 1e9;
    window.__savedEscaped = balance.MISSION.maxEscaped;
    balance.MISSION.maxEscaped = 1e9;
    return 0;`);

  // Perso il fuoco: si apre il menu sulla pausa e la battaglia si ferma
  await blur();
  const blurMenu = await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  const stopped = await battleState();
  await pause(500);
  const stillStopped = await battleState();
  const pauseTexts = await texts('PauseMenu');
  await shot('b9-1-pausa-perso-il-fuoco');
  ok(
    fighting &&
      blurMenu &&
      stopped.paused &&
      stopped.menuOpen &&
      stillStopped.ms === stopped.ms &&
      pauseTexts.includes(HUD.menu.labels.resume),
    `battaglia ${fighting}, perso il fuoco: menu aperto ${blurMenu} (${pauseTexts.join(' | ')}), battaglia ferma ${stopped.paused} (${Math.round(stopped.ms)} → ${Math.round(stillStopped.ms)} ms)`,
  );

  // Esc chiude il menu e la battaglia riparte; Esc lo riapre sulla pausa e lo richiude
  await press('esc');
  const closed = !(await active('PauseMenu'));
  const running = await battleState();
  await pause(300);
  const runningLater = await battleState();
  await press('esc');
  const reopened = await active('PauseMenu');
  const reopenedTexts = await texts('PauseMenu');
  const pausedAgain = await battleState();
  await press('esc');
  const closedAgain = !(await active('PauseMenu'));
  const end = await battleState();
  ok(
    closed &&
      !running.paused &&
      !running.menuOpen &&
      runningLater.ms > running.ms &&
      reopened &&
      reopenedTexts.includes(HUD.menu.labels.resume) &&
      pausedAgain.paused &&
      closedAgain &&
      !end.paused &&
      !end.menuOpen,
    `Esc: menu chiuso ${closed}, battaglia ripartita ${!running.paused} (${Math.round(running.ms)} → ${Math.round(runningLater.ms)} ms); di nuovo Esc: menu ${reopened} con «${reopenedTexts[0]}», ferma ${pausedAgain.paused}; ancora Esc: chiuso ${closedAgain}, riparte ${!end.paused}`,
  );

  // Freccia a destra tenuta, partendo da sinistra: l'esercito va a destra a keyboardSpeed al secondo (contato sul
  // tempo della battaglia); lasciata si ferma, al più agganciandosi
  await run(`const b = window.__game.scene.getScene('Battle').battle;
    b.bus.emit('steer', (b.army.minX - b.army.x) / balance.CONTROLS.sensitivity);
    return 0;`);
  await pause(300);
  const speedOf = (a, b) => (b.x - a.x) / ((b.ms - a.ms) / 1000);
  await keyDown('right');
  await pause(100);
  const rightA = await battleState();
  await pause(300);
  const rightB = await battleState();
  await keyUp('right');
  await pause(400);
  const stopA = await battleState();
  await pause(300);
  const stopB = await battleState();
  const rightSpeed = speedOf(rightA, rightB);
  ok(
    Math.abs(rightSpeed / CONTROLS.keyboardSpeed - 1) < 0.05 &&
      rightB.x < rightB.maxX &&
      stopB.x === stopA.x &&
      stopA.x - rightB.x < 150,
    `freccia a destra: x da ${Math.round(rightA.x)} a ${Math.round(rightB.x)} in ${Math.round(rightB.ms - rightA.ms)} ms, ${Math.round(rightSpeed)}/s (attesi ${CONTROLS.keyboardSpeed}); lasciata: ferma a ${Math.round(stopA.x)} → ${Math.round(stopB.x)}`,
  );

  // A tenuto: l'esercito va a sinistra, alla stessa velocità
  await keyDown('a');
  await pause(100);
  const leftA = await battleState();
  await pause(200);
  const leftB = await battleState();
  await keyUp('a');
  await pause(300);
  const leftSpeed = speedOf(leftA, leftB);
  ok(
    Math.abs(-leftSpeed / CONTROLS.keyboardSpeed - 1) < 0.05,
    `A: x da ${Math.round(leftA.x)} a ${Math.round(leftB.x)} in ${Math.round(leftB.ms - leftA.ms)} ms, ${Math.round(leftSpeed)}/s`,
  );

  // Freccia tenuta mentre il gioco perde il fuoco, e lasciata altrove (qui non arriva): chiusa la pausa con Esc
  // l'esercito non riparte da solo
  const heldStart = await battleState();
  await keyDown('right');
  await pause(150);
  const heldA = await battleState();
  await blur();
  const heldMenu = await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await press('esc');
  const heldB = await battleState();
  await pause(400);
  const heldC = await battleState();
  await keyUp('right');
  await pause(300);
  ok(
    heldA.x > heldStart.x &&
      heldMenu &&
      !heldB.paused &&
      heldB.x - heldA.x < CONTROLS.snapRadius * 2 &&
      heldC.x === heldB.x &&
      heldC.ms > heldB.ms,
    `freccia tenuta: x da ${Math.round(heldStart.x)} a ${Math.round(heldA.x)}; fuoco perso: pausa ${heldMenu}; chiusa con Esc l'esercito è a ${Math.round(heldB.x)} e resta a ${Math.round(heldC.x)} con la battaglia che va (${Math.round(heldC.ms - heldB.ms)} ms)`,
  );

  // A menu aperto la freccia non muove l'esercito; scrivendo in una casella della pagina né la freccia né Esc fanno
  // niente al gioco
  await press('esc');
  const menuX = await battleState();
  await keyDown('right');
  await pause(300);
  const menuX2 = await battleState();
  await keyUp('right');
  await press('esc');
  const resumedMenu = !(await active('PauseMenu'));
  await evaluate(`(() => { const field = document.createElement('input'); field.id = 'e2e-field';
    document.body.append(field); field.focus(); return 0; })()`);
  const typingA = await battleState();
  await keyDown('right');
  await pause(300);
  const typingB = await battleState();
  await keyUp('right');
  await press('esc');
  const typingMenu = await active('PauseMenu');
  await evaluate(`document.getElementById('e2e-field').remove(); 0`);
  ok(
    menuX2.x === menuX.x && resumedMenu && typingB.x === typingA.x && typingB.ms > typingA.ms && !typingMenu,
    `a menu aperto la freccia: x ${Math.round(menuX.x)} → ${Math.round(menuX2.x)}; scrivendo in una casella: x ${Math.round(typingA.x)} → ${Math.round(typingB.x)} con la battaglia che va (${Math.round(typingB.ms - typingA.ms)} ms), Esc apre il menu ${typingMenu}`,
  );

  // Il dito guida come prima: 100 punti dello schermo a destra sono 100 punti alla profondità degli eroi, per la
  // sensibilità dello swipe
  await run(`const b = window.__game.scene.getScene('Battle').battle;
    b.bus.emit('steer', (360 - b.army.x) / balance.CONTROLS.sensitivity);
    return 0;`);
  await pause(300);
  const perPixel = await evaluate(`window.__game.scene.getScene('Battle').perspective.worldPerPixelAtHero()`);
  await mouse('mousePressed', 200, 800);
  const fingerA = await battleState();
  for (let i = 1; i <= 5; i++) await mouse('mouseMoved', 200 + i * 20, 800);
  await pause(200);
  const fingerB = await battleState();
  await mouse('mouseReleased', 300, 800, 0);
  await pause(300);
  const expected = 100 * perPixel * CONTROLS.sensitivity;
  const fingerMoved = fingerB.x - fingerA.x;
  ok(
    Math.abs(fingerMoved / expected - 1) < 0.05 && !(await active('PauseMenu')),
    `dito 100 punti a destra: x da ${Math.round(fingerA.x)} a ${Math.round(fingerB.x)}, +${fingerMoved.toFixed(1)} (attesi ${expected.toFixed(1)})`,
  );

  // Lasciata la battaglia, nel mondo perdere il fuoco non apre più la pausa e chi ascolta è quello di prima
  await press('esc');
  await evaluate(`(() => { window.__game.scene.getScene('PauseMenu').leave(); return 0; })()`);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(500);
  await run('balance.MISSION.maxEscaped = window.__savedEscaped; return 0;');
  await blur();
  await pause(300);
  const listenersAfter = await awayListeners();
  ok(
    !(await active('PauseMenu')) &&
      !(await active('Battle')) &&
      listenersAfter.blur === listenersBefore.blur &&
      listenersAfter.hidden === listenersBefore.hidden,
    `lasciata la battaglia: perso il fuoco nel mondo, pausa ${await active('PauseMenu')}; in ascolto del fuoco ${listenersBefore.blur} → ${listenersAfter.blur}, della pagina nascosta ${listenersBefore.hidden} → ${listenersAfter.hidden}`,
  );
} finally {
  await game.close();
}
