// Prova end-to-end degli step 4.9 e 4.10 in Edge headless: sulla strada le bandiere delle battaglie hanno il colore
// della loro durata (bianca corta, arancione media, rossa lunga) e la scheda dice quante ondate; lo schieramento dice
// la durata; una battaglia corta conta 2 ondate e finisce senza boss; nella battaglia i nemici normali lasciano
// materiali; la difficoltà di prova sta nel pannello di sviluppo e cambia la potenza dello schieramento; errori in
// console
import { ok, openGame, sleep } from './lib.mjs';

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
  console.log('aggancio:', await game.open('e2e410'));
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
  await world(`s.bus.emit('stepRequested'); return 0;`);
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
  await until(`window.__game.scene.getScene('Battle').battle?.over === true`, 120);
  const over = await evaluate(
    `(() => { const b = window.__game.scene.getScene('Battle').battle; return { over: b.over, completed: b.mission.completed, count: b.waves.count, boss: window.__bossSeen, materials: b.loot.collected.materials, seconds: Math.round(b.ms / 1000) }; })()`,
  );
  await run('balance.MISSION.maxEscaped = 3; return 0;');
  ok(
    over.over && over.completed && over.count === 2 && !over.boss && over.materials > 0,
    `corta finita in ${over.seconds} s: compiuta ${over.completed}, ondate ${over.count}, boss ${over.boss}, materiali presi ${over.materials}`,
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
} finally {
  await game.close();
}
