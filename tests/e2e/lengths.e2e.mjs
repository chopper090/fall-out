// Prova end-to-end degli step 4.9 e 4.10 in Edge headless: sulla strada le bandiere delle battaglie hanno il colore
// della loro durata (bianca corta, arancione media, rossa lunga) e la scheda dice quante ondate; lo schieramento dice
// la durata; una battaglia corta conta 2 ondate e finisce senza boss; nella battaglia i nemici normali lasciano
// materiali, e il primo premio preso compare vicino agli eroi (A8); la difficoltà di prova sta nel pannello di
// sviluppo e cambia la potenza dello schieramento. Del B11: le battaglie hanno il seme fisso dell'indirizzo (?seed=,
// così i materiali non sono fortuna); una corta giocata con il dito e con la tastiera si registra, si copia dal
// pannello e node la rigioca uguale (npm run replay). Errori in console
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dir, ok, openGame, sleep } from './lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Il seme di tutte le battaglie della prova: la corta invincibile ci prende 5 materiali, qualunque sia il frame
const SEED = 17;
const game = await openGame('410');
const { send, evaluate, shot, run, hook } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
const texts = (name) =>
  evaluate(`(() => {
  const all = (list) => list.flatMap((o) => (o.type === 'Container' ? all(o.list) : [o]));
  return all(window.__game.scene.getScene('${name}').children.list).filter((o) => o.type === 'Text').map((t) => t.text);
})()`);
const until = async (expression, seconds) => {
  for (let i = 0; i < seconds * 4; i++) {
    if ((await evaluate(expression)) === true) return true;
    await pause(250);
  }
  return false;
};
const world = (body) => evaluate(`(() => { const s = window.__game.scene.getScene('World'); ${body} })()`);
// Il dito e i tasti del PC sulla battaglia (schermo logico 720x1280)
const page = (x, y) =>
  evaluate(
    `(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${x} * r.width / 720, r.top + ${y} * r.height / 1280]; })()`,
  );
const mouse = async (type, x, y, buttons = 1) => {
  const [px, py] = await page(x, y);
  await send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', buttons, clickCount: 1 });
};
const swipe = async (dx) => {
  await mouse('mousePressed', 360, 900);
  for (let i = 1; i <= 6; i++) {
    await mouse('mouseMoved', 360 + (dx * i) / 6, 900);
    await sleep(40);
  }
  await mouse('mouseReleased', 360 + dx, 900, 0);
};
const ARROWS = {
  left: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
};
const hold = async (arrow, ms) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...ARROWS[arrow] });
  await sleep(ms);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...ARROWS[arrow] });
};
const battleOver = `window.__game.scene.getScene('Battle').battle?.over === true`;
const save = (data) =>
  evaluate(
    `localStorage.setItem('fall-out.save', JSON.stringify({ version: 1, profile: ${JSON.stringify(data)} })); 0`,
  );
const reopen = async () => {
  await send('Page.reload');
  await pause(3000);
  await hook();
  await pause(600);
};
const closeUp = () =>
  run(`const { zoomLimits, lookAt } = await import(url('/src/view/worldCamera.js'));
  const s = window.__game.scene.getScene('World');
  s.cameras.main.setZoom(zoomLimits(s.cameras.main).max * 0.8); s.fitOverlays();
  lookAt(s.cameras.main, s.road.pawn.x, s.road.pawn.y + 60);
  return 0;`);

try {
  console.log('aggancio:', await game.open(`e2e410&seed=${SEED}`));
  const all = await run(`const { ROAD_TILES } = await import(url('/src/meta/road.js'));
    return ROAD_TILES.filter((t) => t.rules).map((t) => ({ index: t.index, area: t.area, kind: t.kind, length: t.rules.length }));`);
  const tiles = all.filter((t) => t.area === 0);
  const [short, medium] = tiles;
  const long = all.find((t) => t.kind === 'battle' && t.length === 'long');
  const opening = tiles.map((t) => t.length).join(' ');
  ok(
    opening === 'short medium medium long' && tiles.at(-1).kind === 'boss' && long.area === 1,
    `prima area: ${tiles.map((t) => `${t.index} ${t.kind} ${t.length}`).join(', ')}; prima lunga ${long.index} nell'area ${long.area + 1}`,
  );

  // Bandiere: davanti alla corta e alla media, poi davanti alla lunga e al boss
  await save({ road: { at: short.index - 2, done: true } });
  await reopen();
  await closeUp();
  await pause(400);
  let frames = await world(`return s.road.markers.map((m) => m.frame.name);`);
  await shot('410-1-bandiere-corta');
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(300);
  // La prossima casella, una raccolta, toccata come dal dito (scenes/World.js tapRoad): il capo ci cammina
  await run(`const { targetTile } = await import(url('/src/meta/road.js'));
    const s = window.__game.scene.getScene('World');
    s.tapRoad(targetTile(window.__game.registry.get('save').profile));
    return 0;`);
  await pause(700);
  let sheet = await texts('WorldUI');
  ok(
    frames.includes('short') && sheet.some((t) => t.startsWith('Avanti: battaglia corta (2 ondate)')),
    `segni ${[...new Set(frames)].join(' ')}; ${sheet.find((t) => t.startsWith('Avanti')) ?? '-'}`,
  );
  await save({ road: { at: long.index - 1, done: true } });
  await reopen();
  await closeUp();
  await pause(400);
  frames = await world(`return s.road.markers.map((m) => m.frame.name);`);
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(400);
  sheet = await texts('WorldUI');
  await shot('410-2-bandiere-lunga');
  ok(
    frames.includes('long') && sheet.some((t) => t.startsWith('Avanti: battaglia lunga (6 ondate)')),
    `segni ${[...new Set(frames)].join(' ')}; ${sheet.find((t) => t.startsWith('Avanti')) ?? '-'}`,
  );

  // Schieramento della corta: la durata; in battaglia 2 ondate, niente boss; materiali dai nemici
  await save({ road: { at: short.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.navigate('Lineup', { mode: 'road', tile: ${short.index} }); return 0;`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  const lineup = await texts('Lineup');
  ok(lineup.includes('Corta · 2 ondate, senza boss'), `schieramento: ${lineup.slice(0, 4).join(' | ')}`);
  await shot('410-3-schieramento-corta');
  const start = await run('return balance.HUD.lineup.startButton;');
  await game.gameTap(start.x, start.y);
  await until(`window.__game.scene.isActive('BattleUI') === true`, 10);
  await pause(1500);
  const waveText = await evaluate(`window.__game.scene.getScene('BattleUI').wave.text`);
  ok(waveText.endsWith('/2'), `in battaglia: ${waveText}`);
  // La corta si gioca davvero fino in fondo (il capo non cade, i nemici passati non contano): finisce senza boss
  await run(`const b = window.__game.scene.getScene('Battle').battle;
    b.army.leader.hp = b.army.leader.maxHp = 1e9;
    balance.MISSION.maxEscaped = 1e9;
    window.__bossSeen = false;
    b.bus.on('bossStarted', () => { window.__bossSeen = true; });
    return 0;`);
  // Il primo premio preso: poco dopo, sopra il numero dei soldati, la sua quantità con la parola e il colore della sua
  // cassa; la battaglia si ferma per la foto e poi riparte
  await run(`const s = window.__game.scene.getScene('Battle');
    const { amountText } = await import(url('/src/view/words.js'));
    const { hex } = await import(url('/src/view/canvas.js'));
    const top = balance.DEPTH.overlay + 1;
    s.battle.bus.on('lootCollected', () => {
      if (window.__lootLabel !== undefined) return;
      window.__lootLabel = null;
      setTimeout(() => {
        const gain = s.lootFx.gains[0];
        const texts = s.children.list.filter((o) => o.type === 'Text' && o.visible && o.depth === top);
        const counter = texts.find((o) => !o.text.startsWith('+'));
        const wanted = gain && amountText(gain.kind, gain.amount, '+');
        const label = texts.find((o) => o.text === wanted);
        window.__lootLabel = {
          wanted, text: label?.text, color: label?.style.color, kindColor: gain && hex(balance.LOOT.colors[gain.kind].front),
          alpha: label?.alpha, above: label !== undefined && counter !== undefined && label.y < counter.y,
          dx: label && counter && Math.round(label.x - counter.x),
        };
        s.paused = true;
      }, 100);
    });
    return 0;`);
  const picked = await until(`typeof window.__lootLabel === 'object' && window.__lootLabel !== null`, 60);
  const label = await evaluate('window.__lootLabel');
  await shot('A8-bottino-preso');
  await evaluate(`window.__game.scene.getScene('Battle').paused = false; 0`);
  ok(
    picked && label.text === label.wanted && label.color === label.kindColor && label.alpha > 0.5 && label.above,
    `premio preso: vicino agli eroi «${label?.text ?? '-'}» (atteso «${label?.wanted ?? '-'}»), colore ${label?.color} (della cassa ${label?.kindColor}), opacità ${label?.alpha}, sopra il numero dei soldati ${label?.above} (spostata di ${label?.dx} di lato)`,
  );
  await until(battleOver, 120);
  const over = await evaluate(
    `(() => { const b = window.__game.scene.getScene('Battle').battle; return { over: b.over, completed: b.mission.completed, count: b.waves.count, boss: window.__bossSeen, materials: b.loot.collected.materials, seconds: Math.round(b.ms / 1000), seed: b.seed }; })()`,
  );
  await run('balance.MISSION.maxEscaped = 3; return 0;');
  ok(
    over.over && over.completed && over.count === 2 && !over.boss && over.materials > 0 && over.seed === SEED,
    `corta finita in ${over.seconds} s: compiuta ${over.completed}, ondate ${over.count}, boss ${over.boss}, materiali presi ${over.materials}, seme ${over.seed}`,
  );
  await pause(1200);
  await shot('410-4-fine-corta');

  // Difficoltà di prova: nel pannello di sviluppo, e la potenza dei nemici nello schieramento sale
  const folder = await evaluate(
    `[...document.querySelectorAll('.tp-fldv_t')].some((el) => el.textContent.trim() === 'Difficoltà di prova')`,
  );
  await save({ road: { at: medium.index, done: false }, resources: { rations: 5 } });
  await reopen();
  const power = async () => {
    await world(`s.navigate('Lineup', { mode: 'road', tile: ${medium.index} }); return 0;`);
    await until(`window.__game.scene.isActive('Lineup') === true`, 5);
    await pause(300);
    const line = (await texts('Lineup')).find((t) => t.startsWith('Potenza'));
    await evaluate(`(() => { window.__game.scene.getScene('Lineup').leave(); return 0; })()`);
    await until(`window.__game.scene.isActive('World') === true`, 5);
    await pause(300);
    return line;
  };
  const before = await power();
  await run('balance.TEST_BATTLE.enemyHpScale = 2; return 0;');
  const after = await power();
  await run('balance.TEST_BATTLE.enemyHpScale = 1; return 0;');
  const theirs = (line) => Number(line.match(/nemici (\d+)/)[1]);
  ok(
    folder && theirs(after) > theirs(before) * 1.8,
    `difficoltà di prova: cartella nel pannello ${folder}; ${before} → ${after}`,
  );

  // Battaglia rigiocabile: una corta giocata davvero, con il dito e con la tastiera, fino alla fine; il pannello la
  // copia (Copia l'ultima battaglia) con i frame, i comandi e il risultato che ha avuto il riepilogo; node la rigioca
  await save({ road: { at: short.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.navigate('Lineup', { mode: 'road', tile: ${short.index} }); return 0;`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  await game.gameTap(start.x, start.y);
  await until(`window.__game.scene.isActive('BattleUI') === true`, 10);
  // Il giocatore va verso il nemico più vicino: due volte con lo swipe, la terza con le frecce
  const aim = () =>
    evaluate(`(() => {
    const scene = window.__game.scene.getScene('Battle');
    const { army, spawner } = scene.battle;
    const next = spawner.enemies.filter((e) => e.z > army.front).sort((a, b) => a.z - b.z)[0];
    return next === undefined ? 0 : (next.x - army.x) / scene.perspective.worldPerPixelAtHero();
  })()`);
  for (let i = 0; i < 200 && !(await evaluate(battleOver)); i++) {
    const dx = Math.max(-300, Math.min(300, await aim()));
    if (Math.abs(dx) < 20) await pause(200);
    else if (i % 3 === 2) await hold(dx > 0 ? 'right' : 'left', Math.min(400, Math.abs(dx)));
    else await swipe(dx);
    await pause(250);
  }
  await until(battleOver, 120);
  await pause(1000);
  const played = await evaluate(
    `(() => { const b = window.__game.scene.getScene('Battle').battle; return { frame: b.frame, seed: b.seed, result: JSON.stringify(window.__game.scene.getScene('Summary').result ?? null) }; })()`,
  );
  const { copied, kept } = await run(`const { button, storageKey } = balance.DEBUG.replay;
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === button).click();
    const areas = [...document.querySelectorAll('textarea')].map((area) => area.value);
    const kept = JSON.parse(localStorage.getItem(storageKey) ?? '[]').length;
    return { copied: areas.find((value) => value.startsWith('{"format"')) ?? '', kept };`);
  const replay = copied === '' ? null : JSON.parse(copied);
  const count = (name) => replay?.inputs.filter((input) => input[1] === name).length ?? 0;
  ok(
    replay !== null &&
      replay.seed === SEED &&
      replay.frames.length === played.frame &&
      count('steer') > 0 &&
      count('steerEnd') > 0 &&
      JSON.stringify(replay.result) === played.result &&
      kept >= 2,
    `registrata: seme ${replay?.seed}, ${replay?.frames.length} frame (la battaglia ne ha giocati ${played.frame}), ${count('steer')} steer e ${count('steerEnd')} steerEnd, ritocchi ${JSON.stringify(replay?.tweaks)}; risultato come nel riepilogo ${JSON.stringify(replay?.result) === played.result}; sul telefono ${kept} battaglie`,
  );
  const file = `${dir}/410-battaglia.json`;
  writeFileSync(file, copied);
  const replayed = spawnSync(process.execPath, ['src/sim/replay.js', file], { cwd: ROOT, encoding: 'utf8' });
  const last = replayed.stdout.trim().split('\n').at(-1) ?? '';
  ok(replayed.status === 0 && last.startsWith('ok'), `rigiocata in node: ${last || replayed.stderr.trim()}`);

  // Il registro degli errori porta gli ultimi eventi della battaglia: una voce scritta adesso ha quelli della fine
  const { events, size } = await run(`const { clearErrors, logError } = await import(url('/src/core/errorLog.js'));
    const entry = logError(new Error('prova degli eventi'));
    clearErrors();
    return { events: entry.events, size: balance.DEBUG.eventLog.size };`);
  const ending = events.findLast((entry) => entry[1].startsWith('mission'));
  ok(
    events.length === size && events.every((entry) => entry[0] < played.frame) && ending?.[0] === played.frame - 1,
    `registro degli errori: ${events.length} eventi della battaglia, dal frame ${events[0]?.[0]} al ${events.at(-1)?.[0]}, la fine ${JSON.stringify(ending)}`,
  );
} finally {
  await game.close();
}
