// Prova end-to-end dell'A6 in Edge headless: la barra a icone del mondo apre il Catalogo; le schede Edifici, Eroi e
// Risorse e i filtri cambiano le voci, con lo stato e i requisiti; Info dalla barra di un edificio apre la sua voce
// in evidenza; Vai su un edificio torna al mondo con la sua barra aperta, su uno da mettere comincia a metterlo, su
// un eroe apre gli eroi, e Indietro torna al Catalogo; Mondo torna al mondo; errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('a6');
const { send, evaluate, shot, run } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
    await sleep(Math.min(250, left));
  }
};
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
const active = (scene) => until(`window.__game.scene.isActive('${scene}') === true`, 5);
const page = (x, y) =>
  evaluate(
    `(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${x} * r.width / 720, r.top + ${y} * r.height / 1280]; })()`,
  );
const gameTap = async (x, y) => {
  const [px, py] = await page(x, y);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: px,
    y: py,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: px,
    y: py,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await pause(400);
};
// Il centro del pulsante della scena name con la scritta label (il primo, o quello numero index), anche dentro la lista
// che scorre (con la lista all'inizio)
const labelAt = (name, label, index = 0) =>
  evaluate(`(() => {
  const all = (list) => list.flatMap((o) => (o.type === 'Container' ? all(o.list) : [o]));
  const found = all(window.__game.scene.getScene('${name}').children.list).filter((o) => o.type === 'Text' && o.text === ${JSON.stringify(label)});
  const t = found[${index}];
  return t ? [t.x, t.y] : null;
})()`);

try {
  console.log('aggancio:', await game.open('e2ea6'));
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await game.reload();
  await pause(500);
  const world = await run('return balance.HUD.world;');
  const catalog = await run('return balance.HUD.catalog;');
  // Un villaggio con la fattoria e la caserma al livello 1 e le scorte per il centro città al 2
  await edit(`const { freeSpot } = await import(url('/src/meta/village.js'));
    for (const id of ['farm', 'barracks']) {
      p.village.levels[id] = 1;
      p.village.positions[id] = freeSpot(p.village.positions, id, 0);
    }
    Object.assign(p.resources, { wood: 200, stone: 200, gears: 50 });
    window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await pause(300);
  const bar = await texts('WorldUI');
  await shot('A6-1-barra');
  await gameTap(world.bar.items.catalog, world.bar.y);
  const opened = await active('Catalog');
  const buildings = await texts('Catalog');
  await shot('A6-2-edifici');
  ok(
    ['Eroi', 'Costruisci', 'Strada', 'Catalogo'].every((label) => bar.includes(label)) &&
      opened &&
      buildings.includes('Centro città · liv. 1') &&
      buildings.includes('Potenziabile') &&
      buildings.includes('Bloccato') &&
      buildings.some((text) => text.startsWith('✓ Fattoria liv. 1')),
    `barra ${bar.filter((t) => t.length < 12).join(' | ')}; Catalogo aperto ${opened}: ${buildings.filter((t) => t.length < 40).join(' | ')}`,
  );

  // Il filtro Potenziabili lascia solo il centro città; Ottenibili solo la fucina
  await gameTap(catalog.filters.xs[3], catalog.filters.y);
  const upgradable = (await texts('Catalog')).filter((text) => text.includes(' · liv. ') || text === 'Fucina');
  await gameTap(catalog.filters.xs[2], catalog.filters.y);
  const obtainable = (await texts('Catalog')).filter((text) => text.includes(' · liv. ') || text === 'Fucina');
  await gameTap(catalog.filters.xs[0], catalog.filters.y);
  ok(
    upgradable.join() === 'Centro città · liv. 1' && obtainable.join() === 'Fucina',
    `filtri: potenziabili ${upgradable.join(', ')}; ottenibili ${obtainable.join(', ')}`,
  );

  // Eroi e Risorse
  await gameTap(catalog.tabs.xs[1], catalog.tabs.y);
  const heroes = await texts('Catalog');
  await shot('A6-3-eroi');
  await gameTap(catalog.tabs.xs[2], catalog.tabs.y);
  const resources = await texts('Catalog');
  await shot('A6-4-risorse');
  ok(
    heroes.includes('Capo') &&
      heroes.includes('Ottenibile') &&
      resources.some((text) => text.startsWith('Legno: 200')) &&
      resources.some((text) => text.startsWith('Da: conquiste')),
    `eroi ${heroes
      .filter((t) => t.length < 20)
      .slice(0, 12)
      .join(' | ')}; risorse ${resources
      .filter((t) => t.includes(':'))
      .slice(0, 6)
      .join(' | ')}`,
  );

  // Vai su un eroe: gli eroi; Indietro torna al Catalogo, sulla scheda degli eroi
  await gameTap(catalog.tabs.xs[1], catalog.tabs.y);
  const go = await labelAt('Catalog', catalog.labels.go);
  await gameTap(...go);
  const toHeroes = await active('Heroes');
  const heroesHud = await run('return balance.HUD.heroes;');
  await gameTap(heroesHud.back.x, heroesHud.back.y);
  const backToCatalog = await active('Catalog');
  const heroTab = await evaluate(`window.__game.scene.getScene('Catalog').tab`);
  ok(
    toHeroes && backToCatalog && heroTab === 'heroes',
    `Vai su un eroe ${toHeroes}, Indietro ${backToCatalog} (${heroTab})`,
  );

  // Vai sulla fucina, da mettere: il mondo comincia a metterla; poi Info della fattoria apre la sua voce in evidenza
  await gameTap(catalog.tabs.xs[0], catalog.tabs.y);
  const forgeGo = await labelAt('Catalog', catalog.labels.go, 4);
  await gameTap(...forgeGo);
  const toWorld = await active('WorldUI');
  await pause(600);
  const placing = await evaluate(`window.__game.scene.getScene('World').placement?.id ?? null`);
  await evaluate(`window.__game.scene.getScene('World').endPlacement(); 0`);
  await evaluate(`window.__game.scene.getScene('World').select('farm'); 0`);
  await pause(500);
  const buildingBar = world.buildingBar;
  const infoX = buildingBar.buttons.xs[2];
  const infoY = buildingBar.bottom - buildingBar.height + buildingBar.buttons.y;
  await gameTap(infoX, infoY);
  const toCatalog = await active('Catalog');
  const focus = await evaluate(`window.__game.scene.getScene('Catalog').focus`);
  await shot('A6-5-info');
  ok(
    toWorld && placing === 'forge' && toCatalog && focus === 'farm',
    `Vai sulla fucina: da mettere ${placing}; Info della fattoria: Catalogo ${toCatalog} con ${focus}`,
  );

  // Vai sulla fattoria: il mondo con la sua barra; Mondo dal Catalogo torna al mondo
  const farmGo = await labelAt('Catalog', catalog.labels.go, 2);
  await gameTap(...farmGo);
  await active('WorldUI');
  await pause(500);
  const sheet = await evaluate(`JSON.stringify(window.__game.scene.getScene('WorldUI').sheet)`);
  await gameTap(world.bar.items.catalog, world.bar.y);
  await active('Catalog');
  await gameTap(catalog.back.x, catalog.back.y);
  const home = await active('WorldUI');
  ok(
    sheet === JSON.stringify({ kind: 'building', id: 'farm' }) && home,
    `Vai sulla fattoria: barra ${sheet}; Mondo ${home}`,
  );

  // Il centro città al livello 2 chiede quattro edifici e quattro scorte: le loro scritte stanno nella barra del
  // centro, dentro lo schermo, e nella sua scheda del Catalogo, sopra la scheda dopo
  await edit(`p.village.levels.center = 2; window.__game.scene.getScene('World').bus.emit('worldChanged')`);
  await evaluate(`window.__game.scene.getScene('World').select('center'); 0`);
  await pause(500);
  await shot('A6-6-centro');
  const widest = await evaluate(`(() => {
    const ui = window.__game.scene.getScene('WorldUI');
    return Math.max(...ui.children.list.filter((o) => o.type === 'Text').map((t) => t.getBounds().right));
  })()`);
  await gameTap(world.bar.items.catalog, world.bar.y);
  await active('Catalog');
  const lowest = await evaluate(`(() => {
    const s = window.__game.scene.getScene('Catalog');
    const all = (list) => list.flatMap((o) => (o.type === 'Container' ? all(o.list) : [o]));
    const needs = all(s.children.list).filter((o) => o.type === 'Text' && /^[✓✗]/.test(o.text));
    const first = needs.filter((t) => t.y < ${catalog.list.y + catalog.cardHeight.buildings + catalog.gap});
    return Math.max(...first.map((t) => t.getBounds().bottom));
  })()`);
  await shot('A6-7-centro-catalogo');
  const cardBottom = catalog.list.y + catalog.cardHeight.buildings;
  ok(
    widest <= 720 && lowest <= cardBottom,
    `centro al liv. 2: la scritta più a destra della sua barra finisce a ${Math.round(widest)} (schermo 720); l'ultimo requisito nel Catalogo finisce a ${Math.round(lowest)} (la scheda a ${cardBottom})`,
  );
} catch (error) {
  ok(false, `la prova si è fermata: ${error.stack ?? error}`);
} finally {
  await game.close();
}
