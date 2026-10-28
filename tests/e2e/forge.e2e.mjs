// Prova end-to-end del C29 in Edge headless: la fucina al livello 3 ha Armi nella sua barra, che apre la schermata
// della fucina: le tre armi a livello 0, il fucile con il suo primo livello, il costo e Migliora, la raffica ferma
// finché la caserma non la addestra. Migliora fa partire il lavoro (pagato e salvato), la gemma lo finisce e il
// fucile sale al livello 1; un altro lavoro apre con la sfida lo schieramento della sfida della fucina, da cui si torna
// alla fucina senza spenderla. Il Catalogo ha la scheda Armi, e Vai di un'arma apre la fucina; Mondo torna al mondo;
// errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('c29');
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
const active = (scene) => until(`window.__game.scene.isActive('${scene}') === true`, 10);
// Il centro della scritta label nella scena name (la prima, o quella numero index)
const labelAt = (name, label, index = 0) =>
  evaluate(`(() => {
  const all = (list) => list.flatMap((o) => (o.type === 'Container' ? all(o.list) : [o]));
  const found = all(window.__game.scene.getScene('${name}').children.list).filter((o) => o.type === 'Text' && o.text === ${JSON.stringify(label)});
  const t = found[${index}];
  return t ? [t.x, t.y] : null;
})()`);
const tap = async (name, label, index = 0) => {
  const at = await labelAt(name, label, index);
  if (at === null) throw new Error(`manca «${label}» in ${name}`);
  await game.gameTap(at[0], at[1]);
  await pause(300);
};
const stored = () => evaluate(`JSON.parse(localStorage.getItem('fall-out.save')).profile`);

try {
  console.log('aggancio:', await game.open('e2ec29'));
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await game.reload();
  await pause(600);
  await run(`const { writeSave } = await import(url('/src/core/save.js'));
    const { freeSpot } = await import(url('/src/meta/village.js'));
    const save = window.__game.registry.get('save');
    const { village, resources } = save.profile;
    village.levels.forge = 3;
    village.positions.forge = freeSpot(village.positions, 'forge', 0);
    Object.assign(resources, { stone: 100, gears: 30, gems: 1 });
    writeSave(save);
    return 0;`);
  await game.reload();
  await pause(800);
  await run(`window.__game.scene.getScene('WorldUI').open({ kind: 'building', id: 'forge' }); return 0;`);
  await pause(400);
  const sheet = await texts('WorldUI');
  const command = await labelAt('WorldUI', 'Armi');
  const { buttons } = await run('return balance.HUD.world.buildingBar;');
  await game.gameTap(command[0], command[1] - buttons.labelY);
  const opened = await active('Forge');
  await pause(300);
  const screen = await texts('Forge');
  await shot('C29-1-fucina');
  ok(
    sheet.includes('Armi') &&
      opened &&
      [
        'Fucina · liv. 3',
        'Armi dei soldati fino al liv. 3',
        'Fucile · liv. 0/5',
        'Raffica · liv. 0/5',
        'Lanciatore · liv. 0/5',
        'Livello 1: danno +15%',
        'Si addestra dalla caserma al liv. 2',
        "Nessun lavoro in corso: scegli un'arma da migliorare",
      ].every((text) => screen.includes(text)) &&
      screen.filter((text) => text === 'Migliora').length === 1,
    `barra della fucina con Armi ${sheet.includes('Armi')}; fucina aperta ${opened}: ${screen.join(' | ')}`,
  );

  // Migliora il fucile: il lavoro parte, pagato e salvato; la gemma lo finisce
  await tap('Forge', 'Migliora');
  const working = await texts('Forge');
  const job = await stored();
  await shot('C29-2-lavoro');
  await tap(
    'Forge',
    working.find((text) => text.endsWith('gemma')),
  );
  const done = await texts('Forge');
  const after = await stored();
  ok(
    working.includes('In lavorazione: Fucile → liv. 1') &&
      working.some((text) => text.startsWith('Finisce tra')) &&
      job.forgeJob?.weapon === 'rifle' &&
      job.resources.stone === 92 &&
      done.includes('Fucile · liv. 1/5') &&
      done.includes('Ora: danno +15%') &&
      after.weaponLevels.rifle === 1 &&
      after.forgeJob === null &&
      after.resources.gems === 0,
    `lavoro: ${working.filter((t) => /lavorazione|Finisce/.test(t)).join(' | ')}, pietra ${job.resources.stone}; con la gemma: ${done.filter((t) => /Fucile|Ora/.test(t)).join(' | ')}, livelli ${JSON.stringify(after.weaponLevels)}`,
  );

  // Un altro lavoro, poi la sfida: lo schieramento della sfida della fucina, e indietro alla fucina senza spenderla
  await tap('Forge', 'Migliora');
  const challenge = (await texts('Forge')).find((text) => text.startsWith('Sfida'));
  await tap('Forge', challenge);
  const lineup = await active('Lineup');
  await pause(300);
  const rules = await texts('Lineup');
  await shot('C29-3-sfida');
  await tap('Lineup', 'Fucina');
  const back = await active('Forge');
  const unspent = (await stored()).forgeJob;
  ok(
    lineup &&
      rules.includes('Sfida della fucina') &&
      rules.some((text) => text.includes('Vinci: tempo del lavoro della fucina') && text.includes('Fucile')) &&
      back &&
      unspent?.challenged === false,
    `sfida: ${challenge}; schieramento ${lineup}: ${rules.filter((t) => /Sfida|Vinci/.test(t)).join(' | ')}; indietro alla fucina ${back}, sfida ancora da fare ${unspent?.challenged === false}`,
  );

  // Il Catalogo, scheda Armi: le tre armi; Vai del fucile apre la fucina
  await run(`window.__game.scene.getScenes(true).forEach((s) => window.__game.scene.stop(s.scene.key));
    window.__game.scene.start('Catalog', { tab: 'weapons' }); return 0;`);
  await active('Catalog');
  await pause(400);
  const catalog = await texts('Catalog');
  await shot('C29-4-catalogo');
  await tap('Catalog', 'Vai');
  const fromCatalog = await active('Forge');
  ok(
    catalog.includes('Armi') &&
      catalog.includes('Fucile · liv. 1') &&
      catalog.includes('Raffica') &&
      catalog.includes('Lanciatore') &&
      fromCatalog,
    `Catalogo, Armi: ${catalog.filter((t) => /Fucile|Raffica|Lanciatore/.test(t)).join(' | ')}; Vai apre la fucina ${fromCatalog}`,
  );

  await tap('Forge', 'Mondo');
  const world = await active('World');
  ok(world, `Mondo torna al mondo ${world}`);
} finally {
  await game.close();
}
