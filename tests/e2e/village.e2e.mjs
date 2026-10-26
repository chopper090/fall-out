// Prova end-to-end dello step 4.7, rifatta sul 4.8 (la mappa non c'è più) e sull'A5 (Strada al posto di Esplora), in
// Edge headless: il mondo si apre sul villaggio; Costruisci apre il menu; la fattoria si mette (trascinata e
// confermata con ✓) e apre il suo cantiere; Accelera lo chiude; le razioni pronte si raccolgono toccando la bolla;
// tenendo premuto un edificio lo si sposta; fuori dal territorio ✓ non fa niente e ✗ annulla; rotella, pizzico e
// trascinamento muovono la vista; Strada porta dal capo, Eroi e Sfida alle loro scene e si torna al mondo con la
// stessa vista; l'orologio del gioco portato avanti finisce il cantiere; un salvataggio di prima del 4.7 (versione 1,
// portato alla 2) mette da solo gli edifici; in battaglia (toccando il capo sulla battaglia da vincere) un secondo
// dito non guida l'esercito; un salvataggio rovinato con la copia di riserva buona riprende la copia e lo dice una
// volta sola; FPS da lontano e da vicino; errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('47b');
const { send, evaluate, shot, run, hook } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
const profile = async () => JSON.parse(await evaluate(`JSON.stringify(window.__game.registry.get('save').profile)`));
// Un cambio a mano del profilo (p), scritto anche sul telefono: ogni azione del gioco rilegge il salvataggio da lì
const edit = (body) =>
  run(`const { writeSave } = await import(url('/src/core/save.js'));
  const save = window.__game.registry.get('save');
  const p = save.profile;
  ${body};
  writeSave(save);
  return 0;`);
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
const page = (x, y) =>
  evaluate(
    `(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${x} * r.width / 720, r.top + ${y} * r.height / 1280]; })()`,
  );
const mouse = async (type, x, y, buttons = 1) => {
  const [px, py] = await page(x, y);
  await send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', buttons, clickCount: 1 });
};
const gameTap = async (x, y) => {
  await mouse('mousePressed', x, y);
  await mouse('mouseReleased', x, y, 0);
  await pause(350);
};
// Trascinamento da (x1, y1) a (x2, y2) in steps passi, tenendo premuto holdMs prima di muoversi
const drag = async (x1, y1, x2, y2, { steps = 10, holdMs = 0 } = {}) => {
  await mouse('mousePressed', x1, y1);
  if (holdMs > 0) await pause(holdMs);
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await pause(30);
  }
  await mouse('mouseReleased', x2, y2, 0);
  await pause(350);
};
// Un punto del mondo (pixel del mondo) sullo schermo del gioco, con la camera di adesso
const screenOf = (expression) =>
  run(`const { worldToScreen } = await import(url('/src/view/worldCamera.js'));
  const s = window.__game.scene.getScene('World');
  const at = ${expression};
  const p = worldToScreen(s.cameras.main, at.x, at.y);
  return [p.x, p.y];`);
// Il centro dell'edificio id nel mondo
const buildingCenter = (id) =>
  screenOf(`(await (async () => {
  const { rectCenter } = await import(url('/src/view/iso.js'));
  const { footprint } = await import(url('/src/meta/village.js'));
  const p = window.__game.registry.get('save').profile;
  return rectCenter(footprint('${id}', p.village.positions.${id}));
})())`);
const confirmOf = async (which) => {
  const { gap, offsetY } = await run('return balance.WORLD_VIEW.overlays.confirm;');
  const [x, y] = await screenOf(`s.placement.buttons`);
  return [x + (which === 'ok' ? gap / 2 : -gap / 2), y + offsetY];
};
// Gli eventi del meta-gioco (core/events.js META_EVENTS) si annotano da qui, finché la pagina non si ricarica: il nome,
// e per PROFILE_CHANGED anche l'azione; metaEvents() dà quelli venuti dall'ultima volta
const recordMeta = () =>
  run(`const { META_EVENTS } = await import(url('/src/core/events.js'));
  window.__meta = [];
  for (const name of Object.values(META_EVENTS)) {
    window.__game.events.on(name, (data) => window.__meta.push(data?.action ? name + ':' + data.action : name));
  }
  return 0;`);
const metaEvents = () => evaluate(`window.__meta.splice(0)`);
const camera = () =>
  evaluate(
    `(() => { const c = window.__game.scene.getScene('World').cameras.main; return { zoom: c.zoom, x: c.scrollX, y: c.scrollY }; })()`,
  );

try {
  console.log('aggancio:', await game.open('e2e47'));
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await send('Page.reload');
  await pause(3000);
  await hook();
  await until(`window.__game?.scene.isActive('WorldUI') === true`, 10);
  await pause(500);
  const HUD = await run('return balance.HUD.world;');
  await recordMeta();
  const first = await texts('WorldUI');
  ok(
    first.some((t) => t.startsWith('12 razioni')) && first.some((t) => t.includes('Prossimo: Fattoria liv. 1')),
    `il mondo si apre sul villaggio: ${first.join(' | ')}`,
  );
  await shot('47-1-villaggio');

  // Il prossimo obiettivo, toccato, comincia a mettere la fattoria; ✗ la lascia stare
  await gameTap(360, HUD.goal.y);
  await pause(600);
  const fromGoal = await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); return s.placement && s.placement.id; })()`,
  );
  const hintTexts = await texts('WorldUI');
  await shot('47-0-obiettivo');
  await gameTap(...(await confirmOf('cancel')));
  const goalCancelled = await evaluate(`window.__game.scene.getScene('World').placement === null`);
  ok(
    fromGoal === 'farm' && hintTexts.some((t) => t.startsWith('Trascina')) && goalCancelled,
    `prossimo obiettivo: da mettere ${fromGoal}, ${hintTexts.at(-1)}; ✗ ${goalCancelled}`,
  );

  // Costruisci: il menu con i tre edifici
  await gameTap(HUD.buildButton.x, HUD.buildButton.y);
  const menu = await texts('WorldUI');
  ok(
    ['Fattoria', 'Caserma', 'Fucina'].every((name) => menu.includes(name)),
    `menu: ${menu.filter((t) => t.length < 40).join(' | ')}`,
  );
  await shot('47-2-menu');
  const { menu: m } = HUD;
  const closeY = m.rowsY + 3 * m.rowHeight + m.closeGap;
  const menuTop = m.bottom - (closeY + m.closeButton.height + m.padding);
  await gameTap(m.buildButton.x, menuTop + m.rowsY + m.buildButton.height / 2 - m.buildButton.height / 2 + m.buttonY);
  await pause(700);
  const placing = await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); return s.placement && { id: s.placement.id, cell: s.placement.cell, valid: s.placement.valid }; })()`,
  );
  ok(
    placing?.id === 'farm' && placing.valid,
    `fattoria da mettere: ${JSON.stringify(placing)}; ${(await texts('WorldUI')).at(-1)}`,
  );
  await shot('47-3-da-mettere');

  // Trascinata di due celle verso destra in basso, poi ✓
  const [gx, gy] = await screenOf(`s.placement.image`);
  const { tileWidth } = await run('return balance.WORLD_VIEW;');
  const zoom = (await camera()).zoom;
  await drag(gx, gy, gx + tileWidth * zoom, gy);
  const dragged = await evaluate(`window.__game.scene.getScene('World').placement.cell`);
  ok(
    dragged.col === placing.cell.col + 1 && dragged.row === placing.cell.row - 1,
    `trascinata da ${JSON.stringify(placing.cell)} a ${JSON.stringify(dragged)}`,
  );
  const before = await profile();
  await metaEvents();
  await gameTap(...(await confirmOf('ok')));
  await pause(400);
  const placedEvents = await metaEvents();
  const placed = await profile();
  const panel = await texts('WorldUI');
  ok(
    JSON.stringify(placed.village.positions.farm) === JSON.stringify(dragged) &&
      placed.village.construction?.building === 'farm' &&
      placed.resources.materials === before.resources.materials - 10,
    `✓: posto ${JSON.stringify(placed.village.positions.farm)}, cantiere ${placed.village.construction?.building}, materiali ${placed.resources.materials}; scheda ${panel.filter((t) => t.includes('Fattoria') || t.includes('costruzione')).join(' | ')}`,
  );
  await shot('47-4-cantiere');
  ok(
    placedEvents.join() === 'constructionStarted,profileChanged:placeBuilding',
    `eventi del meta-gioco con ✓: ${placedEvents.join(', ')}`,
  );

  // Accelera: il cantiere di un minuto finisce subito
  const panelTop = HUD.panel.bottom - HUD.panel.height;
  await gameTap(HUD.panel.acceleratorButton.x, panelTop + HUD.panel.buttonY);
  await pause(1300);
  const built = await profile();
  ok(
    built.village.levels.farm === 1 && built.resources.accelerators === 0 && built.village.construction === null,
    `accelerata: fattoria liv. ${built.village.levels.farm}, acceleratori ${built.resources.accelerators}`,
  );
  const accelerated = await metaEvents();
  ok(
    accelerated.join() === 'constructionShortened,constructionFinished,profileChanged:useAccelerator',
    `eventi del meta-gioco con Accelera: ${accelerated.join(', ')}`,
  );

  // Razioni pronte: la bolla sopra la fattoria, toccata le raccoglie
  await edit(`p.village.farm.stored = 5; p.village.farm.since = Date.now()`);
  await pause(1300);
  const bubble = await evaluate(`window.__game.scene.getScene('World').bubble !== null`);
  await shot('47-5-bolla');
  const [bx, by] = await screenOf(`s.bubble.top`);
  const by2 = by + (await evaluate(`window.__game.scene.getScene('World').bubble.y`));
  await metaEvents();
  await gameTap(bx, by2);
  const collected = await profile();
  ok(
    bubble && collected.resources.rations === built.resources.rations + 5,
    `bolla ${bubble}: razioni ${built.resources.rations} → ${collected.resources.rations}`,
  );
  const gathered = await metaEvents();
  ok(
    gathered.join() === 'rationsCollected,profileChanged:collectRations',
    `eventi del meta-gioco con la bolla: ${gathered.join(', ')}`,
  );

  // Tenuta premuta la fattoria la si prende e la si trascina: ✓ la sposta, senza costi né cambi di livello
  await gameTap(360, 640);
  const [fx, fy] = await buildingCenter('farm');
  const z2 = (await camera()).zoom;
  await drag(fx, fy, fx - tileWidth * z2, fy, { holdMs: 700 });
  const moving = await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); return s.placement && { id: s.placement.id, moving: s.placement.moving, cell: s.placement.cell, valid: s.placement.valid }; })()`,
  );
  const was = collected.village.positions.farm;
  ok(
    moving?.moving === true &&
      moving.id === 'farm' &&
      moving.cell.col === was.col - 1 &&
      moving.cell.row === was.row + 1,
    `tenuta premuta e trascinata: ${JSON.stringify(moving)} da ${JSON.stringify(was)}`,
  );
  await metaEvents();
  await gameTap(...(await confirmOf('ok')));
  const movedEvents = await metaEvents();
  const moved = await profile();
  ok(
    JSON.stringify(moved.village.positions.farm) === JSON.stringify(moving.cell) &&
      moved.village.levels.farm === 1 &&
      moved.resources.materials === collected.resources.materials,
    `spostata in ${JSON.stringify(moved.village.positions.farm)} (liv. ${moved.village.levels.farm}, materiali ${moved.resources.materials})`,
  );
  ok(movedEvents.join() === 'profileChanged:moveBuilding', `eventi del meta-gioco spostando: ${movedEvents.join(', ')}`);

  // Sposta dalla scheda, fuori dal territorio: ✓ spento, ✗ annulla
  const [cx, cy] = await buildingCenter('farm');
  await gameTap(cx, cy);
  await gameTap(HUD.panel.moveButton.x, panelTop + HUD.panel.lowerY);
  await pause(600);
  const out = await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); s.placeGhost({ col: 12, row: 16 }); return s.placement.valid; })()`,
  );
  const tinted = await evaluate(`window.__game.scene.getScene('World').placement.image.isTinted`);
  await shot('47-6-fuori');
  await gameTap(...(await confirmOf('ok')));
  const stillPlacing = await evaluate(`window.__game.scene.getScene('World').placement !== null`);
  await gameTap(...(await confirmOf('cancel')));
  const cancelled = await profile();
  const ended = await evaluate(`window.__game.scene.getScene('World').placement === null`);
  ok(
    !out &&
      tinted &&
      stillPlacing &&
      ended &&
      JSON.stringify(cancelled.village.positions.farm) === JSON.stringify(moved.village.positions.farm),
    `fuori dal territorio: valido ${out}, rosso ${tinted}, ✓ non fa niente ${stillPlacing}, ✗ annulla ${ended}, posto ${JSON.stringify(cancelled.village.positions.farm)}`,
  );

  // Vista: rotella, pizzico, trascinamento
  const c0 = await camera();
  const [wx, wy] = await page(360, 640);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wx, y: wy, deltaX: 0, deltaY: 600 });
  await pause(300);
  const c1 = await camera();
  for (let i = 0; i < 10; i++)
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wx, y: wy, deltaX: 0, deltaY: 1000 });
  await pause(300);
  const c2 = await camera();
  const limits = await run(
    `const { zoomLimits } = await import(url('/src/view/worldCamera.js')); return zoomLimits(window.__game.scene.getScene('World').cameras.main);`,
  );
  await shot('47-7-lontano');
  ok(
    c1.zoom < c0.zoom && Math.abs(c2.zoom - limits.min) < 1e-6,
    `rotella: zoom ${c0.zoom.toFixed(3)} → ${c1.zoom.toFixed(3)} → ${c2.zoom.toFixed(3)} (minimo ${limits.min.toFixed(3)})`,
  );
  const touch = async (type, points) => {
    const touchPoints = [];
    for (const [id, x, y] of points) {
      const [px, py] = await page(x, y);
      touchPoints.push({ x: px, y: py, id });
    }
    await send('Input.dispatchTouchEvent', { type, touchPoints });
  };
  await touch('touchStart', [[1, 300, 640]]);
  await touch('touchStart', [
    [1, 300, 640],
    [2, 420, 640],
  ]);
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', [
      [1, 300 - i * 15, 640],
      [2, 420 + i * 15, 640],
    ]);
    await pause(30);
  }
  await touch('touchEnd', []);
  await pause(300);
  const c3 = await camera();
  ok(c3.zoom > c2.zoom * 1.8, `pizzico: zoom ${c2.zoom.toFixed(3)} → ${c3.zoom.toFixed(3)}`);
  await drag(200, 500, 400, 700);
  const c4 = await camera();
  ok(
    c4.x < c3.x || c4.y < c3.y,
    `trascinamento: vista da ${Math.round(c3.x)},${Math.round(c3.y)} a ${Math.round(c4.x)},${Math.round(c4.y)}`,
  );
  await shot('47-8-vicino');

  // FPS da lontano e da vicino
  await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); s.cameras.main.setZoom(${limits.min}); return 0; })()`,
  );
  await game.startCounting();
  await pause(3000);
  const far = await game.frameStats();
  await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); s.cameras.main.setZoom(${limits.max}); return 0; })()`,
  );
  await game.startCounting();
  await pause(3000);
  const near = await game.frameStats();
  console.log('  FPS da lontano', JSON.stringify(far), 'da vicino', JSON.stringify(near));

  // Strada porta dal capo e accende la casella da toccare, senza aprire schede; Eroi e ritorno: stessa vista
  const beforeRoad = await camera();
  await gameTap(HUD.roadButton.x, HUD.roadButton.y);
  await pause(600);
  const afterRoad = await camera();
  const lit = await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); return s.flash !== null && !s.flash.isDestroyed; })()`,
  );
  const noSheet = await evaluate(`window.__game.scene.getScene('WorldUI').sheet === null`);
  const road = lit && noSheet && (afterRoad.x !== beforeRoad.x || afterRoad.y !== beforeRoad.y);
  await evaluate("window.__game.scene.getScene('World').bus.emit('groundTapped'); 0");
  await pause(300);
  const view = await camera();
  await gameTap(HUD.heroesButton.x, HUD.heroesButton.y);
  const onHeroes = await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  const heroesHud = await run('return balance.HUD.heroes;');
  // Negli eroi: Recluta, poi il posto 1 svuotato e rimesso com'era (toccando il posto e l'eroe che c'è, due volte)
  await metaEvents();
  await gameTap(heroesHud.recruit.button.x, heroesHud.recruit.button.y);
  const message = (await texts('Heroes')).find((t) => t.startsWith('Nuovo eroe') || t.includes('già tuo'));
  const pulled = await metaEvents();
  const seat = await run(`const { HEROES } = await import(url('/src/data/heroes.js'));
    const p = window.__game.registry.get('save').profile;
    const { grid, slots } = balance.HUD.heroes;
    const index = Object.keys(HEROES).indexOf(p.lineup[1]);
    const card = [grid.x0 + (index % grid.columns) * grid.dx, grid.y0 + Math.floor(index / grid.columns) * grid.dy];
    return { id: p.lineup[1], slot: slots[1], card };`);
  for (let i = 0; i < 2; i++) {
    await gameTap(...seat.slot);
    await gameTap(...seat.card);
  }
  const seated = await metaEvents();
  const lineupAfter = (await profile()).lineup;
  ok(
    message !== undefined && pulled.join() === 'heroRecruited,profileChanged:recruit',
    `Recluta: «${message}», eventi ${pulled.join(', ')}`,
  );
  ok(
    seated.join() === 'heroPlaced,profileChanged:placeHero,heroPlaced,profileChanged:placeHero' &&
      lineupAfter[1] === seat.id,
    `posto 1 svuotato e rimesso: ${lineupAfter[1]} (era ${seat.id}), eventi ${seated.join(', ')}`,
  );
  await gameTap(heroesHud.back.x, heroesHud.back.y);
  const fromHeroes = await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);
  const view2 = await camera();
  ok(
    road && onHeroes && fromHeroes && Math.abs(view2.zoom - view.zoom) < 1e-6 && Math.abs(view2.x - view.x) < 1,
    `Strada → dal capo con la casella accesa ${road}; Eroi ${onHeroes} → mondo ${fromHeroes}, vista ritrovata (zoom ${view.zoom.toFixed(3)} / ${view2.zoom.toFixed(3)})`,
  );

  // Sfida di un cantiere lungo: la caserma messa al liv. 1, Migliora (8 min), Sfida → schieramento della sfida
  await edit(`const { freeSpot } = await import(url('/src/meta/village.js'));
    p.village.levels.barracks = 1;
    p.village.positions.barracks = freeSpot(p.village.positions, 'barracks', 0);
    p.resources.materials = 500; p.resources.scrap = 100;
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await evaluate("window.__game.scene.getScene('World').bus.emit('focusRequested', { id: 'barracks' }); 0");
  await pause(800);
  const [kx, ky] = await buildingCenter('barracks');
  await gameTap(kx, ky);
  await metaEvents();
  await gameTap(HUD.panel.wideButton.x, panelTop + HUD.panel.buttonY);
  await pause(400);
  const upgradeEvents = await metaEvents();
  const upgrading = await profile();
  await shot('47-9-caserma');
  await gameTap(HUD.panel.challengeButton.x, panelTop + HUD.panel.buttonY);
  const onLineup = await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  const lineupTexts = onLineup ? await texts('Lineup') : [];
  const lineupHud = await run('return balance.HUD.lineup;');
  await gameTap(lineupHud.backButton.x, lineupHud.backButton.y);
  const fromLineup = await until(`window.__game.scene.isActive('World') === true`, 5);
  ok(
    upgrading.village.construction?.building === 'barracks' && onLineup && lineupTexts.includes('Sfida') && fromLineup,
    `caserma in cantiere ${upgrading.village.construction?.building}, sfida ${onLineup} (${lineupTexts[0]}), ritorno ${fromLineup}`,
  );
  ok(
    upgradeEvents.join() === 'constructionStarted,profileChanged:startUpgrade',
    `eventi del meta-gioco con Migliora: ${upgradeEvents.join(', ')}`,
  );

  // Il mondo prende l'ora da core/clock.js: l'orologio portato avanti del tempo che manca, al battito dopo la caserma
  // è finita e il suo tempo non si scrive più (il salvataggio ricaricato qui sotto riparte con l'ora vera)
  await metaEvents();
  const ahead = await run(`const { timeLeft } = await import(url('/src/meta/village.js'));
    const { advanceClock, now } = await import(url('/src/core/clock.js'));
    const ms = timeLeft(window.__game.registry.get('save').profile, now());
    advanceClock(ms);
    return ms;`);
  await pause(1500);
  const finished = await profile();
  const timer = await evaluate(`window.__game.scene.getScene('World').timer === null`);
  ok(
    ahead > 0 && finished.village.levels.barracks === 2 && finished.village.construction === null && timer,
    `orologio avanti di ${Math.round(ahead / 1000)} s: caserma liv. ${finished.village.levels.barracks}, cantiere ${finished.village.construction?.building ?? 'finito'}, tempo sul mondo sparito ${timer}`,
  );
  // Finito con il tempo, al battito del mondo: si dice una volta sola, e si salva
  const timeEvents = await metaEvents();
  const savedLevel = await evaluate(`JSON.parse(localStorage.getItem('fall-out.save')).profile.village.levels.barracks`);
  ok(
    timeEvents.join() === 'constructionFinished,profileChanged:settle' && savedLevel === 2,
    `eventi del meta-gioco con il tempo: ${timeEvents.join(', ')}; sul telefono caserma liv. ${savedLevel}`,
  );

  // Un salvataggio di prima del 4.7: gli edifici costruiti trovano posto da soli
  await evaluate(
    `localStorage.setItem('fall-out.save', JSON.stringify({ version: 1, profile: { resources: { materials: 40 }, village: { levels: { farm: 2, barracks: 0, forge: 1 }, construction: null, farm: { stored: 0, since: 0 } } } })); 0`,
  );
  await send('Page.reload');
  await pause(3000);
  await hook();
  await until(`window.__game?.scene.isActive('WorldUI') === true`, 10);
  await pause(500);
  const legacy = await profile();
  const drawn = await evaluate(`window.__game.scene.getScene('World').targets.map((t) => t.id).join(',')`);
  await shot('47-10-vecchio');
  ok(
    legacy.village.positions.farm !== null &&
      legacy.village.positions.forge !== null &&
      legacy.village.positions.barracks === null &&
      drawn.split(',').length === 2,
    `salvataggio del 4.6: posti ${JSON.stringify(legacy.village.positions)}, disegnati ${drawn}`,
  );
  // È un salvataggio 1, portato alla versione 2: senza strada si parte dalla porta
  const status = await evaluate(`window.__game.registry.get('save').status`);
  ok(
    status === 'migrated' && legacy.road.at === 0 && legacy.road.done,
    `salvataggio 1: ${status}, cammino ${JSON.stringify(legacy.road)}`,
  );

  // In battaglia guida un dito solo: dalla strada una battaglia, poi un dito che trascina e un secondo che si muove
  const lineupHud2 = await run('return balance.HUD.lineup;');
  await edit(`const { ROAD_TILES } = await import(url('/src/meta/road.js'));
    p.road = { at: ROAD_TILES.find((t) => t.kind === 'battle').index, done: false }`);
  await evaluate("window.__game.scene.getScene('World').bus.emit('worldChanged'); 0");
  await evaluate("window.__game.scene.getScene('World').bus.emit('pawnFocusRequested'); 0");
  await pause(600);
  // Il capo sta sulla battaglia da vincere: toccandolo si apre il suo schieramento
  const [lx, ly] = await screenOf('{ x: s.road.pawn.x, y: s.road.pawn.y - s.road.pawn.displayHeight / 4 }');
  await gameTap(lx, ly);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  await gameTap(lineupHud2.startButton.x, lineupHud2.startButton.y);
  const fighting = await until(`window.__game.scene.isActive('Battle') === true`, 5);
  await pause(1500);
  await hook();
  await pause(500);
  const armyX = () => evaluate(`window.__battle?.army?.x ?? null`);
  const x0 = await armyX();
  await touch('touchStart', [[1, 360, 900]]);
  for (let i = 1; i <= 5; i++) {
    await touch('touchMove', [[1, 360 + i * 20, 900]]);
    await pause(30);
  }
  await pause(300);
  const x1 = await armyX();
  await touch('touchStart', [
    [1, 460, 900],
    [2, 200, 900],
  ]);
  for (let i = 1; i <= 5; i++) {
    await touch('touchMove', [
      [1, 460, 900],
      [2, 200 + i * 20, 900],
    ]);
    await pause(30);
  }
  await pause(300);
  const x2 = await armyX();
  await touch('touchEnd', []);
  ok(
    fighting && x0 !== null && Math.abs(x1 - x0) > 20 && Math.abs(x2 - x1) < 5,
    `battaglia ${fighting}: un dito sposta l'esercito ${x0?.toFixed?.(0)} → ${x1?.toFixed?.(0)}, il secondo no → ${x2?.toFixed?.(0)}`,
  );

  // Un salvataggio rovinato con la copia di riserva buona: si riprende la copia, con le sue risorse, e il mondo lo
  // dice; il rovinato resta da parte. Andando agli Eroi e tornando l'avviso non si ripete
  const SAVE = await run('return balance.SAVE;');
  const notices = await run('return balance.HUD.world.saveNotices;');
  const good = JSON.stringify({ version: SAVE.version, profile: { resources: { materials: 321, scrap: 7 } } });
  await evaluate(
    `localStorage.setItem('${SAVE.storageKey}', '{rotto'); localStorage.setItem('${SAVE.backupKey}', ${JSON.stringify(good)}); 0`,
  );
  await send('Page.reload');
  await pause(3000);
  await hook();
  await until(`window.__game?.scene.isActive('WorldUI') === true`, 10);
  const warned = await texts('WorldUI');
  const restored = await profile();
  const restoredStatus = await evaluate(`window.__game.registry.get('save').status`);
  const brokenKept = await evaluate(`localStorage.getItem('${SAVE.brokenKey}')`);
  await shot('47-11-copia');
  ok(
    restoredStatus === 'restored' &&
      warned.includes(notices.restored) &&
      restored.resources.materials === 321 &&
      restored.resources.scrap === 7 &&
      brokenKept === '{rotto',
    `salvataggio rovinato con la copia buona: ${restoredStatus}, avviso «${warned.find((t) => Object.values(notices).includes(t)) ?? 'nessuno'}», materiali ${restored.resources.materials}, rottami ${restored.resources.scrap}, rovinato tenuto da parte ${brokenKept === '{rotto'}`,
  );
  await gameTap(HUD.heroesButton.x, HUD.heroesButton.y);
  const toHeroes = await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  await gameTap(heroesHud.back.x, heroesHud.back.y);
  const backToWorld = await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);
  const after = await texts('WorldUI');
  ok(
    toHeroes && backToWorld && !after.some((t) => Object.values(notices).includes(t)),
    `Eroi ${toHeroes} e ritorno ${backToWorld}: avviso ripetuto ${after.some((t) => Object.values(notices).includes(t))}`,
  );
} finally {
  await game.close();
}
