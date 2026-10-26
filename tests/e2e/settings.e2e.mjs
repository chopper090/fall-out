// Prova nel browser del B7, le impostazioni fuori dalla battaglia: le risorse del mondo restano lontane dal suo
// ingranaggio (anche con numeri grandi); l'ingranaggio apre le impostazioni sopra il mondo fermo (i tocchi non gli
// arrivano, la battaglia non c'è), una voce si cambia e si salva, Sviluppo apre e chiude il pannello di sviluppo,
// Cancella salvataggio chiede conferma (No non tocca niente) e con Sì il mondo riparte da capo sotto il menu (profilo
// di partenza, nebbia su tutte le aree, vista sul villaggio), le impostazioni restano; Chiudi torna al mondo, che
// risponde. L'ingranaggio degli eroi e dello schieramento apre le stesse impostazioni, Chiudi lascia dove si era e
// cancellando si torna al mondo da capo. In battaglia pausa e ingranaggio fanno come prima. Foto delle schermate con
// l'ingranaggio; errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('b7');
const { send, evaluate, shot, run } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
const profile = async () => JSON.parse(await evaluate(`JSON.stringify(window.__game.registry.get('save').profile)`));
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
  await pause(400);
};
// Le scritte della scena name, con dove stanno sullo schermo del gioco (anche quelle dentro un contenitore)
const labels = (name) =>
  evaluate(`(() => {
  const all = (list, dx, dy) => list.flatMap((o) => (o.type === 'Container' ? all(o.list, dx + o.x, dy + o.y) : [[o, dx, dy]]));
  return all(window.__game.scene.getScene('${name}').children.list, 0, 0)
    .filter(([o]) => o.type === 'Text').map(([t, dx, dy]) => ({ text: t.text, x: t.x + dx, y: t.y + dy, width: t.displayWidth }));
})()`);
const texts = async (name) => (await labels(name)).map((label) => label.text);
// Tocca la scritta text del menu (un pulsante, o la riga di una voce: la sua scritta sta a sinistra), o il suo
// pulsante all'altezza x
const tapLabel = async (text, x = null) => {
  const label = (await labels('PauseMenu')).find((one) => one.text === text);
  if (!label) throw new Error(`nel menu non c'è «${text}»`);
  await gameTap(x ?? label.x + 10, label.y);
};
// Il pannello di sviluppo (Tweakpane) si vede
const paneShown = () =>
  evaluate(`(() => { const el = document.querySelector('.tp-rotv'); return !!el && getComputedStyle(el).display !== 'none'; })()`);
// Le aree nella nebbia, disegnate dal mondo quando si apre
const fogged = () =>
  run(`const s = window.__game.scene.getScene('World');
  return s.children.list.filter((o) => o.type === 'Graphics' && o.depth === balance.WORLD_VIEW.depth.fog).length;`);
const camera = () =>
  evaluate(
    `(() => { const c = window.__game.scene.getScene('World').cameras.main; return { zoom: c.zoom, x: c.scrollX, y: c.scrollY }; })()`,
  );
// La vista di partenza: sul villaggio, allo zoom di partenza
const startView = () =>
  run(`const { zoomLimits, viewCenter } = await import(url('/src/view/worldCamera.js'));
  const { villageRect } = await import(url('/src/meta/world.js'));
  const { rectCenter } = await import(url('/src/view/iso.js'));
  const cam = window.__game.scene.getScene('World').cameras.main;
  const center = viewCenter(cam);
  const village = rectCenter(villageRect());
  return { zoom: Math.abs(cam.zoom - zoomLimits(cam).start) < 1e-6, centered: Math.hypot(center.x - village.x, center.y - village.y) < 1 };`);
// Il profilo è quello di partenza, in memoria e sul telefono (la fattoria vuota: il tempo da cui produce è adesso)
const fresh = () =>
  run(`const { createProfile, storedProfile } = await import(url('/src/meta/profile.js'));
  const start = createProfile();
  const same = (p, q) => p.village.farm.stored === 0 && JSON.stringify({ ...p, village: { ...p.village, farm: null } }) === JSON.stringify({ ...q, village: { ...q.village, farm: null } });
  const stored = JSON.parse(localStorage.getItem(balance.SAVE.storageKey)).profile;
  return same(window.__game.registry.get('save').profile, start) && same(stored, storedProfile(start));`);
// Quello che il giocatore ha fatto: strada, risorse, edifici (non le razioni che la fattoria produce col tempo)
const progress = ({ road, resources, village }) => JSON.stringify([road, resources, village.levels, village.positions]);
// Un cambio a mano del profilo (p), scritto anche sul telefono
const edit = (body) =>
  run(`const { writeSave } = await import(url('/src/core/save.js'));
  const save = window.__game.registry.get('save');
  const p = save.profile;
  ${body};
  writeSave(save);
  return 0;`);
const recordMeta = () =>
  run(`const { META_EVENTS } = await import(url('/src/core/events.js'));
  window.__meta = [];
  for (const name of Object.values(META_EVENTS)) {
    window.__game.events.on(name, (data) => window.__meta.push(data?.action ? name + ':' + data.action : name));
  }
  return 0;`);
const metaEvents = () => evaluate(`window.__meta.splice(0)`);
const reopen = async () => {
  await game.reload();
  await pause(500);
};
// Tutto il salvataggio cancellato da qui, con conferma: Cancella salvataggio, poi Sì
const clearFromMenu = async () => {
  await tapLabel('Cancella salvataggio');
  await tapLabel('Sì, cancella');
  await pause(600);
};

try {
  await game.open('e2eb7');
  await evaluate(`localStorage.clear(); 0`);
  await reopen();
  const gear = await run('return balance.HUD.settingsGear;');
  const HUD = await run('return balance.HUD;');
  const menuLabels = HUD.menu.labels;

  // Un mondo con l'area 1 conquistata, risorse ed edifici, e la vista lasciata altrove (andando agli eroi e tornando)
  await edit(`const { ROAD_TILES } = await import(url('/src/meta/road.js'));
    const { freeSpot } = await import(url('/src/meta/village.js'));
    p.road = { at: ROAD_TILES.find((t) => t.kind === 'boss' && t.area === 0).index, done: true };
    p.resources.wood = 345; p.resources.rations = 67;
    p.village.levels.farm = 1;
    p.village.positions.farm = freeSpot(p.village.positions, 'farm', 1)`);
  await reopen();
  await run(`const { panBy } = await import(url('/src/view/worldCamera.js'));
    const cam = window.__game.scene.getScene('World').cameras.main;
    cam.setZoom(cam.zoom * 0.8);
    panBy(cam, 300, 200);
    return 0;`);
  await gameTap(HUD.world.heroesButton.x, HUD.world.heroesButton.y);
  await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  await gameTap(HUD.heroes.back.x, HUD.heroes.back.y);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(500);
  await recordMeta();
  const before = { fog: await fogged(), view: await startView(), profile: await profile() };

  // Le due righe delle risorse restano lontane dall'ingranaggio, anche con numeri grandi (si stringono)
  const gearRight = gear.x + HUD.buttons.radius;
  const clear = (lines) =>
    lines.length === 2 && lines.every((l) => l.x - l.width / 2 >= gearRight + gear.textGap - 0.5);
  const resourceLines = async () => (await labels('WorldUI')).filter((label) => label.y < HUD.world.top.height);
  const described = (lines) =>
    lines.map((l) => `«${l.text}» da ${Math.round(l.x - l.width / 2)} a ${Math.round(l.x + l.width / 2)}`).join(', ');
  const lines = await resourceLines();
  await shot('b7-1-mondo');
  const resources = before.profile.resources;
  await edit(`Object.assign(p.resources, { rations: 99999, wood: 999999, stone: 999999, gears: 99999, circuits: 9999, dogTags: 99999, accelerators: 9999 });
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await pause(300);
  const wide = await resourceLines();
  await shot('b7-1b-numeri-grandi');
  await edit(`Object.assign(p.resources, ${JSON.stringify(resources)});
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await metaEvents();
  ok(
    clear(lines) && clear(wide),
    `risorse lontane dall'ingranaggio (bordo a ${gearRight}): ${described(lines)}; con numeri grandi ${described(wide)}`,
  );

  // L'ingranaggio apre le impostazioni sopra il mondo, senza battaglia
  await gameTap(gear.x, gear.y);
  const opened = await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  const menu = await texts('PauseMenu');
  const devTools = await evaluate(`!!window.__game.registry.get('devTools')`);
  ok(
    opened &&
      !(await active('Battle')) &&
      [menuLabels.settingsTitle, menuLabels.clearSave, menuLabels.dev, menuLabels.close].every((t) =>
        menu.includes(t),
      ) &&
      !menu.includes(menuLabels.resume) &&
      devTools,
    `ingranaggio del mondo: impostazioni aperte ${opened}, battaglia ${await active('Battle')}, voci ${menu.join(' | ')}`,
  );
  await shot('b7-2-impostazioni');

  // Sotto il menu il mondo non riceve tocchi: Strada non porta dal capo, la vista non si muove
  const view0 = await camera();
  await gameTap(HUD.world.roadButton.x, HUD.world.roadButton.y);
  // Il trascinamento passa a lato del riquadro del menu, dove non ci sono pulsanti
  await mouse('mousePressed', 20, 300);
  for (let i = 1; i <= 6; i++) await mouse('mouseMoved', 20, 300 + i * 60);
  await mouse('mouseReleased', 20, 660, 0);
  await pause(300);
  const view1 = await camera();
  const sheet = await evaluate(`window.__game.scene.getScene('WorldUI').sheet`);
  ok(
    sheet === null && view1.x === view0.x && view1.y === view0.y && (await active('PauseMenu')),
    `sotto il menu: scheda ${JSON.stringify(sheet)}, vista da ${Math.round(view0.x)},${Math.round(view0.y)} a ${Math.round(view1.x)},${Math.round(view1.y)}`,
  );

  // Una voce si cambia e si salva sul telefono, e si rimette com'era
  const damageLabel = (await run(`return balance.SETTINGS.entries.find((e) => e.id === 'damageNumbers').label;`));
  const shown = () => run('return balance.FX.showDamageNumbers;');
  const savedSetting = () =>
    run(`return JSON.parse(localStorage.getItem(balance.SETTINGS.storageKey))?.values?.damageNumbers ?? null;`);
  const was = await shown();
  await tapLabel(damageLabel);
  const flipped = await shown();
  const savedFlip = await savedSetting();
  await tapLabel(damageLabel);
  ok(
    flipped === !was && savedFlip === flipped && (await shown()) === was && (await savedSetting()) === was,
    `${damageLabel}: ${was} → ${flipped} (salvata ${savedFlip}) → ${await shown()}`,
  );

  // Sviluppo apre e chiude il pannello di sviluppo
  const hiddenAtStart = !(await paneShown());
  await tapLabel(menuLabels.dev);
  const paneOpen = await paneShown();
  await shot('b7-3-sviluppo');
  // Il pannello aperto copre la destra dello schermo: Sviluppo si tocca vicino al suo bordo sinistro
  const { panel } = HUD.menu;
  await tapLabel(menuLabels.dev, (720 - panel.width) / 2 + panel.padding + 20);
  const paneClosed = !(await paneShown());
  ok(hiddenAtStart && paneOpen && paneClosed, `Sviluppo: nascosto ${hiddenAtStart}, aperto ${paneOpen}, richiuso ${paneClosed}`);

  // Cancella salvataggio chiede conferma; No torna alle impostazioni e non tocca niente
  const settingsBefore = await evaluate(`localStorage.getItem('fall-out.settings')`);
  await tapLabel(menuLabels.clearSave);
  const confirm = await texts('PauseMenu');
  await shot('b7-4-conferma');
  await tapLabel(menuLabels.clearNo);
  const back = await texts('PauseMenu');
  const kept = await profile();
  ok(
    confirm.includes(menuLabels.clearTitle) &&
      confirm.includes(menuLabels.clearYes) &&
      back.includes(menuLabels.clearSave) &&
      progress(kept) === progress(before.profile) &&
      !(await metaEvents()).includes('saveCleared'),
    `conferma: «${confirm.find((t) => t === menuLabels.clearTitle)}»; No: di nuovo ${back.includes(menuLabels.clearSave) ? 'le impostazioni' : back.join(' | ')}, profilo intatto ${progress(kept) === progress(before.profile)}`,
  );

  // Sì: il salvataggio riparte da zero e il mondo sotto il menu riparte da capo; le impostazioni restano
  await clearFromMenu();
  const cleared = await metaEvents();
  const after = { fog: await fogged(), view: await startView(), fresh: await fresh() };
  const afterMenu = await texts('PauseMenu');
  const settingsAfter = await evaluate(`localStorage.getItem('fall-out.settings')`);
  const worldTexts = await texts('WorldUI');
  ok(
    cleared.join() === 'saveCleared,profileChanged:clearSave' &&
      after.fresh &&
      (await active('PauseMenu')) &&
      afterMenu.includes(menuLabels.saveCleared) &&
      settingsAfter === settingsBefore,
    `cancellato: eventi ${cleared.join(', ')}, profilo di partenza ${after.fresh}, menu ancora aperto con «${afterMenu.find((t) => t === menuLabels.saveCleared)}», impostazioni rimaste ${settingsAfter === settingsBefore}`,
  );
  ok(
    before.fog === 23 &&
      after.fog === 24 &&
      !before.view.centered &&
      !before.view.zoom &&
      after.view.zoom &&
      after.view.centered &&
      (await active('World')) &&
      worldTexts.some((t) => t.startsWith('12 razioni')),
    `il mondo riparte da capo: aree nella nebbia ${before.fog} → ${after.fog}, vista sul villaggio ${before.view.centered} → ${after.view.centered} (zoom di partenza ${after.view.zoom}), risorse «${worldTexts.find((t) => t.includes('razioni'))}»`,
  );
  await shot('b7-5-cancellato');

  // Chiudi: si torna al mondo, che risponde (Costruisci apre il suo menu)
  await tapLabel(menuLabels.close);
  const closed = await until(`window.__game.scene.isActive('PauseMenu') === false`, 3);
  await gameTap(HUD.world.buildButton.x, HUD.world.buildButton.y);
  const built = await evaluate(`window.__game.scene.getScene('WorldUI').sheet?.kind ?? null`);
  ok(closed && built === 'menu', `Chiudi: menu chiuso ${closed}, Costruisci apre ${built}`);
  await evaluate(`window.__game.scene.getScene('WorldUI').open(null); 0`);

  // Negli eroi: l'ingranaggio apre le impostazioni, Chiudi lascia negli eroi; cancellando si torna al mondo da capo
  await edit(`p.resources.wood = 999`);
  await gameTap(HUD.world.heroesButton.x, HUD.world.heroesButton.y);
  await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  await pause(300);
  await shot('b7-6-eroi');
  await gameTap(gear.x, gear.y);
  const fromHeroes = await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  await tapLabel(menuLabels.close);
  await pause(300);
  const stayed = (await active('Heroes')) && !(await active('PauseMenu'));
  await gameTap(gear.x, gear.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  await clearFromMenu();
  const heroesCleared = { heroes: await active('Heroes'), world: await active('World'), fresh: await fresh() };
  await tapLabel(menuLabels.close);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  ok(
    fromHeroes && stayed && !heroesCleared.heroes && heroesCleared.world && heroesCleared.fresh,
    `eroi: impostazioni ${fromHeroes}, Chiudi resta negli eroi ${stayed}; cancellato: eroi ${heroesCleared.heroes}, mondo ${heroesCleared.world}, profilo di partenza ${heroesCleared.fresh}`,
  );

  // Nello schieramento di una battaglia della strada: lo stesso; poi la battaglia ha la pausa e l'ingranaggio di prima
  const toLineup = async () => {
    await edit(`const { ROAD_TILES } = await import(url('/src/meta/road.js'));
      p.road = { at: ROAD_TILES.find((t) => t.kind === 'battle').index, done: false }`);
    await evaluate(
      `(() => { const s = window.__game.scene.getScene('World'); s.navigate('Lineup', { mode: 'road', tile: window.__game.registry.get('save').profile.road.at }); return 0; })()`,
    );
    await until(`window.__game.scene.isActive('Lineup') === true`, 5);
    await pause(300);
  };
  await toLineup();
  await shot('b7-7-schieramento');
  await gameTap(gear.x, gear.y);
  const fromLineup = await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  await tapLabel(menuLabels.close);
  await pause(300);
  const stayedLineup = (await active('Lineup')) && !(await active('PauseMenu'));
  await gameTap(gear.x, gear.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  await clearFromMenu();
  const lineupCleared = { lineup: await active('Lineup'), world: await active('World'), fresh: await fresh() };
  await tapLabel(menuLabels.close);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  ok(
    fromLineup && stayedLineup && !lineupCleared.lineup && lineupCleared.world && lineupCleared.fresh,
    `schieramento: impostazioni ${fromLineup}, Chiudi resta nello schieramento ${stayedLineup}; cancellato: schieramento ${lineupCleared.lineup}, mondo ${lineupCleared.world}, profilo di partenza ${lineupCleared.fresh}`,
  );

  // In battaglia: l'ingranaggio in basso ferma la battaglia e apre le impostazioni, Chiudi la fa ripartire; la pausa
  // ha ancora Riprendi
  await toLineup();
  await gameTap(HUD.lineup.startButton.x, HUD.lineup.startButton.y);
  const fighting = await until(`window.__game.scene.isActive('BattleUI') === true`, 5);
  await pause(1000);
  const { settings: battleGear, pause: pauseButton } = HUD.buttons;
  await gameTap(battleGear.x, battleGear.y);
  const battleMenu = await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  const stopped = await evaluate(`window.__game.scene.getScene('Battle').paused`);
  const battleTexts = await texts('PauseMenu');
  await tapLabel(menuLabels.close);
  await pause(300);
  const resumed = await evaluate(`window.__game.scene.getScene('Battle').paused === false`);
  await gameTap(pauseButton.x, pauseButton.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  const pauseTexts = await texts('PauseMenu');
  await tapLabel(menuLabels.resume);
  await pause(300);
  ok(
    fighting &&
      battleMenu &&
      stopped === true &&
      battleTexts.includes(menuLabels.settingsTitle) &&
      resumed &&
      pauseTexts.includes(menuLabels.resume) &&
      pauseTexts.includes(menuLabels.leave) &&
      (await evaluate(`window.__game.scene.getScene('Battle').paused === false`)),
    `battaglia ${fighting}: ingranaggio ferma ${stopped} con ${battleTexts[0]}, Chiudi riparte ${resumed}; pausa: ${pauseTexts.join(' | ')}`,
  );
} finally {
  await game.close();
}
