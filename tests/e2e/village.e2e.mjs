// Prova end-to-end dello step 4.7, rifatta sul 4.8 (la mappa non c'è più), sull'A5 (Strada al posto di Esplora) e
// sull'A6 (barre a icone), in Edge headless: il mondo si apre sul villaggio; Costruisci apre la striscia; la fattoria
// si mette (trascinata e confermata con ✓) e apre il suo cantiere; Accelera lo chiude; le razioni pronte si raccolgono
// toccando la bolla; tenendo premuto un edificio lo si sposta; fuori dal territorio ✓ non fa niente e ✗ annulla;
// tenendo premuto il capo davanti a un edificio non si prende l'edificio; rotella, pizzico e trascinamento muovono la
// vista; Strada porta dal capo, anche dallo zoom più lontano avvicinandosi, Eroi e Sfida alle loro scene e si torna al
// mondo con la stessa vista; l'orologio del gioco portato avanti finisce il cantiere; con due posti cantiere (A1, dal
// trucco) due edifici salgono insieme con i loro due tempi, il terzo no, e finiscono tutti e due; un salvataggio di
// prima del 4.7 (versione 1, portato a quella di oggi) mette da solo gli edifici; in battaglia (toccando il capo sulla
// battaglia da vincere) un secondo dito non guida l'esercito; un salvataggio rovinato con la copia di riserva buona
// riprende la copia, lo dice finché l'avviso non si chiude e alla prima scrittura tiene da parte il rovinato; FPS da
// lontano e da vicino; errori in console
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
  await game.reload();
  await pause(500);
  const HUD = await run('return balance.HUD.world;');
  // Dove toccare: un'icona della barra in basso; il comando numero index (da 0) della barra dell'edificio; la scheda
  // numero index (da 0) della striscia Costruisci
  const barIcon = (id) => [HUD.bar.items[id], HUD.bar.y];
  const { buildingBar, strip } = HUD;
  const barTop = buildingBar.bottom - buildingBar.height;
  const command = (index) => [buildingBar.buttons.xs[index], barTop + buildingBar.buttons.y];
  const stripCard = (index) => {
    const { card } = strip;
    const left = (720 - strip.width) / 2 + strip.padding;
    const x = left + index * (card.width + card.gap) + card.width / 2;
    return [x, strip.bottom - strip.height + strip.cardsY + card.height / 2];
  };
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

  // Costruisci: la striscia con i quattro edifici da mettere (il Capanno dei mastri ancora fermo)
  await gameTap(...barIcon('build'));
  const menu = await texts('WorldUI');
  ok(
    ['Capanno dei mastri', 'Fattoria', 'Caserma', 'Fucina'].every((name) => menu.includes(name)),
    `striscia: ${menu.filter((t) => t.length < 40).join(' | ')}`,
  );
  await shot('47-2-menu');
  await gameTap(...stripCard(1));
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
      placed.village.sites[0]?.building === 'farm' &&
      placed.resources.wood === before.resources.wood - 7 &&
      placed.resources.stone === before.resources.stone - 3,
    `✓: posto ${JSON.stringify(placed.village.positions.farm)}, cantiere ${placed.village.sites[0]?.building}, legno ${placed.resources.wood}, pietra ${placed.resources.stone}; scheda ${panel.filter((t) => t.includes('Fattoria') || t.includes('costruzione')).join(' | ')}`,
  );
  await shot('47-4-cantiere');
  ok(
    placedEvents.join() === 'constructionStarted,profileChanged:placeBuilding',
    `eventi del meta-gioco con ✓: ${placedEvents.join(', ')}`,
  );

  // Accelera (il secondo comando del cantiere): una gemma, e il cantiere di un minuto finisce subito
  await gameTap(...command(1));
  await pause(1300);
  const built = await profile();
  ok(
    built.village.levels.farm === 1 &&
      built.resources.gems === before.resources.gems - 1 &&
      built.village.sites.length === 0,
    `accelerata: fattoria liv. ${built.village.levels.farm}, gemme ${built.resources.gems}`,
  );
  const accelerated = await metaEvents();
  ok(
    accelerated.join() === 'constructionShortened,constructionFinished,profileChanged:useGem',
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
      moved.resources.wood === collected.resources.wood,
    `spostata in ${JSON.stringify(moved.village.positions.farm)} (liv. ${moved.village.levels.farm}, legno ${moved.resources.wood})`,
  );
  ok(
    movedEvents.join() === 'profileChanged:moveBuilding',
    `eventi del meta-gioco spostando: ${movedEvents.join(', ')}`,
  );

  // Spostata (come tenendola premuta) fuori dal territorio: ✓ spento, ✗ annulla
  await evaluate("window.__game.scene.getScene('World').bus.emit('moveRequested', { id: 'farm' }); 0");
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

  // Tenuto premuto il capo davanti alla fattoria (messa dietro di lui, appena dentro le mura): come un tocco vince il
  // capo, e la fattoria non si prende; lasciando si apre la scheda della strada
  await edit(`p.village.positions.farm = { col: 19, row: 15 };
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await evaluate("window.__game.scene.getScene('World').focusPawn(true); 0");
  await pause(800);
  const behind = await run(`const { pawnAt } = await import(url('/src/view/worldRoad.js'));
    const { insidePolygon } = await import(url('/src/view/iso.js'));
    const { worldToScreen } = await import(url('/src/view/worldCamera.js'));
    const s = window.__game.scene.getScene('World');
    const farm = s.targets.find((target) => target.id === 'farm');
    const box = s.road.pawn.getBounds();
    const both = [];
    for (let y = box.top; y < box.bottom; y += 2) for (let x = box.left; x < box.right; x += 2) {
      if (pawnAt(s.road, { x, y }) && insidePolygon(farm.outline, x, y)) both.push({ x, y });
    }
    const where = { farm: s.save.profile.village.positions.farm, road: s.save.profile.road.at, points: both.length };
    if (both.length === 0) return { ...where, at: null };
    // Il punto della parte comune più vicino al suo centro, lontano dai bordi di tutti e due
    const mid = { x: both.reduce((sum, p) => sum + p.x, 0) / both.length, y: both.reduce((sum, p) => sum + p.y, 0) / both.length };
    const point = both.reduce((best, p) => (Math.hypot(p.x - mid.x, p.y - mid.y) < Math.hypot(best.x - mid.x, best.y - mid.y) ? p : best));
    const p = worldToScreen(s.cameras.main, point.x, point.y);
    return { ...where, at: [p.x, p.y], picked: JSON.stringify(s.pickAt(point)) };`);
  if (behind.at !== null) await drag(...behind.at, ...behind.at, { steps: 1, holdMs: 700 });
  const heldPawn = await evaluate(
    `(() => ({ placing: window.__game.scene.getScene('World').placement !== null, sheet: window.__game.scene.getScene('WorldUI').sheet?.kind ?? null }))()`,
  );
  await evaluate("window.__game.scene.getScene('World').endPlacement(); 0");
  await evaluate("window.__game.scene.getScene('World').bus.emit('groundTapped'); 0");
  await edit(`p.village.positions.farm = ${JSON.stringify(cancelled.village.positions.farm)};
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  ok(
    behind.at !== null &&
      behind.farm.col === 19 &&
      behind.farm.row === 15 &&
      behind.road === 0 &&
      !heldPawn.placing &&
      heldPawn.sheet === 'road',
    `capo tenuto premuto davanti alla fattoria (${JSON.stringify(behind.farm)}, capo sulla casella ${behind.road}, punto ${behind.at?.map(Math.round)} di ${behind.points} in comune, un tocco lì prende ${behind.picked}): fattoria presa ${heldPawn.placing}, scheda ${heldPawn.sheet}`,
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
  await gameTap(...barIcon('road'));
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
  await gameTap(...barIcon('heroes'));
  const onHeroes = await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  const heroesHud = await run('return balance.HUD.heroes;');
  // Negli eroi: Recluta, poi il posto 1 svuotato e rimesso com'era (toccando il posto e l'eroe che c'è, due volte)
  await metaEvents();
  await gameTap(heroesHud.recruit.button.x, heroesHud.recruit.button.y);
  const message = (await texts('Heroes')).find((t) => t.startsWith('Nuovo eroe') || t.includes('già tuo'));
  const pulled = await metaEvents();
  const seat = await run(`const { HEROES } = await import(url('/src/data/heroes.js'));
    const p = window.__game.registry.get('save').profile;
    const { list, grid, slots } = balance.HUD.heroes;
    const index = Object.keys(HEROES).indexOf(p.lineup[1]);
    const width = (list.width - grid.gap * (grid.columns - 1)) / grid.columns;
    const x = list.x + (index % grid.columns) * (width + grid.gap) + width / 2;
    const card = [x, list.y + Math.floor(index / grid.columns) * (grid.height + grid.gap) + grid.height / 2];
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

  // Strada da lontano (lo zoom più lontano): la vista si avvicina fino allo zoom di partenza e va dal capo, e la
  // casella da toccare si vede tra le risorse e la scheda, abbastanza grande per il dito
  await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); s.cameras.main.setZoom(${limits.min}); s.fitOverlays(); return 0; })()`,
  );
  await gameTap(...barIcon('road'));
  await pause(600);
  const farRoad = await camera();
  const [tx, ty] = await screenOf(`(await (async () => {
    const { targetTile } = await import(url('/src/meta/road.js'));
    const { tileSpot } = await import(url('/src/view/worldRoad.js'));
    return tileSpot(targetTile(window.__game.registry.get('save').profile)).center;
  })())`);
  const cell = (await run('return balance.WORLD_VIEW.tileWidth;')) * farRoad.zoom;
  await evaluate("window.__game.scene.getScene('World').bus.emit('groundTapped'); 0");
  ok(
    Math.abs(farRoad.zoom - limits.start) < 1e-6 &&
      ty > HUD.top.height &&
      ty < HUD.panel.bottom - HUD.panel.height &&
      tx > 0 &&
      tx < 720,
    `Strada dallo zoom più lontano (${limits.min.toFixed(3)}): zoom ${farRoad.zoom.toFixed(3)} (di partenza ${limits.start.toFixed(3)}), casella da toccare a ${Math.round(tx)},${Math.round(ty)}, larga ${Math.round(cell)} pixel`,
  );

  // Sfida di un cantiere lungo: la caserma messa al liv. 1, con il centro città al 3 (che più avanti la lascia salire
  // ancora), Migliora (8 min), Sfida → schieramento della sfida
  await edit(`const { freeSpot } = await import(url('/src/meta/village.js'));
    p.village.levels.center = 3;
    p.village.levels.barracks = 1;
    p.village.positions.barracks = freeSpot(p.village.positions, 'barracks', 0);
    Object.assign(p.resources, { wood: 500, stone: 500, gears: 100 });
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await evaluate("window.__game.scene.getScene('World').bus.emit('focusRequested', { id: 'barracks' }); 0");
  await pause(800);
  const [kx, ky] = await buildingCenter('barracks');
  await gameTap(kx, ky);
  await metaEvents();
  await gameTap(...command(0));
  await pause(400);
  const upgradeEvents = await metaEvents();
  const upgrading = await profile();
  await shot('47-9-caserma');
  await gameTap(...command(0));
  const onLineup = await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  const lineupTexts = onLineup ? await texts('Lineup') : [];
  const lineupHud = await run('return balance.HUD.lineup;');
  await gameTap(lineupHud.backButton.x, lineupHud.backButton.y);
  const fromLineup = await until(`window.__game.scene.isActive('World') === true`, 5);
  ok(
    upgrading.village.sites[0]?.building === 'barracks' &&
      onLineup &&
      lineupTexts.includes('Sfida') &&
      lineupTexts.some((t) => t.endsWith('Caserma')) &&
      fromLineup,
    `caserma in cantiere ${upgrading.village.sites[0]?.building}, sfida ${onLineup} (${lineupTexts[0]}, «${lineupTexts.find((t) => t.endsWith('Caserma'))}»), ritorno ${fromLineup}`,
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
    const ms = timeLeft(window.__game.registry.get('save').profile, 'barracks', now());
    advanceClock(ms);
    return ms;`);
  await pause(1500);
  const finished = await profile();
  const timer = await evaluate(`window.__game.scene.getScene('World').timers.length === 0`);
  ok(
    ahead > 0 && finished.village.levels.barracks === 2 && finished.village.sites.length === 0 && timer,
    `orologio avanti di ${Math.round(ahead / 1000)} s: caserma liv. ${finished.village.levels.barracks}, cantiere ${finished.village.sites[0]?.building ?? 'finito'}, tempo sul mondo sparito ${timer}`,
  );
  // Finito con il tempo, al battito del mondo: si dice una volta sola, e si salva
  const timeEvents = await metaEvents();
  const savedLevel = await evaluate(
    `JSON.parse(localStorage.getItem('fall-out.save')).profile.village.levels.barracks`,
  );
  ok(
    timeEvents.join() === 'constructionFinished,profileChanged:settle' && savedLevel === 2,
    `eventi del meta-gioco con il tempo: ${timeEvents.join(', ')}; sul telefono caserma liv. ${savedLevel}`,
  );

  // A1: due posti cantiere, con il trucco del pannello di sviluppo (debug/cheats.js). La fattoria sale dalla sua scheda
  // e la fucina si mette dal menu Costruisci (seconda riga, dopo il Capanno dei mastri), insieme, ognuna con il suo
  // tempo sul mondo; schede e menu dicono i posti occupati; la caserma non può salire (lo dice, e Migliora non fa
  // niente); l'obiettivo dice i posti e il cantiere che finisce per primo; l'orologio avanti li finisce tutti e due in
  // un battito
  await run(`const { setBuilders } = await import(url('/src/debug/cheats.js'));
    setBuilders(window.__game.registry.get('save').profile, 2);
    window.__game.scene.getScene('World').bus.emit('worldChanged');
    return 0;`);
  // Le schede si aprono come toccando l'edificio (World.select): qui la caserma sta davanti a un pezzo della fattoria
  await evaluate("window.__game.scene.getScene('World').select('farm'); 0");
  await pause(800);
  const farmSheet = await texts('WorldUI');
  await metaEvents();
  await gameTap(...command(0));
  const farmEvents = await metaEvents();
  await gameTap(...barIcon('build'));
  const buildMenu = await texts('WorldUI');
  await gameTap(...stripCard(1));
  await pause(700);
  const forgeGhost = await evaluate(
    `(() => { const s = window.__game.scene.getScene('World'); return s.placement && { id: s.placement.id, valid: s.placement.valid }; })()`,
  );
  await gameTap(...(await confirmOf('ok')));
  await pause(400);
  const forgeEvents = await metaEvents();
  const forgeSheet = await texts('WorldUI');
  const parallel = await profile();
  const timers = await evaluate(
    `window.__game.scene.getScene('World').timers.map((t) => t.id + ' ' + t.text.text).join(' | ')`,
  );
  await shot('A1-1-due-cantieri');
  ok(
    farmSheet.includes('Cantieri: 0/2') &&
      farmEvents.join() === 'constructionStarted,profileChanged:startUpgrade' &&
      buildMenu.includes('Cantieri: 1/2') &&
      forgeGhost?.id === 'forge' &&
      forgeEvents.join() === 'constructionStarted,profileChanged:placeBuilding' &&
      forgeSheet.includes('Cantieri: 2/2') &&
      parallel.village.sites.map((site) => site.building).join() === 'farm,forge' &&
      /^farm \d.* \| forge \d/.test(timers),
    `due posti: scheda della fattoria «Cantieri: 0/2» ${farmSheet.includes('Cantieri: 0/2')}, Migliora [${farmEvents.join(', ')}]; menu «${buildMenu.find((t) => t.startsWith('Cantieri'))}», fucina da mettere ${JSON.stringify(forgeGhost)}, ✓ [${forgeEvents.join(', ')}], scheda «${forgeSheet.find((t) => t.startsWith('Cantieri'))}»; cantieri ${parallel.village.sites.map((site) => site.building).join(', ')}; tempi sul mondo ${timers}`,
  );

  // Con i posti tutti occupati la caserma non sale: la sua scheda lo dice e Migliora non apre niente
  await evaluate("window.__game.scene.getScene('World').select('barracks'); 0");
  await pause(800);
  const barracksSheet = await texts('WorldUI');
  await shot('A1-2-posti-occupati');
  await metaEvents();
  await gameTap(...command(0));
  const refusedEvents = await metaEvents();
  const refused = await profile();
  await evaluate("window.__game.scene.getScene('World').bus.emit('groundTapped'); 0");
  await pause(300);
  const goalLine = (await texts('WorldUI')).find((t) => t.startsWith('Cantieri'));
  ok(
    barracksSheet.includes(HUD.labels.allBusy) &&
      barracksSheet.includes('Cantieri: 2/2') &&
      refusedEvents.length === 0 &&
      refused.village.sites.length === 2 &&
      refused.village.levels.barracks === 2 &&
      goalLine?.startsWith('Cantieri: 2/2 · Fucina liv. 1 finisce tra'),
    `posti occupati: scheda della caserma «${barracksSheet.find((t) => t === HUD.labels.allBusy) ?? '-'}», Migliora [${refusedEvents.join(', ')}] (cantieri ${refused.village.sites.length}); obiettivo «${goalLine}»`,
  );

  // L'orologio avanti oltre le due fini: in un battito finiscono tutti e due, con un evento ciascuno, e i tempi
  // spariscono
  await metaEvents();
  await run(`const { timeLeft } = await import(url('/src/meta/village.js'));
    const { advanceClock, now } = await import(url('/src/core/clock.js'));
    const p = window.__game.registry.get('save').profile;
    advanceClock(Math.max(...p.village.sites.map((site) => timeLeft(p, site.building, now()))));
    return 0;`);
  await pause(1500);
  const bothDone = await profile();
  const bothEvents = await metaEvents();
  const noTimers = await evaluate(`window.__game.scene.getScene('World').timers.length === 0`);
  ok(
    bothDone.village.levels.farm === 2 &&
      bothDone.village.levels.forge === 1 &&
      bothDone.village.sites.length === 0 &&
      bothEvents.join() === 'constructionFinished,constructionFinished,profileChanged:settle' &&
      noTimers,
    `orologio avanti: fattoria liv. ${bothDone.village.levels.farm}, fucina liv. ${bothDone.village.levels.forge}, cantieri aperti ${bothDone.village.sites.length}, eventi [${bothEvents.join(', ')}], tempi spariti ${noTimers}`,
  );

  // Un salvataggio di prima del 4.7: gli edifici costruiti trovano posto da soli, e il centro città il suo
  await evaluate(
    `localStorage.setItem('fall-out.save', JSON.stringify({ version: 1, profile: { resources: { materials: 40 }, village: { levels: { farm: 2, barracks: 0, forge: 1 }, construction: null, farm: { stored: 0, since: 0 } } } })); 0`,
  );
  await game.reload();
  await pause(500);
  const legacy = await profile();
  const drawn = await evaluate(`window.__game.scene.getScene('World').targets.map((t) => t.id).join(',')`);
  await shot('47-10-vecchio');
  ok(
    legacy.village.positions.farm !== null &&
      legacy.village.positions.forge !== null &&
      legacy.village.positions.center !== null &&
      legacy.village.positions.barracks === null &&
      drawn.split(',').length === 3,
    `salvataggio del 4.6: posti ${JSON.stringify(legacy.village.positions)}, disegnati ${drawn}`,
  );
  // È un salvataggio 1, portato alla versione di oggi: senza strada si parte dalla porta
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
  // dice; leggendo il telefono non cambia, e alla prima scrittura il rovinato resta da parte e la copia buona com'era.
  // L'avviso è dato quando si chiude: andando agli Eroi mentre si vede, tornando c'è ancora; chiuso toccandolo, andando
  // e tornando non si ripete
  const SAVE = await run('return balance.SAVE;');
  const notices = await run('return balance.HUD.world.saveNotices;');
  const good = JSON.stringify({ version: SAVE.version, profile: { resources: { wood: 321, gears: 7 } } });
  await evaluate(
    `localStorage.setItem('${SAVE.storageKey}', '{rotto'); localStorage.setItem('${SAVE.backupKey}', ${JSON.stringify(good)}); localStorage.removeItem('${SAVE.brokenKey}'); 0`,
  );
  await game.reload();
  const shownNotice = () => texts('WorldUI').then((list) => list.find((t) => Object.values(notices).includes(t)));
  const warned = await shownNotice();
  const restored = await profile();
  const restoredStatus = await evaluate(`window.__game.registry.get('save').status`);
  const keys = () =>
    evaluate(
      `[localStorage.getItem('${SAVE.storageKey}'), localStorage.getItem('${SAVE.brokenKey}'), localStorage.getItem('${SAVE.backupKey}')]`,
    );
  const [mainRead, brokenRead] = await keys();
  await shot('47-11-copia');
  const toHeroesShown = (await evaluate(`window.__game.scene.getScene('WorldUI').notice`)) !== null;
  await gameTap(...barIcon('heroes'));
  const toHeroes = await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  await gameTap(heroesHud.back.x, heroesHud.back.y);
  const backToWorld = await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);
  const again = await shownNotice();
  ok(
    toHeroesShown && toHeroes && backToWorld && again === notices.restored,
    `Eroi con l'avviso aperto ${toHeroesShown} (${toHeroes}) e ritorno ${backToWorld}: l'avviso c'è ancora «${again ?? 'nessuno'}»`,
  );
  const [nx, ny] = await evaluate(`(() => {
    const ui = window.__game.scene.getScene('WorldUI');
    const text = ui.children.list.find((o) => o.type === 'Text' && o.text === ${JSON.stringify(notices.restored)});
    return [text.x, text.y + text.height / 2];
  })()`);
  await gameTap(nx, ny);
  const closed = await evaluate(`window.__game.scene.getScene('WorldUI').notice === null`);
  await gameTap(...barIcon('heroes'));
  const toHeroes2 = await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  await gameTap(heroesHud.back.x, heroesHud.back.y);
  const backToWorld2 = await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);
  const after = await shownNotice();
  const stillRestored = (await evaluate(`window.__game.registry.get('save').status`)) === 'restored';
  ok(
    closed && toHeroes2 && backToWorld2 && stillRestored && after === undefined,
    `avviso chiuso toccandolo ${closed}; Eroi ${toHeroes2} e ritorno ${backToWorld2} (salvataggio ancora ripreso dalla copia ${stillRestored}): avviso ripetuto ${after !== undefined}`,
  );
  await edit('');
  const [mainWritten, brokenKept, backupKept] = await keys();
  ok(
    restoredStatus === 'restored' &&
      warned === notices.restored &&
      restored.resources.wood === 321 &&
      restored.resources.gears === 7 &&
      mainRead === '{rotto' &&
      brokenRead === null &&
      JSON.parse(mainWritten).profile.resources.wood === 321 &&
      brokenKept === '{rotto' &&
      backupKept === good,
    `salvataggio rovinato con la copia buona: ${restoredStatus}, avviso «${warned ?? 'nessuno'}», legno ${restored.resources.wood}, ingranaggi ${restored.resources.gears}; letto, il telefono com'era ${mainRead === '{rotto' && brokenRead === null}; alla prima scrittura rovinato tenuto da parte ${brokenKept === '{rotto'}, copia buona com'era ${backupKept === good}`,
  );
} finally {
  await game.close();
}
