// Prova nel browser del B8, i trucchi di prova nel pannello di sviluppo: il pannello si apre dall'ingranaggio del mondo
// e la prima cartella è quella dei trucchi; da lì si aggiungono risorse, si finisce un cantiere, si fa passare il tempo
// (cantiere finito e fattoria piena), si conquistano aree (il mondo riparte con la nebbia giusta e la stessa vista), si
// va su una casella, si vince una battaglia con il menu aperto e se ne perde un'altra (finiscono come quelle vere, con
// il riepilogo e il profilo), si sbloccano gli eroi e se ne cambiano livello e stelle (la schermata degli eroi
// riparte); il salvataggio si copia, uno incollato non valido si rifiuta e uno valido entra ricaricando la pagina, con
// quello di prima nella copia di riserva; con un salvataggio di una versione più nuova i trucchi non fanno niente e lo
// dicono. Foto della cartella e della scheda del salvataggio; errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('b8');
const { send, evaluate, shot, run, hook, tap } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
const profile = async () => JSON.parse(await evaluate(`JSON.stringify(window.__game.registry.get('save').profile)`));
const storedProfile = async () => JSON.parse(await evaluate(`localStorage.getItem('fall-out.save')`)).profile;
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
// Un tocco sul gioco: il pannello aperto copre la destra dello schermo, e prima si riduce alla sua barra del titolo
// (poi si riapre)
const gameTap = async (x, y) => {
  const folded = await expandPane(false);
  await tap(...(await page(x, y)));
  await pause(400);
  if (folded) await expandPane(true);
};
// Le scritte della scena name, con dove stanno sullo schermo del gioco (anche quelle dentro un contenitore)
const labels = (name) =>
  evaluate(`(() => {
  const all = (list, dx, dy) => list.flatMap((o) => (o.type === 'Container' ? all(o.list, dx + o.x, dy + o.y) : [[o, dx, dy]]));
  return all(window.__game.scene.getScene('${name}').children.list, 0, 0)
    .filter(([o]) => o.type === 'Text').map(([t, dx, dy]) => ({ text: t.text, x: t.x + dx, y: t.y + dy }));
})()`);
const texts = async (name) => (await labels(name)).map((label) => label.text);
const tapLabel = async (text, x = null) => {
  const label = (await labels('PauseMenu')).find((one) => one.text === text);
  if (!label) throw new Error(`nel menu non c'è «${text}»`);
  await gameTap(x ?? label.x + 10, label.y);
};
// Un elemento della pagina (selector) con la scritta text, toccato dove sta: i pulsanti e le cartelle del pannello,
// i pulsanti della scheda del salvataggio
const tapElement = async (selector, text) => {
  const at = await evaluate(`(() => {
    const el = [...document.querySelectorAll('${selector}')].find((e) => e.textContent.trim() === ${JSON.stringify(text)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  })()`);
  if (!at) throw new Error(`nella pagina non c'è «${text}»`);
  await tap(...at);
  await pause(500);
};
const paneButton = (title) => tapElement('.tp-btnv_b', title);
// Il pannello, se si vede, si apre (expanded) o si riduce toccando la sua barra del titolo; dice se è cambiato
const expandPane = async (expanded) => {
  const now = await evaluate(`(() => {
    const el = document.querySelector('.tp-rotv');
    return !el || getComputedStyle(el).display === 'none' ? null : el.classList.contains('tp-rotv-expanded');
  })()`);
  if (now === null || now === expanded) return false;
  const title = await evaluate(`document.querySelector('.tp-rotv_b').textContent.trim()`);
  await tapElement('.tp-rotv_b', title);
  return true;
};
// Il campo del pannello con l'etichetta label: un numero scritto nella sua casella, o la voce con quella scritta
const setField = (label, value) =>
  evaluate(`(() => {
  const row = [...document.querySelectorAll('.tp-lblv')].find((e) => e.querySelector('.tp-lblv_l')?.textContent.trim() === ${JSON.stringify(label)});
  const select = row.querySelector('select');
  if (select) select.selectedIndex = [...select.options].findIndex((o) => o.textContent.trim() === ${JSON.stringify(String(value))});
  const input = select ?? row.querySelector('input.tp-txtv_i');
  if (!select) input.value = ${JSON.stringify(String(value))};
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 0;
})()`);
// L'esito dell'ultimo trucco, come lo scrive il pannello
const noteOf = (label) =>
  evaluate(`(() => {
  const row = [...document.querySelectorAll('.tp-lblv')].find((e) => e.querySelector('.tp-lblv_l')?.textContent.trim() === ${JSON.stringify(label)});
  return row.querySelector('input').value;
})()`);
const paneShown = () =>
  evaluate(`(() => { const el = document.querySelector('.tp-rotv'); return !!el && getComputedStyle(el).display !== 'none'; })()`);
// Le aree nella nebbia, disegnate dal mondo quando si apre
const fogged = () =>
  run(`const s = window.__game.scene.getScene('World');
  return s.children.list.filter((o) => o.type === 'Graphics' && o.depth === balance.WORLD_VIEW.depth.fog).length;`);
const camera = () =>
  evaluate(
    `(() => { const c = window.__game.scene.getScene('World').cameras.main; return { zoom: c.zoom, x: Math.round(c.scrollX), y: Math.round(c.scrollY) }; })()`,
  );
const recordMeta = () =>
  run(`const { META_EVENTS } = await import(url('/src/core/events.js'));
  window.__meta = [];
  for (const name of Object.values(META_EVENTS)) {
    window.__game.events.on(name, (data) => window.__meta.push(data?.action ? name + ':' + data.action : name));
  }
  return 0;`);
const metaEvents = () => evaluate(`window.__meta.splice(0)`);
const reopen = async () => {
  await send('Page.reload');
  await pause(3000);
  await hook();
  await until(`window.__game?.scene.isActive('WorldUI') === true`, 10);
  await pause(500);
};
// Un edificio messo con l'azione del gioco nel primo posto libero vicino al centro del villaggio: il cantiere si apre
const place = (id) =>
  run(`const { freeSpot } = await import(url('/src/meta/village.js'));
  const p = window.__game.registry.get('save').profile;
  return window.__game.registry.get('actions').placeBuilding('${id}', freeSpot(p.village.positions, '${id}', 0));`);
// La battaglia della casella tile, dal mondo allo schieramento a Parti
const fight = async (tile, HUD) => {
  await evaluate(`(() => { window.__game.scene.getScene('World').navigate('Lineup', { mode: 'road', tile: ${tile} }); return 0; })()`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  await pause(300);
  await gameTap(HUD.lineup.startButton.x, HUD.lineup.startButton.y);
  await until(`window.__game.scene.isActive('BattleUI') === true`, 5);
  await pause(1000);
};
const battleState = () =>
  evaluate(`(() => {
  const s = window.__game.scene.getScene('Battle');
  const { over, mission, army } = s.battle;
  return { over, completed: mission.completed, failed: mission.failed, leaderHp: army.leader.hp, paused: s.paused };
})()`);

try {
  await game.open('e2eb8');
  await evaluate(`localStorage.clear(); 0`);
  await reopen();
  const HUD = await run('return balance.HUD;');
  const META = await run('return balance.DEBUG.meta;');
  const L = META.labels;
  const T = await run('return balance.DEBUG.saveTransfer.labels;');
  const menuLabels = HUD.menu.labels;
  const tiles = await run(`const { ROAD_TILES } = await import(url('/src/meta/road.js'));
    return ROAD_TILES.map((t) => ({ index: t.index, area: t.area, kind: t.kind }));`);
  await recordMeta();

  // Il pannello si apre dall'ingranaggio del mondo (Sviluppo) e resta aperto chiudendo il menu; la sua prima cartella
  // è quella dei trucchi
  await gameTap(HUD.settingsGear.x, HUD.settingsGear.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  await tapLabel(menuLabels.dev);
  await tapLabel(menuLabels.close);
  await until(`window.__game.scene.isActive('PauseMenu') === false`, 3);
  const firstFolder = await evaluate(`document.querySelector('.tp-rotv_c > .tp-fldv .tp-fldv_t')?.textContent.trim()`);
  await tapElement('.tp-fldv_b', META.title);
  await shot('b8-1-trucchi');
  ok(
    (await paneShown()) && firstFolder === META.title && (await active('World')),
    `pannello aperto ${await paneShown()} sopra il mondo, prima cartella «${firstFolder}»`,
  );

  // Risorse in più per tutte: in memoria, sul telefono e scritte nel mondo
  const start = await profile();
  await setField(L.amount, 500);
  await paneButton(L.addResources);
  await pause(300);
  const richer = await profile();
  const onPhone = await storedProfile();
  const added = Object.keys(start.resources).every((kind) => richer.resources[kind] === start.resources[kind] + 500);
  const worldTexts = await texts('WorldUI');
  const note = await noteOf(L.note);
  ok(
    added &&
      JSON.stringify(onPhone.resources) === JSON.stringify(richer.resources) &&
      worldTexts.some((text) => text.startsWith(`${start.resources.rations + 500} razioni`)) &&
      note === L.done,
    `+500 risorse: ${JSON.stringify(start.resources)} → ${JSON.stringify(richer.resources)}, sul telefono uguali, nel mondo «${worldTexts.find((text) => text.includes('razioni'))}», esito «${note}»`,
  );

  // Un cantiere aperto finisce subito; senza cantiere il pannello lo dice
  const placed = await place('farm');
  const timerBefore = await evaluate(`window.__game.scene.getScene('World').timer !== null`);
  await metaEvents();
  await paneButton(L.finishBuild);
  const built = await profile();
  const timerAfter = await evaluate(`window.__game.scene.getScene('World').timer === null`);
  const finishedNote = await noteOf(L.note);
  await paneButton(L.finishBuild);
  const idleNote = await noteOf(L.note);
  const farmLevel = (await storedProfile()).village.levels.farm;
  ok(
    placed &&
      timerBefore &&
      built.village.levels.farm === 1 &&
      built.village.construction === null &&
      farmLevel === 1 &&
      timerAfter &&
      finishedNote === L.done &&
      idleNote === L.noBuild,
    `fattoria messa ${placed} con il tempo scritto ${timerBefore}: finita, livello ${built.village.levels.farm} (sul telefono ${farmLevel}), cantiere ${JSON.stringify(built.village.construction)}, tempo sparito ${timerAfter}, esito «${finishedNote}»; di nuovo «${idleNote}»`,
  );

  // Un'ora che passa: la caserma finisce e la fattoria si riempie, e il mondo mostra le razioni pronte
  const barracks = await place('barracks');
  await setField(L.skip, META.skipOptions[1].label);
  await paneButton(L.skipTime);
  const later = await profile();
  const bubble = (await texts('World')).find((text) => text.startsWith('+'));
  const full = await run(`const { VILLAGE } = await import(url('/src/data/village.js'));
    return VILLAGE.buildings.farm.storage[0];`);
  ok(
    barracks &&
      later.village.levels.barracks === 1 &&
      later.village.construction === null &&
      later.village.farm.stored === full &&
      bubble === `+${full}`,
    `${META.skipOptions[1].label} passata: caserma messa ${barracks} e ora al livello ${later.village.levels.barracks}, fattoria con ${later.village.farm.stored} razioni pronte su ${full}, nel mondo «${bubble}»`,
  );

  // Tre aree conquistate: il mondo riparte con la nebbia di adesso e la stessa vista
  const fogBefore = await fogged();
  const viewBefore = await camera();
  await paneButton(L.addResources);
  await setField(L.areas, 3);
  await paneButton(L.jumpToArea);
  await until(`window.__game?.scene.isActive('WorldUI') === true`, 5);
  await pause(400);
  const conquered = await profile();
  const lastOfThird = tiles.findLast((tile) => tile.area === 2);
  const fogAfter = await fogged();
  const viewAfter = await camera();
  await shot('b8-2-aree');
  ok(
    conquered.road.at === lastOfThird.index &&
      conquered.road.done &&
      fogBefore === 24 &&
      fogAfter === 21 &&
      JSON.stringify(viewBefore) === JSON.stringify(viewAfter),
    `3 aree conquistate: casella ${conquered.road.at} (${lastOfThird.kind} dell'area 3) fatta ${conquered.road.done}, aree nella nebbia ${fogBefore} → ${fogAfter}, vista ${JSON.stringify(viewBefore)} → ${JSON.stringify(viewAfter)}`,
  );

  // Una casella da combattere, e la battaglia vinta dal pannello con il menu aperto sopra: finisce come una vera
  const [first, second] = tiles.filter((tile) => tile.area === 3 && tile.kind === 'battle');
  await setField(L.tile, first.index);
  await paneButton(L.jumpToTile);
  const jumped = (await profile()).road;
  await fight(first.index, HUD);
  await gameTap(HUD.buttons.settings.x, HUD.buttons.settings.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  const pausedBefore = await evaluate(`window.__game.scene.getScene('Battle').paused`);
  await metaEvents();
  await paneButton(L.win);
  const summary = await until(`window.__game.scene.isActive('Summary') === true`, 5);
  await pause(400);
  const won = await battleState();
  const afterWin = await profile();
  const winEvents = await metaEvents();
  const summaryTexts = await texts('Summary');
  await shot('b8-3-vinta');
  ok(
    jumped.at === first.index &&
      !jumped.done &&
      pausedBefore === true &&
      summary &&
      !(await active('PauseMenu')) &&
      won.completed &&
      !won.paused &&
      afterWin.road.done &&
      afterWin.stats.won === 1 &&
      winEvents.includes('battleRecorded') &&
      summaryTexts.includes(HUD.gameOver.completedTitle),
    `casella ${jumped.at} da vincere ${!jumped.done}; vinta dal pannello con il menu aperto (battaglia ferma ${pausedBefore}): riepilogo ${summary} «${summaryTexts[0]}», menu chiuso ${!(await active('PauseMenu'))}, compiuta ${won.completed}, casella fatta ${afterWin.road.done}, vinte ${afterWin.stats.won}, eventi ${winEvents.join(', ')}`,
  );

  // Dal riepilogo al mondo, e un'altra battaglia persa dal pannello: muore il capo
  await pause(HUD.gameOver.tapDelayMs + 300);
  await gameTap(360, 900);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);
  await setField(L.tile, second.index);
  await paneButton(L.jumpToTile);
  await fight(second.index, HUD);
  await paneButton(L.lose);
  const lostSummary = await until(`window.__game.scene.isActive('Summary') === true`, 5);
  await pause(400);
  const lost = await battleState();
  const afterLoss = await profile();
  const lossTexts = await texts('Summary');
  const lossNote = await noteOf(L.note);
  await paneButton(L.win);
  const lateNote = await noteOf(L.note);
  ok(
    lostSummary &&
      lost.failed &&
      lost.leaderHp === 0 &&
      afterLoss.stats.played === 2 &&
      afterLoss.stats.won === 1 &&
      !afterLoss.road.done &&
      lossTexts.includes(HUD.gameOver.failedTitle) &&
      lossNote === L.done &&
      lateNote === L.noBattle,
    `persa dal pannello: riepilogo ${lostSummary} «${lossTexts[0]}», capo a ${lost.leaderHp}, giocate ${afterLoss.stats.played} vinte ${afterLoss.stats.won}, casella ancora da vincere ${!afterLoss.road.done}; a battaglia finita «${lateNote}»`,
  );
  await pause(HUD.gameOver.tapDelayMs + 300);
  await gameTap(360, 900);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);

  // Eroi: tutti sbloccati, e l'esploratore al livello 12 con 4 stelle; la schermata degli eroi riparte
  await gameTap(HUD.world.heroesButton.x, HUD.world.heroesButton.y);
  await until(`window.__game.scene.isActive('Heroes') === true`, 5);
  await pause(300);
  const lockedBefore = (await texts('Heroes')).filter((text) => text.includes(HUD.heroes.labels.locked)).length;
  await paneButton(L.unlockHeroes);
  await setField(L.hero, 'Esploratore');
  await setField(L.level, 12);
  await setField(L.stars, 4);
  await paneButton(L.setHero);
  await pause(300);
  const heroes = (await profile()).heroes;
  const heroTexts = await texts('Heroes');
  const lockedAfter = heroTexts.filter((text) => text.includes(HUD.heroes.labels.locked)).length;
  const scoutLine = heroTexts.find((text) => text.startsWith(`${HUD.heroes.labels.level} 12 `));
  await shot('b8-4-eroi');
  ok(
    lockedBefore > 0 &&
      lockedAfter === 0 &&
      Object.values(heroes).every((record) => record.owned) &&
      heroes.scout.stars === 4 &&
      scoutLine !== undefined &&
      (await active('Heroes')),
    `eroi: da reclutare ${lockedBefore} → ${lockedAfter}, tutti posseduti ${Object.values(heroes).every((record) => record.owned)}; esploratore ${heroes.scout.xp} di esperienza e ${heroes.scout.stars} stelle, nella schermata «${scoutLine}»`,
  );
  await gameTap(HUD.heroes.back.x, HUD.heroes.back.y);
  await until(`window.__game.scene.isActive('WorldUI') === true`, 5);
  await pause(300);

  // Il salvataggio si copia com'è in memoria
  await paneButton(L.exportSave);
  const exported = await evaluate(`document.querySelector('textarea')?.value ?? null`);
  const now = await profile();
  const copied = JSON.parse(exported);
  await shot('b8-5-copia');
  await tapElement('button', T.close);
  const hidden = await evaluate(`document.querySelector('textarea') === null`);
  ok(
    copied.profile.resources.materials === now.resources.materials &&
      JSON.stringify(copied.profile.heroes) === JSON.stringify(now.heroes) &&
      hidden,
    `copiato: versione ${copied.version}, materiali ${copied.profile.resources.materials} come in memoria, eroi uguali; scheda chiusa ${hidden}`,
  );

  // Incollato: un testo che non è un salvataggio si rifiuta, uno buono entra ricaricando la pagina, e quello di prima
  // resta nella copia di riserva
  await evaluate(`window.__marker = 1; 0`);
  const writeBox = (value) =>
    evaluate(`(() => { document.querySelector('textarea').value = ${JSON.stringify(value)}; return 0; })()`);
  await paneButton(L.importSave);
  await shot('b8-6-incolla');
  await writeBox('ciao');
  await tapElement('button', T.load);
  const refusal = await evaluate(`[...document.querySelectorAll('div')].some((d) => d.textContent === ${JSON.stringify(T.invalid)})`);
  const notReloaded = await evaluate(`window.__marker === 1`);
  const before = await evaluate(`localStorage.getItem('fall-out.save')`);
  copied.profile.resources.materials = 4242;
  await writeBox(JSON.stringify(copied));
  await tapElement('button', T.load);
  await pause(3000);
  await hook();
  await until(`window.__game?.scene.isActive('WorldUI') === true`, 10);
  await pause(500);
  const reloaded = await evaluate(`window.__marker === undefined`);
  const imported = await profile();
  const backup = await evaluate(`localStorage.getItem('fall-out.save.bak')`);
  ok(
    refusal &&
      notReloaded &&
      reloaded &&
      imported.resources.materials === 4242 &&
      backup === before &&
      (await texts('WorldUI')).some((text) => text.includes('4242')),
    `incollato: «ciao» rifiutato ${refusal} senza ricaricare ${notReloaded}; quello buono ricarica ${reloaded}, materiali ${imported.resources.materials}, quello di prima nella copia di riserva ${backup === before}`,
  );

  // Un salvataggio di una versione più nuova: i trucchi non fanno niente e il pannello lo dice
  const newer = JSON.stringify({ version: 99, profile: { resources: { materials: 7, rations: 3 } } });
  await evaluate(`localStorage.setItem('fall-out.save', ${JSON.stringify(newer)}); 0`);
  await reopen();
  await evaluate(`window.__game.registry.get('devTools').toggle(); 0`);
  await tapElement('.tp-fldv_b', META.title);
  await pause(400);
  const readOnlyNote = await noteOf(L.note);
  const lockedResources = (await profile()).resources;
  await paneButton(L.addResources);
  const untouched = (await profile()).resources;
  const kept = (await evaluate(`localStorage.getItem('fall-out.save')`)) === newer;
  ok(
    readOnlyNote === L.readOnly && JSON.stringify(untouched) === JSON.stringify(lockedResources) && kept,
    `salvataggio più nuovo: esito «${readOnlyNote}», risorse ferme ${JSON.stringify(untouched) === JSON.stringify(lockedResources)}, sul telefono com'era ${kept}`,
  );
  await evaluate(`localStorage.clear(); 0`);
} finally {
  await game.close();
}
