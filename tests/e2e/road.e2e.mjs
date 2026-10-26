// Prova end-to-end dello step 4.8, rifatta sull'A5 (un modo solo: toccando la strada si esplora), in Edge headless: il
// capo alla porta; Strada porta da lui e accende la prossima casella, senza schede; toccando la prossima casella, una
// neutra non costa e una raccolta dà il suo premio; trascinando la vista sopra una casella non succede niente;
// toccando una battaglia si apre lo schieramento senza pagare (Battaglia 1 di 3, Area 1 di 24, quanto costa partire),
// Mondo torna senza pagare, Parti paga; persa si resta lì e toccando il capo si riprova senza pagare, vinta si
// prosegue; il boss conquista l'area (notizia, terreno, area dopo) e il salvataggio 1 di prima, riscritto, è alla
// versione di oggi con il cammino come area e posto nell'area; un edificio si mette nell'area conquistata; toccare il
// capo, un'altra casella o l'area da conquistare apre la scheda, il terreno la chiude; senza razioni la battaglia non
// apre lo schieramento ma la scheda, che dice quante ne mancano (e Raccogli, se la fattoria ne ha); lasciare a metà
// una battaglia della strada riporta al capo; FPS da lontano e da vicino; errori in console
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
const active = (name) => evaluate(`window.__game.scene.isActive('${name}') === true`);
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
const tile = (index) => run(`const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES[${index}];`);
// Il centro della casella index della strada sullo schermo, e un tocco lì
const tileScreen = (index) =>
  screenOf(`(await (async () => {
    const { ROAD_TILES } = await import(url('/src/meta/road.js'));
    const { toWorld } = await import(url('/src/view/iso.js'));
    const t = ROAD_TILES[${index}];
    return toWorld(t.col + 0.5, t.row + 0.5);
  })())`);
const tapTile = async (index) => {
  const [x, y] = await tileScreen(index);
  await gameTap(x, y);
};
const pawnScreen = () => screenOf('{ x: s.road.pawn.x, y: s.road.pawn.y - s.road.pawn.displayHeight / 4 }');
const tapPawn = async () => {
  const [x, y] = await pawnScreen();
  await gameTap(x, y);
};
// La casella accesa dal mondo (quella con i quattro angoli nel disegno dell'ultima casella accesa), null se nessuna
const flashed = () =>
  run(`const { ROAD_TILES } = await import(url('/src/meta/road.js'));
  const { rectCorners } = await import(url('/src/view/iso.js'));
  const s = window.__game.scene.getScene('World');
  if (s.flash === null || s.flash.isDestroyed) return null;
  const buffer = s.flash.commandBuffer;
  const has = (p) => buffer.some((v, i) => v === p.x && buffer[i + 1] === p.y);
  return ROAD_TILES.find((t) => rectCorners({ col: t.col, row: t.row, cols: 1, rows: 1 }).every(has))?.index ?? -1;`);
const sheetKind = () => evaluate(`window.__game.scene.getScene('WorldUI').sheet?.kind ?? null`);
const camera = () =>
  evaluate(`(() => { const c = window.__game.scene.getScene('World').cameras.main; return [c.scrollX, c.scrollY]; })()`);
// Il pulsante grande della scheda (Raccogli) e Chiudi
const sheetButton = async (which) => {
  const { panel } = await run('return balance.HUD.world;');
  const top = panel.bottom - panel.height;
  return [panel.wideButton.x, top + (which === 'main' ? panel.buttonY : panel.lowerY)];
};
const tapSheet = async (which) => {
  const [x, y] = await sheetButton(which);
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
  const HUD = await run('return balance.HUD;');
  const lineupLayout = HUD.lineup;
  const roadButton = HUD.world.roadButton;
  const tapRoadButton = async () => {
    await gameTap(roadButton.x, roadButton.y);
    await pause(400);
  };
  const tapStart = () => gameTap(lineupLayout.startButton.x, lineupLayout.startButton.y);
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await reopen();
  await recordMeta();

  // Il capo alla porta; Strada: la vista va da lui e la prossima casella si accende, senza schede né Esplora
  const pawnAtGate = await run(`const s = window.__game.scene.getScene('World');
    const { gateCells } = await import(url('/src/meta/world.js'));
    const { toWorld } = await import(url('/src/view/iso.js'));
    const { inside, outside } = gateCells();
    const at = toWorld((inside.col + outside.col) / 2 + 0.5, (inside.row + outside.row) / 2 + 0.5);
    return Math.abs(s.road.pawn.x - at.x) < 0.01 && Math.abs(s.road.pawn.y - at.y) < 0.01;`);
  const buttons = await texts('WorldUI');
  const view0 = await camera();
  await tapRoadButton();
  const view1 = await camera();
  const lit = await flashed();
  const kindAfterRoad = await sheetKind();
  await shot('A5-1-strada');
  await pause(1600);
  const litLater = await flashed();
  ok(
    pawnAtGate &&
      buttons.includes('Strada') &&
      !buttons.includes('Esplora') &&
      (view1[0] !== view0[0] || view1[1] !== view0[1]) &&
      lit === 1 &&
      kindAfterRoad === null &&
      litLater === null,
    `capo alla porta ${pawnAtGate}; pulsanti ${buttons.filter((t) => ['Eroi', 'Costruisci', 'Strada', 'Esplora'].includes(t)).join(' ')}; Strada: vista da ${view0.map(Math.round)} a ${view1.map(Math.round)}, casella accesa ${lit}, poi ${litLater}, scheda ${kindAfterRoad}`,
  );

  // Il capo apre la scheda della strada: dove si è e cosa toccare, senza Avanza né Combatti
  await tapPawn();
  await pause(300);
  let sheet = await texts('WorldUI');
  ok(
    sheet.includes('Strada · Area 1 di 24') &&
      sheet.includes('Alla porta del villaggio') &&
      sheet.includes(HUD.world.road.hint) &&
      !sheet.includes('Avanza') &&
      !sheet.includes('Combatti'),
    `scheda dal capo: ${sheet.filter((t) => t.length > 6).slice(2, 8).join(' | ')}`,
  );
  await shot('A5-2-scheda');
  await tapSheet('close');

  // La prossima casella: la neutra non costa, la raccolta dà il suo premio
  let p = await profile();
  const rations = p.resources.rations;
  await metaEvents();
  await tapTile(1);
  await pause(400);
  let q = await profile();
  const stepped = await metaEvents();
  ok(
    q.road.at === 1 && q.resources.rations === rations && stepped.join() === 'stepped,profileChanged:step',
    `neutra toccata: casella ${q.road.at}, razioni ${q.resources.rations}, eventi ${stepped.join(', ')}`,
  );
  const tile2 = await tile(2);
  await tapTile(2);
  await pause(400);
  const gainText = await texts('World');
  p = q;
  q = await profile();
  ok(
    q.road.at === 2 &&
      q.resources[tile2.resource] === p.resources[tile2.resource] + tile2.amount &&
      gainText.some((t) => t.startsWith('+')),
    `raccolta toccata: ${tile2.resource} ${p.resources[tile2.resource]} → ${q.resources[tile2.resource]}, scritta ${gainText.find((t) => t.startsWith('+'))}`,
  );
  await shot('48-2-raccolta');

  // Trascinare la vista partendo dalla battaglia non fa niente: né schieramento, né passo, né razioni
  const tile3 = await tile(3);
  await tapRoadButton();
  const [dx, dy] = await tileScreen(3);
  const before = await camera();
  await mouse('mousePressed', dx, dy);
  for (let i = 1; i <= 6; i++) {
    await mouse('mouseMoved', dx - i * 15, dy + i * 10);
    await sleep(30);
  }
  await mouse('mouseReleased', dx - 90, dy + 60, 0);
  await pause(500);
  const after = await camera();
  const moved = after[0] !== before[0] || after[1] !== before[1];
  q = await profile();
  const dragLineup = await active('Lineup');
  ok(
    !dragLineup && q.road.at === 2 && q.resources.rations === rations && moved,
    `trascinando sopra la battaglia: schieramento ${dragLineup}, casella ${q.road.at}, razioni ${q.resources.rations}, vista mossa ${moved}`,
  );

  // Toccando la battaglia si apre lo schieramento, senza pagare; Mondo torna senza pagare
  await tapRoadButton();
  await metaEvents();
  await tapTile(3);
  const opened = await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  q = await profile();
  const lineup = await texts('Lineup');
  const openEvents = await metaEvents();
  ok(
    tile3.kind === 'battle' &&
      opened &&
      q.road.at === 2 &&
      q.road.done &&
      q.resources.rations === rations &&
      openEvents.length === 0 &&
      lineup.includes('Battaglia 1 di 3') &&
      lineup.includes('Area 1 di 24 · partire costa 1 razione') &&
      lineup.includes('Mondo'),
    `battaglia toccata: schieramento ${opened}, casella ${q.road.at}, razioni ${q.resources.rations}, eventi ${openEvents.length}; ${lineup.slice(0, 5).join(' | ')}`,
  );
  await shot('48-3-schieramento');
  await gameTap(lineupLayout.backButton.x, lineupLayout.backButton.y);
  await until(`window.__game.scene.isActive('World') === true`, 6);
  await pause(300);
  q = await profile();
  const backLit = await flashed();
  const backKind = await sheetKind();
  ok(
    q.road.at === 2 && q.road.done && q.resources.rations === rations && backLit === 3 && backKind === null,
    `Mondo dallo schieramento: casella ${q.road.at}, razioni ${q.resources.rations}, casella accesa ${backLit}, scheda ${backKind}`,
  );
  await pause(1500);

  // Parti paga ed entra nella casella; persa si resta lì senza pagare di nuovo
  await tapTile(3);
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  await metaEvents();
  await tapStart();
  await until(`window.__game.scene.isActive('Battle') === true`, 6);
  q = await profile();
  const startEvents = await metaEvents();
  ok(
    q.road.at === 3 && !q.road.done && q.resources.rations === rations - 1 &&
      startEvents.join() === 'stepped,profileChanged:enterBattle',
    `Parti: casella ${q.road.at}, fatta ${q.road.done}, razioni ${q.resources.rations}, eventi ${startEvents.join(', ')}`,
  );
  await finish(false);
  q = await profile();
  const lostLit = await flashed();
  const lostKind = await sheetKind();
  ok(
    q.road.at === 3 && !q.road.done && q.resources.rations === rations - 1 && lostLit === 3 && lostKind === null,
    `persa: casella ${q.road.at}, fatta ${q.road.done}, razioni ${q.resources.rations}, si accende la casella ${lostLit}`,
  );
  await shot('48-4-persa');

  // Toccando il capo, sulla battaglia da vincere, si riprova senza pagare; vinta si prosegue
  await pause(1500);
  await tapPawn();
  const retry = await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  const retryTexts = retry ? await texts('Lineup') : [];
  await tapStart();
  await until(`window.__game.scene.isActive('Battle') === true`, 6);
  const paidRetry = (await profile()).resources.rations;
  await finish(true);
  q = await profile();
  const wonLit = await flashed();
  ok(
    retry &&
      retryTexts.includes('Area 1 di 24 · si riprova senza pagare') &&
      paidRetry === rations - 1 &&
      q.road.at === 3 &&
      q.road.done &&
      wonLit === 4,
    `riprova dal capo: schieramento ${retry} «${retryTexts.find((t) => t.startsWith('Area')) ?? '-'}», razioni ${paidRetry}; vinta: fatta ${q.road.done}, si accende la casella ${wonLit}`,
  );
  await shot('48-5-vinta');

  // Il boss costa 2 razioni partendo e conquista l'area: notizia, nebbia via, terreno, area dopo
  const boss = await run(
    `const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES.filter((t) => t.area === 0).at(-1);`,
  );
  await save({ road: { at: boss.index - 1, done: true }, resources: { rations: 10, materials: 100, scrap: 20 } });
  await reopen();
  await recordMeta();
  await tapRoadButton();
  await tapTile(boss.index);
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  const bossTitle = await texts('Lineup');
  await metaEvents();
  await tapStart();
  await until(`window.__game.scene.isActive('Battle') === true`, 6);
  const bossRations = (await profile()).resources.rations;
  await finish(true);
  const bossEvents = await metaEvents();
  q = await profile();
  const banner = await texts('WorldUI');
  await tapPawn();
  await pause(300);
  sheet = await texts('WorldUI');
  const ground = await world(
    `const layer = s.children.list.find((o) => o.type === 'TilemapLayer'); return [layer.getTileAt(24, 15).index, layer.getTileAt(21, 18).index];`,
  );
  ok(
    bossTitle.includes('Boss') &&
      bossTitle.includes('Area 1 di 24 · partire costa 2 razioni') &&
      bossRations === 8 &&
      q.road.at === boss.index &&
      q.road.done &&
      banner.some((t) => t.startsWith('Area 1 conquistata')) &&
      sheet.includes('Strada · Area 2 di 24') &&
      ground[0] === 1 &&
      ground[1] === 2,
    `boss: ${bossTitle[0]}, razioni 10 → ${bossRations}; ${banner.find((t) => t.startsWith('Area 1')) ?? '-'} | ${sheet.find((t) => t.startsWith('Strada'))}; terreno ${ground.join(' ')}`,
  );
  await shot('48-6-conquistata');
  ok(
    bossEvents.join() === 'stepped,profileChanged:enterBattle,battleRecorded,areaConquered,profileChanged:finishBattle',
    `eventi del meta-gioco con il boss battuto: ${bossEvents.join(', ')}`,
  );

  // Il salvataggio 1 scritto prima del boss (con la casella) si è portato alla versione di oggi: sul telefono il
  // cammino è l'area e il posto nell'area, il boss dell'area 1 (la porta è la casella 0, l'area 1 comincia dalla 1)
  const raw = JSON.parse(await evaluate(`localStorage.getItem('fall-out.save')`));
  const place = { area: 0, offset: boss.index - 1, done: true };
  const version = await run('return balance.SAVE.version;');
  ok(
    raw.version === version && JSON.stringify(raw.profile.road) === JSON.stringify(place),
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
    valid && q.village.positions.forge?.col === 24 && q.village.sites[0]?.building === 'forge',
    `fucina nell'area 1: valida ${valid}, posto ${JSON.stringify(q.village.positions.forge)}`,
  );
  await shot('48-7-fucina-fuori');

  // Il terreno chiude la scheda; il capo, un'altra casella della strada e l'area da conquistare la aprono
  await world(`s.bus.emit('groundTapped'); return 0;`);
  await pause(300);
  await tapPawn();
  const byPawn = (await sheetKind()) === 'road';
  await world(`s.bus.emit('groundTapped'); return 0;`);
  await pause(300);
  const [rx, ry] = await screenOf(
    `(await (async () => { const { toWorld } = await import(url('/src/view/iso.js')); return toWorld(21.5, 19.5); })())`,
  );
  await gameTap(rx, ry);
  const byRoad = (await sheetKind()) === 'road';
  // Un punto che si vede tra le risorse e l'obiettivo, lontano dalla strada, senza edifici né capo: nell'area da
  // conquistare (inArea) o fuori
  const spot = (inArea) =>
    run(`const { worldToScreen } = await import(url('/src/view/worldCamera.js'));
    const { toWorld } = await import(url('/src/view/iso.js'));
    const { roadTileAt, conqueredAreas } = await import(url('/src/meta/road.js'));
    const { conquestAreaOf } = await import(url('/src/meta/world.js'));
    const s = window.__game.scene.getScene('World');
    const current = conqueredAreas(window.__game.registry.get('save').profile.road);
    for (let row = 10; row < 28; row++) for (let col = 10; col < 28; col++) {
      const at = toWorld(col + 0.5, row + 0.5);
      const p = worldToScreen(s.cameras.main, at.x, at.y);
      const near = [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => roadTileAt(col + a, row + b) !== null));
      if (p.y > 180 && p.y < 1020 && p.x > 60 && p.x < 660 && !near && s.buildingAt(at) === null &&
        !s.road.pawn.getBounds().contains(at.x, at.y) && (conquestAreaOf({ col, row }) === current) === ${inArea}) return [p.x, p.y];
    }
    return null;`);
  await world(`s.bus.emit('groundTapped'); return 0;`);
  await pause(300);
  await world(`s.focusPawn(true); return 0;`);
  await pause(600);
  const areaSpot = await spot(true);
  if (areaSpot !== null) await gameTap(...areaSpot);
  const byArea = (await sheetKind()) === 'road';
  const groundSpot = await spot(false);
  if (groundSpot !== null) await gameTap(...groundSpot);
  const closed = (await sheetKind()) === null;
  ok(
    byPawn && byRoad && byArea && closed,
    `scheda: dal capo ${byPawn}, da un'altra casella ${byRoad}, dall'area da conquistare ${byArea} (${areaSpot?.map(Math.round)}), chiusa dal terreno ${closed} (${groundSpot?.map(Math.round)})`,
  );

  // Senza razioni la battaglia non apre lo schieramento: si apre la scheda, che dice quante ne mancano e quando
  const nextBattle = await run(
    `const { ROAD_TILES } = await import(url('/src/meta/road.js')); return ROAD_TILES.find((t) => t.area === 1 && t.kind === 'battle');`,
  );
  await save({
    road: { at: nextBattle.index - 1, done: true },
    resources: { rations: 0 },
    village: { levels: { farm: 1 }, positions: { farm: { col: 16, row: 16 } }, farm: { stored: 0, since: Date.now() } },
  });
  await reopen();
  await tapRoadButton();
  await tapTile(nextBattle.index);
  await pause(600);
  const poorLineup = await active('Lineup');
  sheet = await texts('WorldUI');
  const poorAt = (await profile()).road.at;
  const line = sheet.find((t) => t.startsWith('Razioni')) ?? '-';
  ok(
    !poorLineup &&
      (await sheetKind()) === 'road' &&
      poorAt === nextBattle.index - 1 &&
      line.includes('ne servono 1') &&
      line.includes('la prossima tra') &&
      !sheet.includes('Raccogli'),
    `senza razioni: schieramento ${poorLineup}, resta su ${poorAt}; ${line}`,
  );
  await shot('48-8-senza-razioni');

  // Razioni che mancano ma pronte alla fattoria: la scheda offre Raccogli, poi la battaglia apre lo schieramento
  await save({
    road: { at: nextBattle.index - 1, done: true },
    resources: { rations: 0 },
    village: { levels: { farm: 1 }, positions: { farm: { col: 16, row: 16 } }, farm: { stored: 5, since: Date.now() } },
  });
  await reopen();
  await tapRoadButton();
  await tapTile(nextBattle.index);
  await pause(400);
  const offer = (await texts('WorldUI')).includes('Raccogli');
  await tapSheet('main');
  await pause(400);
  q = await profile();
  const afterCollect = await texts('WorldUI');
  await tapSheet('close');
  await tapRoadButton();
  await tapTile(nextBattle.index);
  const fedLineup = await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  ok(
    offer && q.resources.rations === 5 && afterCollect.includes(HUD.world.road.hint) && fedLineup,
    `Raccogli: offerto ${offer}, razioni ${q.resources.rations}, poi «${afterCollect.find((t) => t.startsWith('Tocca')) ?? '-'}» e lo schieramento ${fedLineup}`,
  );

  // Lasciare a metà una battaglia della strada riporta al capo, sulla battaglia da vincere, senza pagare di nuovo
  await save({ road: { at: nextBattle.index, done: false }, resources: { rations: 5 } });
  await reopen();
  await tapRoadButton();
  await tapPawn();
  await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  await tapStart();
  await until(
    'window.__battle !== undefined && window.__battle.ms > 800 && window.__game.scene.isActive("Battle")',
    30,
  );
  await evaluate(`window.__game.scene.getScene('BattleUI').openMenu('pause'); 0`);
  await pause(500);
  await evaluate(`window.__game.scene.getScene('PauseMenu').leave(); 0`);
  await until(`window.__game.scene.isActive('World') === true`, 10);
  await pause(400);
  q = await profile();
  const leftLit = await flashed();
  ok(
    !q.road.done && q.road.at === nextBattle.index && q.resources.rations === 5 && leftLit === nextBattle.index &&
      (await sheetKind()) === null,
    `lasciata a metà: casella ${q.road.at}, fatta ${q.road.done}, razioni ${q.resources.rations}, si accende la casella ${leftLit}`,
  );

  // L'ultimo boss da rifare: si accende lui, toccando il capo si apre il suo schieramento, la scheda dice dove si è,
  // senza errori
  const errorsBefore = game.errors.length;
  await save({ road: { at: 309, done: false }, resources: { rations: 5 } });
  await reopen();
  await tapRoadButton();
  const lastLit = await flashed();
  await tapPawn();
  const lastLineup = await until(`window.__game.scene.isActive('Lineup') === true`, 6);
  const lastTitle = lastLineup ? (await texts('Lineup'))[0] : '-';
  await gameTap(lineupLayout.backButton.x, lineupLayout.backButton.y);
  await until(`window.__game.scene.isActive('World') === true`, 6);
  await pause(300);
  await world(`s.bus.emit('roadTapped'); return 0;`);
  await pause(300);
  sheet = await texts('WorldUI');
  ok(
    lastLit === 309 && lastLineup && lastTitle === 'Boss' && sheet.some((t) => t.startsWith('Qui: boss')) &&
      game.errors.length === errorsBefore,
    `ultimo boss: acceso ${lastLit}, schieramento «${lastTitle}», ${sheet.find((t) => t.startsWith('Qui')) ?? '-'}, errori nuovi ${game.errors.length - errorsBefore}`,
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
