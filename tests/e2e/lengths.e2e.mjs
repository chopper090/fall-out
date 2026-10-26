// Prova end-to-end dello step S3 (e del 4.9) in Edge headless: le battaglie della strada sono numerate dalla porta, e
// ogni decima ha il boss (la torre con la bandiera rossa), ogni cinquantesima due (bandiera viola); la scheda dice il
// numero, quanto dura e quante ondate; lo schieramento il numero, la durata e quanti boss; in battaglia in alto
// «Battaglia N · Ondata»; una normale conta 3 ondate e finisce senza boss, il riepilogo dice il suo numero; le porte
// prendono i colpi e salgono (S2); nella
// battaglia i nemici normali lasciano legno e pietra, e il primo premio preso compare vicino agli eroi (A8); nella
// doppia i due boss arrivano insieme, con due barre affiancate; la difficoltà di prova sta nel pannello di sviluppo e
// cambia la potenza dello schieramento. Del B11: le battaglie hanno il seme fisso dell'indirizzo (?seed=, così il
// bottino non è fortuna); una normale giocata con il dito e con la tastiera si registra, si copia dal pannello e node
// la rigioca uguale (npm run replay). Errori in console
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dir, ok, openGame, sleep } from './lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Il seme di tutte le battaglie della prova: la normale invincibile prende legno e pietra, qualunque sia il frame
const SEED = 17;
const game = await openGame('410');
const { send, evaluate, shot, run } = game;
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
// La scheda del mondo ha una riga che comincia con prefix (da aspettare con until: il capo ci mette a camminare)
const sheetLine = (prefix) => `(() => {
  const all = (list) => list.flatMap((o) => (o.type === 'Container' ? all(o.list) : [o]));
  const lines = all(window.__game.scene.getScene('WorldUI').children.list).filter((o) => o.type === 'Text');
  return lines.some((t) => t.text.startsWith(${JSON.stringify(prefix)}));
})()`;
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
// Un salvataggio di oggi con data come profilo, la casella della strada (road.at) di oggi
const save = (data) =>
  run(`const { storedRoad } = await import(url('/src/meta/road.js'));
    const profile = ${JSON.stringify(data)};
    if (profile.road) profile.road = storedRoad({ lost: false, ...profile.road });
    localStorage.setItem(balance.SAVE.storageKey, JSON.stringify({ version: balance.SAVE.version, profile }));
    return 0;`);
const reopen = async () => {
  await game.reload();
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
    return ROAD_TILES.filter((t) => t.rules).map((t) => ({ index: t.index, area: t.area, kind: t.kind, ...t.rules }));`);
  const [first] = all;
  const tenth = all[9];
  const fiftieth = all[49];
  ok(
    all.every((t, i) => t.number === i + 1) &&
      tenth.kind === 'boss' &&
      tenth.area === 0 &&
      tenth.type === 'boss' &&
      fiftieth.type === 'double' &&
      all[99].type === 'triple',
    `battaglie: ${all.length}, la 1 ${first.type} nella casella ${first.index}, la 10 ${tenth.kind} ${tenth.type} nell'area ${tenth.area + 1}, la 50 ${fiftieth.type}, la 100 ${all[99].type}`,
  );

  // Segni: la bandiera davanti alla prima battaglia, poi la torre del boss e quella dei due boss
  await save({ road: { at: first.index - 2, done: true } });
  await reopen();
  await closeUp();
  await pause(400);
  const frames = await world(`return s.road.markers.map((m) => m.frame.name);`);
  await shot('S3-1-bandiera-prima');
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(300);
  // La prossima casella, una raccolta, toccata come dal dito (scenes/World.js tapRoad): il capo ci cammina
  await run(`const { targetTile } = await import(url('/src/meta/road.js'));
    const s = window.__game.scene.getScene('World');
    s.tapRoad(targetTile(window.__game.registry.get('save').profile));
    return 0;`);
  await until(sheetLine('Avanti: battaglia 1 '), 5);
  const sheet = await texts('WorldUI');
  ok(
    frames.includes('battle') && sheet.some((t) => t.startsWith('Avanti: battaglia 1 (45 s, 3 ondate)')),
    `segni ${[...new Set(frames)].join(' ')}; ${sheet.find((t) => t.startsWith('Avanti')) ?? '-'}`,
  );
  const nextTo = async (tile, name, line) => {
    await save({ road: { at: tile.index - 1, done: true } });
    await reopen();
    await closeUp();
    await pause(400);
    const shown = await world(`return s.road.markers.map((m) => m.frame.name);`);
    await world(`s.bus.emit('roadTapped'); return 0;`);
    await until(sheetLine(line), 5);
    const lines = await texts('WorldUI');
    await shot(name);
    ok(
      shown.includes(tile.type) && lines.some((t) => t.startsWith(line)),
      `segni ${[...new Set(shown)].join(' ')}; ${lines.find((t) => t.startsWith('Avanti')) ?? '-'}`,
    );
  };
  await nextTo(tenth, 'S3-2-torre-boss', 'Avanti: boss 10 (90 s, 5 ondate)');
  await nextTo(fiftieth, 'S3-3-torre-due-boss', 'Avanti: boss 50 (135 s, 7 ondate)');

  // Schieramento della prima: il numero e la durata; in battaglia il contatore e 3 ondate, niente boss; legno e
  // pietra dai nemici
  await save({ road: { at: first.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.navigate('Lineup', { mode: 'road', tile: ${first.index} }); return 0;`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  const lineup = await texts('Lineup');
  ok(
    lineup.includes('Battaglia 1') && lineup.includes('Circa 45 s · 3 ondate, senza boss'),
    `schieramento: ${lineup.slice(0, 4).join(' | ')}`,
  );
  await shot('S3-4-schieramento-prima');
  const start = await run('return balance.HUD.lineup.startButton;');
  await game.gameTap(start.x, start.y);
  await until(`window.__game.scene.isActive('BattleUI') === true`, 10);
  await pause(1500);
  const waveText = await evaluate(`window.__game.scene.getScene('BattleUI').wave.text`);
  ok(waveText === 'Battaglia 1 · Ondata 1/3', `in battaglia: ${waveText}`);
  await shot('S3-5-contatore');
  // La normale si gioca davvero fino in fondo (il capo non cade, i nemici passati non contano): finisce senza boss
  await run(`const b = window.__game.scene.getScene('Battle').battle;
    b.army.leader.hp = b.army.leader.maxHp = 1e9;
    window.__savedEscaped = balance.MISSION.maxEscaped;
    balance.MISSION.maxEscaped = 1e9;
    window.__bossSeen = false;
    b.bus.on('bossStarted', () => { window.__bossSeen = true; });
    window.__gateHits = 0;
    window.__gateRaised = 0;
    b.bus.on('gateHit', ({ gate }) => {
      window.__gateHits += 1;
      if (gate.value === gate.max) window.__gateRaised += 1;
    });
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
          line: window.__game.scene.getScene('BattleUI').lootLine.text,
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
    picked &&
      label.text === label.wanted &&
      label.color === label.kindColor &&
      label.alpha > 0.5 &&
      label.above &&
      /^Bottino: \d+ legno · \d+ pietra/.test(label.line),
    `premio preso: vicino agli eroi «${label?.text ?? '-'}» (atteso «${label?.wanted ?? '-'}»), colore ${label?.color} (della cassa ${label?.kindColor}), opacità ${label?.alpha}, sopra il numero dei soldati ${label?.above} (spostata di ${label?.dx} di lato); in alto «${label?.line}»`,
  );
  await until(battleOver, 120);
  const over = await evaluate(
    `(() => { const b = window.__game.scene.getScene('Battle').battle; return { over: b.over, completed: b.mission.completed, count: b.waves.count, boss: window.__bossSeen, materials: b.loot.collected.wood + b.loot.collected.stone, seconds: Math.round(b.ms / 1000), seed: b.seed, gateHits: window.__gateHits, gateRaised: window.__gateRaised }; })()`,
  );
  await run('balance.MISSION.maxEscaped = window.__savedEscaped; return 0;');
  await pause(1200);
  const summary = await texts('Summary');
  ok(
    over.over &&
      over.completed &&
      over.count === 3 &&
      !over.boss &&
      over.materials > 0 &&
      over.seed === SEED &&
      over.gateHits > 0 &&
      over.gateRaised > 0 &&
      summary.includes('Battaglia 1'),
    `normale finita in ${over.seconds} s: compiuta ${over.completed}, ondate ${over.count}, boss ${over.boss}, legno e pietra presi ${over.materials}, seme ${over.seed}; colpi alle porte ${over.gateHits}, porte portate al massimo ${over.gateRaised}; riepilogo con «Battaglia 1» ${summary.includes('Battaglia 1')}`,
  );
  await shot('S3-6-fine-normale');

  // La doppia: lo schieramento dice i due boss; partendo dai boss arrivano insieme, ognuno con la sua barra
  await save({ road: { at: fiftieth.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.navigate('Lineup', { mode: 'road', tile: ${fiftieth.index} }); return 0;`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  const doubleLineup = await texts('Lineup');
  await run('balance.LEVEL.startWithBoss = true; return 0;');
  await game.gameTap(start.x, start.y);
  await until(`window.__game.scene.getScene('Battle')?.battle?.bosses.list.length === 2`, 20);
  await pause(1500);
  const bars = await evaluate(`(() => {
    const ui = window.__game.scene.getScene('BattleUI');
    const counts = ui.bossCounts.filter((t) => t.visible).map((t) => Math.round(t.x));
    const lanes = window.__game.scene.getScene('Battle').battle.bosses.list.map((b) => b.lane);
    return { counts, wave: ui.wave.text, lanes };
  })()`);
  await shot('S3-7-due-boss');
  await run('balance.LEVEL.startWithBoss = false; return 0;');
  ok(
    doubleLineup.includes('Battaglia 50 · Boss') &&
      doubleLineup.includes('Circa 135 s · 7 ondate e due boss') &&
      bars.counts.length === 2 &&
      bars.counts[0] < 360 &&
      bars.counts[1] > 360 &&
      bars.lanes.join() === '0,2' &&
      bars.wave === 'Battaglia 50 · Boss',
    `doppia: ${doubleLineup.slice(0, 3).join(' | ')}; in battaglia «${bars.wave}», boss nelle corsie ${bars.lanes.join(' e ')}, barre con il numero a x ${bars.counts.join(' e ')}`,
  );

  // Difficoltà di prova: nel pannello di sviluppo, e la potenza dei nemici nello schieramento sale
  const folder = await evaluate(
    `[...document.querySelectorAll('.tp-fldv_t')].some((el) => el.textContent.trim() === 'Difficoltà di prova')`,
  );
  await save({ road: { at: first.index, done: false }, resources: { rations: 5 } });
  await reopen();
  const power = async () => {
    await world(`s.navigate('Lineup', { mode: 'road', tile: ${first.index} }); return 0;`);
    await until(`window.__game.scene.isActive('Lineup') === true`, 5);
    await pause(300);
    const line = (await texts('Lineup')).find((t) => t.startsWith('Forza'));
    await evaluate(`(() => { window.__game.scene.getScene('Lineup').leave(); return 0; })()`);
    await until(`window.__game.scene.isActive('World') === true`, 5);
    await pause(300);
    return line;
  };
  const before = await power();
  await run('balance.TEST_BATTLE.enemyHpScale = 2; return 0;');
  const after = await power();
  await run('balance.TEST_BATTLE.enemyHpScale = 1; return 0;');
  const theirs = (line) => Number(line.match(/richiesta (\d+)/)[1]);
  ok(
    folder && theirs(after) > theirs(before) * 1.8,
    `difficoltà di prova: cartella nel pannello ${folder}; ${before} → ${after}`,
  );

  // Battaglia rigiocabile: una normale giocata davvero, con il dito e con la tastiera, fino alla fine; il pannello la
  // copia (Copia l'ultima battaglia) con i frame, i comandi e il risultato che ha avuto il riepilogo; node la rigioca
  await save({ road: { at: first.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.navigate('Lineup', { mode: 'road', tile: ${first.index} }); return 0;`);
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
