// Prova end-to-end dello step 4.8 in Edge headless: il capo alla porta; Esplora porta da lui e apre la scheda della
// strada; Avanza: una casella neutra non costa, una raccolta dà il suo premio, una battaglia costa e apre lo
// schieramento (Battaglia 1 di 3, Area 1 di 24); Mondo torna con Combatti; persa si resta lì senza pagare, vinta si
// prosegue; il boss conquista l'area (notizia, terreno, area dopo) e il salvataggio 1 di prima, riscritto, è alla
// versione 2 con il cammino come area e posto nell'area; un edificio si mette nell'area conquistata; toccare il capo o
// la strada apre la scheda, il terreno la chiude; senza razioni Avanza è spento; lasciare a metà una battaglia della
// strada riporta alla strada; FPS da lontano e da vicino; errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('48');
const { send, evaluate, shot, run, hook } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
const profile = async () => JSON.parse(await evaluate(`JSON.stringify(window.__game.registry.get('save').profile)`));
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
// Un punto del mondo sullo schermo del gioco, con la camera di adesso
const screenOf = (expression) =>
  run(`const { worldToScreen } = await import(url('/src/view/worldCamera.js'));
  const s = window.__game.scene.getScene('World');
  const at = ${expression};
  const p = worldToScreen(s.cameras.main, at.x, at.y);
  return [p.x, p.y];`);
// Il pulsante grande della scheda (Avanza o Combatti) e Chiudi
const sheetButton = async (which) => {
  const { panel } = await run('return balance.HUD.world;');
  const top = panel.bottom - panel.height;
  return [panel.wideButton.x, top + (which === 'main' ? panel.buttonY : panel.lowerY)];
};
const tapMain = async () => {
  const [x, y] = await sheetButton('main');
  await gameTap(x, y);
};
const world = (body) => evaluate(`(() => { const s = window.__game.scene.getScene('World'); ${body} })()`);
const reopen = async () => {
  await send('Page.reload');
  await pause(3000);
  await hook();
  await pause(600);
};
const save = (data) =>
  evaluate(
    `localStorage.setItem('fall-out.save', JSON.stringify({ version: 1, profile: ${JSON.stringify(data)} })); 0`,
  );
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
// Una battaglia in corso finisce vinta (livello completato) o persa (il capo cade)
const finish = async (win) => {
  await until(
    'window.__battle !== undefined && window.__battle.ms > 800 && window.__game.scene.isActive("Battle")',
    30,
  );
  await evaluate(
    win
      ? `(() => { window.__battle.bus.emit('levelCompleted'); return 0; })()`
      : `(() => { const b = window.__battle; b.bus.emit('heroHit', { hero: b.army.leader, damage: 1e9 }); return 0; })()`,
  );
  await until(`window.__game.scene.isActive('Summary') === true`, 20);
  await pause(900);
  await gameTap(360, 600);
  await until(`window.__game.scene.isActive('World') === true`, 10);
  await pause(700);
};

try {
  console.log('aggancio:', await game.open('e2e48'));
  const lineupLayout = await run('return balance.HUD.lineup;');
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await reopen();
  await recordMeta();

  // Il capo alla porta; Esplora: la vista va da lui e si apre la scheda della strada
  const pawnAtGate = await run(`const s = window.__game.scene.getScene('World');
    const { gateCells } = await import(url('/src/meta/world.js'));
    const { toWorld } = await import(url('/src/view/iso.js'));
    const { inside, outside } = gateCells();
    const at = toWorld((inside.col + outside.col) / 2 + 0.5, (inside.row + outside.row) / 2 + 0.5);
    return Math.abs(s.road.pawn.x - at.x) < 0.01 && Math.abs(s.road.pawn.y - at.y) < 0.01;`);
  const explore = await run('return balance.HUD.world.exploreButton;');
  await gameTap(explore.x, explore.y);
  await pause(600);
  let sheet = await texts('WorldUI');
  ok(
    pawnAtGate &&
      sheet.includes('Strada · Area 1 di 24') &&
      sheet.includes('Alla porta del villaggio') &&
      sheet.includes('Avanza'),
    `capo alla porta ${pawnAtGate}; scheda: ${sheet
      .filter((t) => t.length > 6)
      .slice(2, 7)
      .join(' | ')}`,
  );
  await shot('48-1-scheda');

  // Avanza: la neutra non costa, la raccolta dà il suo premio
  let p = await profile();
  const rations = p.resources.rations;
  await metaEvents();
  await tapMain();
  await pause(500);
  let q = await profile();
  ok(
    q.road.at === 1 && q.resources.rations === rations,
    `neutra: casella ${q.road.at}, razioni ${q.resources.rations}`,
  );
  const stepped = await metaEvents();
  ok(stepped.join() === 'stepped,profileChanged:step', `eventi del meta-gioco con Avanza: ${stepped.join(', ')}`);
  const tile2 = await run(`const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES[2];`);
  await tapMain();
  await pause(500);
  const gainText = await texts('World');
  p = q;
  q = await profile();
  ok(
    q.road.at === 2 &&
      q.resources[tile2.resource] === p.resources[tile2.resource] + tile2.amount &&
      gainText.some((t) => t.startsWith('+')),
    `raccolta: ${tile2.resource} ${p.resources[tile2.resource]} → ${q.resources[tile2.resource]}, scritta ${gainText.find((t) => t.startsWith('+'))}`,
  );
  await shot('48-2-raccolta');

  // Avanza su una battaglia: costa e apre lo schieramento
  const tile3 = await run(`const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES[3];`);
  await tapMain();
  const opened = await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  q = await profile();
  const lineup = await texts('Lineup');
  ok(
    tile3.kind === 'battle' &&
      opened &&
      q.road.at === 3 &&
      !q.road.done &&
      q.resources.rations === rations - 1 &&
      lineup.includes('Battaglia 1 di 3') &&
      lineup.includes('Area 1 di 24') &&
      lineup.includes('Mondo'),
    `battaglia: schieramento ${opened}, razioni ${q.resources.rations}; ${lineup.slice(0, 3).join(' | ')}`,
  );
  await shot('48-3-schieramento');

  // Mondo: si torna con la scheda della strada e Combatti
  await gameTap(lineupLayout.backButton.x, lineupLayout.backButton.y);
  await until(`window.__game.scene.isActive('World') === true`, 6);
  await pause(600);
  sheet = await texts('WorldUI');
  ok(
    sheet.includes('Combatti') && sheet.some((t) => t.startsWith('Qui: battaglia')),
    `di ritorno: ${sheet.filter((t) => t.startsWith('Qui') || t === 'Combatti').join(' | ')}`,
  );
  await shot('48-4-combatti');

  // Persa: si resta lì e le razioni non scendono; vinta: fatta, si prosegue
  await tapMain();
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  await gameTap(lineupLayout.startButton.x, lineupLayout.startButton.y);
  await finish(false);
  q = await profile();
  sheet = await texts('WorldUI');
  ok(
    q.road.at === 3 && !q.road.done && q.resources.rations === rations - 1 && sheet.includes('Combatti'),
    `persa: casella ${q.road.at}, fatta ${q.road.done}, razioni ${q.resources.rations}, scheda aperta ${sheet.includes('Combatti')}`,
  );
  await tapMain();
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  await gameTap(lineupLayout.startButton.x, lineupLayout.startButton.y);
  await finish(true);
  q = await profile();
  sheet = await texts('WorldUI');
  ok(
    q.road.at === 3 && q.road.done && sheet.includes('Avanza'),
    `vinta: fatta ${q.road.done}; ${sheet.filter((t) => t.startsWith('Avanti')).join('')}`,
  );
  await shot('48-5-vinta');

  // Il boss conquista l'area: notizia, nebbia via, terreno, area dopo
  const boss = await run(
    `const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES.filter((t) => t.area === 0).at(-1);`,
  );
  await save({ road: { at: boss.index - 1, done: true }, resources: { rations: 10, materials: 100, scrap: 20 } });
  await reopen();
  await recordMeta();
  await world(`s.bus.emit('pawnFocusRequested'); s.bus.emit('roadTapped'); return 0;`);
  await pause(600);
  await tapMain();
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  const bossTitle = await texts('Lineup');
  await metaEvents();
  await gameTap(lineupLayout.startButton.x, lineupLayout.startButton.y);
  await finish(true);
  const bossEvents = await metaEvents();
  q = await profile();
  sheet = await texts('WorldUI');
  const ground = await world(
    `const layer = s.children.list.find((o) => o.type === 'TilemapLayer'); return [layer.getTileAt(24, 15).index, layer.getTileAt(21, 18).index];`,
  );
  ok(
    bossTitle.includes('Boss') &&
      q.road.at === boss.index &&
      q.road.done &&
      sheet.some((t) => t.startsWith('Area 1 conquistata')) &&
      sheet.includes('Strada · Area 2 di 24') &&
      ground[0] === 1 &&
      ground[1] === 2,
    `boss: ${bossTitle[0]}; ${sheet.find((t) => t.startsWith('Area 1')) ?? '-'} | ${sheet.find((t) => t.startsWith('Strada'))}; terreno ${ground.join(' ')}`,
  );
  await shot('48-6-conquistata');
  ok(
    bossEvents.join() === 'battleRecorded,areaConquered,profileChanged:finishBattle',
    `eventi del meta-gioco con il boss battuto: ${bossEvents.join(', ')}`,
  );

  // Il salvataggio 1 scritto prima del boss (con la casella) si è portato alla 2: sul telefono il cammino è l'area e il
  // posto nell'area, il boss dell'area 1 (la porta è la casella 0, l'area 1 comincia dalla 1)
  const raw = JSON.parse(await evaluate(`localStorage.getItem('fall-out.save')`));
  const place = { area: 0, offset: boss.index - 1, done: true };
  ok(
    raw.version === 2 && JSON.stringify(raw.profile.road) === JSON.stringify(place),
    `sul telefono: versione ${raw.version}, cammino ${JSON.stringify(raw.profile.road)} (atteso ${JSON.stringify(place)})`,
  );

  // Un edificio nell'area conquistata
  await world(`s.bus.emit('placeRequested', { id: 'forge' }); return 0;`);
  await pause(600);
  await world(`s.placeGhost({ col: 24, row: 15 }); return 0;`);
  await pause(200);
  const valid = await world(`return s.placement.valid;`);
  const [cx, cy] = await screenOf('s.placement.buttons');
  const { gap, offsetY } = await run('return balance.WORLD_VIEW.overlays.confirm;');
  await gameTap(cx + gap / 2, cy + offsetY);
  await pause(500);
  q = await profile();
  ok(
    valid && q.village.positions.forge?.col === 24 && q.village.construction?.building === 'forge',
    `fucina nell'area 1: valida ${valid}, posto ${JSON.stringify(q.village.positions.forge)}`,
  );
  await shot('48-7-fucina-fuori');

  // Toccare il terreno chiude, il capo e la strada aprono la scheda
  await world(`s.bus.emit('groundTapped'); return 0;`);
  await pause(300);
  const [px, py] = await screenOf('{ x: s.road.pawn.x, y: s.road.pawn.y - s.road.pawn.displayHeight / 2 }');
  await gameTap(px, py);
  const byPawn = (await texts('WorldUI')).some((t) => t.startsWith('Strada'));
  await world(`s.bus.emit('groundTapped'); return 0;`);
  await pause(300);
  const [rx, ry] = await screenOf(
    `(await (async () => { const { toWorld } = await import(url('/src/view/iso.js')); return toWorld(21.5, 19.5); })())`,
  );
  await gameTap(rx, ry);
  const byRoad = (await texts('WorldUI')).some((t) => t.startsWith('Strada'));
  // Un punto del terreno che si vede tra le risorse e la scheda, senza strada né edifici
  const [gx, gy] = await run(`const { worldToScreen } = await import(url('/src/view/worldCamera.js'));
    const { toWorld } = await import(url('/src/view/iso.js'));
    const { roadTileAt } = await import(url('/src/meta/road.js'));
    const s = window.__game.scene.getScene('World');
    for (let row = 10; row < 28; row++) for (let col = 10; col < 28; col++) {
      const at = toWorld(col + 0.5, row + 0.5);
      const p = worldToScreen(s.cameras.main, at.x, at.y);
      if (p.y > 560 && p.y < 760 && p.x > 80 && p.x < 640 && roadTileAt(col, row) === null && s.buildingAt(at) === null &&
        !s.road.pawn.getBounds().contains(at.x, at.y)) return [p.x, p.y];
    }
    return [360, 600];`);
  await gameTap(gx, gy);
  const closed = !(await texts('WorldUI')).some((t) => t.startsWith('Strada'));
  ok(byPawn && byRoad && closed, `scheda: dal capo ${byPawn}, dalla strada ${byRoad}, chiusa dal terreno ${closed}`);

  // Senza razioni Avanza è spento e la scheda dice cosa fare
  const nextBattle = await run(
    `const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES.find((t) => t.area === 1 && t.kind === 'battle');`,
  );
  await save({
    road: { at: nextBattle.index - 1, done: true },
    resources: { rations: 0 },
    village: { levels: { farm: 1 }, positions: { farm: { col: 16, row: 16 } }, farm: { stored: 0, since: Date.now() } },
  });
  await reopen();
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(400);
  sheet = await texts('WorldUI');
  const before = (await profile()).road.at;
  await tapMain();
  await pause(500);
  const after = (await profile()).road.at;
  const line = sheet.find((t) => t.startsWith('Razioni'));
  ok(
    before === after && line.includes('ne servono 1') && line.includes('la prossima tra'),
    `senza razioni: resta su ${after}; ${line}`,
  );
  await shot('48-8-senza-razioni');

  // Lasciare a metà una battaglia della strada riporta alla strada
  await save({ road: { at: nextBattle.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(400);
  await tapMain();
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  await gameTap(lineupLayout.startButton.x, lineupLayout.startButton.y);
  await until(
    'window.__battle !== undefined && window.__battle.ms > 800 && window.__game.scene.isActive("Battle")',
    30,
  );
  await evaluate(`window.__game.scene.getScene('BattleUI').openMenu('pause'); 0`);
  await pause(500);
  await evaluate(`window.__game.scene.getScene('PauseMenu').leave(); 0`);
  await until(`window.__game.scene.isActive('World') === true`, 10);
  await pause(600);
  sheet = await texts('WorldUI');
  q = await profile();
  ok(
    sheet.includes('Combatti') && !q.road.done,
    `lasciata a metà: scheda ${sheet.includes('Combatti')}, fatta ${q.road.done}`,
  );

  // L'ultimo boss da rifare: la scheda si apre con Combatti, senza errori
  const errorsBefore = game.errors.length;
  await save({ road: { at: 309, done: false }, resources: { rations: 5 } });
  await reopen();
  await world(`s.bus.emit('pawnFocusRequested'); s.bus.emit('roadTapped'); return 0;`);
  await pause(500);
  sheet = await texts('WorldUI');
  ok(
    sheet.includes('Combatti') && sheet.some((t) => t.startsWith('Qui: boss')) && game.errors.length === errorsBefore,
    `ultimo boss: ${sheet.find((t) => t.startsWith('Qui')) ?? '-'}, Combatti ${sheet.includes('Combatti')}, errori nuovi ${game.errors.length - errorsBefore}`,
  );

  // Razioni che mancano ma pronte alla fattoria: Raccogli, poi Avanza
  await save({
    road: { at: nextBattle.index - 1, done: true },
    resources: { rations: 0 },
    village: { levels: { farm: 1 }, positions: { farm: { col: 16, row: 16 } }, farm: { stored: 5, since: Date.now() } },
  });
  await reopen();
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(400);
  const offer = (await texts('WorldUI')).includes('Raccogli');
  await tapMain();
  await pause(400);
  q = await profile();
  const afterCollect = await texts('WorldUI');
  ok(
    offer && q.resources.rations === 5 && afterCollect.includes('Avanza'),
    `Raccogli: offerto ${offer}, razioni ${q.resources.rations}, poi Avanza ${afterCollect.includes('Avanza')}`,
  );

  // Dalla porta: le caselle dell'area di cui non si sa il tipo hanno il punto di domanda
  await save({ road: { at: 0, done: true } });
  await reopen();
  const unknown = await world(`return s.road.markers.filter((m) => m.frame.name === 'unknown').length;`);
  ok(unknown === 7, `punti di domanda dalla porta: ${unknown} (10 caselle: 2 viste e il boss)`);

  // La caserma contro le mura davanti, dentro: le mura le stanno davanti
  await save({ village: { levels: { barracks: 1 }, positions: { barracks: { col: 18, row: 19 } } } });
  await reopen();
  const order = await run(`const s = window.__game.scene.getScene('World');
    const barracks = s.villageObjects.find((o) => o.type === 'Image' && o.frame.name === 'barracks');
    const walls = s.children.list.filter((o) => o.type === 'Graphics' && o.depth > barracks.depth - 60 && o.depth < barracks.depth + 60);
    const { zoomLimits, lookAt } = await import(url('/src/view/worldCamera.js'));
    s.cameras.main.setZoom(zoomLimits(s.cameras.main).max); s.fitOverlays();
    lookAt(s.cameras.main, barracks.x, barracks.y);
    return { barracks: barracks.depth, walls: walls.map((w) => w.depth) };`);
  await pause(500);
  await shot('48-10-caserma-mura');
  ok(
    order.walls.some((d) => d > order.barracks),
    `caserma contro le mura: profondità ${order.barracks.toFixed(0)}, pezzi di muro vicini ${order.walls.map((d) => d.toFixed(0)).join(' ')}`,
  );

  // FPS da lontano e da vicino, con la strada
  await save({ road: { at: 60, done: true }, village: { levels: { farm: 2, barracks: 2, forge: 1 } } });
  await reopen();
  const fps = [];
  for (const which of ['min', 'max']) {
    await run(`const { zoomLimits } = await import(url('/src/view/worldCamera.js'));
      const s = window.__game.scene.getScene('World');
      s.cameras.main.setZoom(zoomLimits(s.cameras.main).${which}); s.fitOverlays(); s.focusPawn(true); return 0;`);
    await pause(800);
    await game.startCounting();
    await pause(3000);
    fps.push((await game.frameStats()).fps);
  }
  await shot('48-9-vicino');
  ok(
    fps.every((value) => value >= 50),
    `FPS da lontano ${fps[0]}, da vicino ${fps[1]}`,
  );
} finally {
  await game.close();
}
