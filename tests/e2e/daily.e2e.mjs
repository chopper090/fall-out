// Prova end-to-end dello step S6 in Edge headless: la barra del mondo ha Missioni, che apre le missioni del giorno
// (tre, con la barra di quanto manca) e le sfide del giorno (Orda, Corazzati, Due boss, con Gioca); una missione finita
// si ritira per le sue gemme, e la barra del mondo lo segna prima; Gioca apre lo schieramento della sfida del giorno,
// con le gemme da vincere; vinta, il riepilogo dice le gemme e si torna alle missioni, dove la sfida è giocata oggi;
// errori in console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('s6');
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
const active = (scene) => until(`window.__game.scene.isActive('${scene}') === true`, 10);
const gems = () => evaluate(`window.__game.registry.get('save').profile.resources.gems`);
// Il centro della scritta label nella scena name (la prima, o quella numero index)
const labelAt = (name, label, index = 0) =>
  evaluate(`(() => {
  const found = window.__game.scene.getScene('${name}').children.list.filter((o) => o.type === 'Text' && o.text === ${JSON.stringify(label)});
  const t = found[${index}];
  return t ? [t.x, t.y] : null;
})()`);

try {
  console.log('aggancio:', await game.open('e2es6&seed=17'));
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await game.reload();
  await pause(600);
  const world = await run('return balance.HUD.world;');
  const daily = await run('return balance.HUD.daily;');
  const bar = await texts('WorldUI');
  await game.gameTap(world.bar.items.daily, world.bar.y);
  const opened = await active('Daily');
  await pause(300);
  const screen = await texts('Daily');
  const missions = await evaluate(`window.__game.registry.get('save').profile.daily.missions.map((m) => m.id)`);
  await shot('S6-1-missioni');
  ok(
    bar.includes('Missioni') &&
      opened &&
      screen.includes('Missioni del giorno') &&
      screen.some((t) => t.startsWith('Si rinnovano tra')) &&
      missions.length === 3 &&
      ['Orda', 'Corazzati', 'Due boss'].every((name) => screen.includes(name)) &&
      screen.filter((t) => t === 'Gioca').length === 3 &&
      screen.filter((t) => t === 'Ritira').length === 3,
    `barra ${bar.filter((t) => t.length < 12).join(' | ')}; Missioni aperta ${opened}: missioni ${missions.join(' ')}; ${screen.filter((t) => t.length < 60).join(' | ')}`,
  );

  // La prima missione finita: la barra del mondo la segna, Ritira dà le sue gemme
  await edit(`const { DAILY } = await import(url('/src/data/daily.js'));
    const [first] = p.daily.missions;
    first.progress = DAILY.missions.pool[first.id].target`);
  await game.gameTap(daily.back.x, daily.back.y);
  await active('World');
  await pause(400);
  const badge = await evaluate(
    `window.__game.scene.getScene('WorldUI').children.list.some((o) => o.type === 'Text' && o.text === '!' && Math.abs(o.x - ${world.bar.items.daily}) < 60)`,
  );
  await shot('S6-2-segno');
  await game.gameTap(world.bar.items.daily, world.bar.y);
  await active('Daily');
  await pause(300);
  const before = await gems();
  const claim = await labelAt('Daily', daily.labels.claim);
  await game.gameTap(...claim);
  await pause(300);
  const after = await gems();
  const claimed = await texts('Daily');
  await shot('S6-3-ritirata');
  ok(
    badge && after === before + 2 && claimed.includes('Ritirata'),
    `missione finita: segno sulla barra ${badge}; ritirata, gemme ${before} → ${after}; ${claimed.filter((t) => t.startsWith('Ritira')).join(', ')}`,
  );

  // Gioca l'Orda: lo schieramento della sfida del giorno, poi la battaglia vinta (eroi che non cadono, nemici passati
  // che non contano): il riepilogo dice le gemme, e si torna alle missioni con l'Orda giocata oggi
  const play = await labelAt('Daily', daily.labels.play);
  await game.gameTap(...play);
  const lineupOpen = await active('Lineup');
  await pause(300);
  const lineup = await texts('Lineup');
  await shot('S6-4-schieramento');
  ok(
    lineupOpen &&
      lineup.includes('Sfida del giorno · Orda') &&
      lineup.some((t) => t.startsWith('molti più nemici · Vinci +3 gemme')),
    `schieramento: ${lineup.slice(0, 4).join(' | ')}`,
  );
  const start = await run('return balance.HUD.lineup.startButton;');
  await game.gameTap(start.x, start.y);
  await active('BattleUI');
  await run(`const b = window.__game.scene.getScene('Battle').battle;
    for (const hero of b.army.heroes) hero.hp = hero.maxHp = 1e9;
    window.__savedEscaped = balance.MISSION.maxEscaped;
    balance.MISSION.maxEscaped = 1e9;
    return 0;`);
  const gemsBefore = await gems();
  await until(`window.__game.scene.getScene('Battle').battle?.over === true`, 150);
  await run('balance.MISSION.maxEscaped = window.__savedEscaped; return 0;');
  await active('Summary');
  await pause(1200);
  const summary = await texts('Summary');
  const gemsAfter = await gems();
  await shot('S6-5-riepilogo');
  await game.gameTap(360, 640);
  const backToDaily = await active('Daily');
  await pause(300);
  const done = await texts('Daily');
  await shot('S6-6-giocata');
  ok(
    summary.some((t) => t.startsWith('Sfida vinta: +3 gemme · +5 frammenti di ')) &&
      gemsAfter === gemsBefore + 3 &&
      backToDaily &&
      done.filter((t) => t === 'Giocata oggi').length === 1 &&
      done.filter((t) => t === 'Gioca').length === 2,
    `riepilogo ${summary.filter((t) => t.startsWith('Sfida')).join(' | ')}; gemme ${gemsBefore} → ${gemsAfter}; di nuovo alle missioni ${backToDaily}: ${done.filter((t) => t.startsWith('Gioca')).join(', ')}`,
  );
} finally {
  await game.close();
}
