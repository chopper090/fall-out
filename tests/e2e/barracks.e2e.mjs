// Prova end-to-end del C20 in Edge headless: la caserma al livello 3 ha Esercito nella sua barra, che apre la schermata
// della caserma: l'esercito con i suoi soldati, i fucilieri che prendono tutti i posti, raffica e lanciatori a zero con
// − e +, le élite bloccate fino al livello 5; + della raffica cambia un fuciliere in raffica e si salva (C20). Con tre
// fucilieri caduti (C22) la scheda dice quanto dura riaddestrarli (pochi soldati non costano razioni), Riaddestra fa
// partire il conto alla rovescia senza pagare, Finisci con una gemma li riporta; Mondo torna al mondo; errori in
// console
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('c20');
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
  const found = window.__game.scene.getScene('${name}').children.list.filter((o) => o.type === 'Text' && o.text === ${JSON.stringify(label)});
  const t = found[${index}];
  return t ? [t.x, t.y] : null;
})()`);

try {
  console.log('aggancio:', await game.open('e2ec20'));
  await evaluate(`localStorage.removeItem('fall-out.save'); 0`);
  await game.reload();
  await pause(600);
  await run(`const { writeSave } = await import(url('/src/core/save.js'));
    const { freeSpot } = await import(url('/src/meta/village.js'));
    const save = window.__game.registry.get('save');
    const { village } = save.profile;
    village.levels.barracks = 3;
    village.positions.barracks = freeSpot(village.positions, 'barracks', 0);
    writeSave(save);
    return 0;`);
  await game.reload();
  await pause(800);
  await run(`window.__game.scene.getScene('WorldUI').open({ kind: 'building', id: 'barracks' }); return 0;`);
  await pause(400);
  const sheet = await texts('WorldUI');
  const command = await labelAt('WorldUI', 'Esercito');
  const { buttons } = await run('return balance.HUD.world.buildingBar;');
  await game.gameTap(command[0], command[1] - buttons.labelY);
  const opened = await active('Barracks');
  await pause(300);
  const screen = await texts('Barracks');
  await shot('C20-1-caserma');
  ok(
    sheet.includes('Esercito') &&
      opened &&
      ['Caserma · liv. 3', 'Esercito: 12 soldati', 'Fucilieri: 12', 'Raffica: 0', 'Lanciatori: 0', 'Élite'].every(
        (text) => screen.includes(text),
      ) &&
      screen.includes('Dalla caserma al liv. 5') &&
      screen.filter((text) => text === '+').length === 2,
    `barra della caserma con Esercito ${sheet.includes('Esercito')}; caserma aperta ${opened}: ${screen.filter((t) => t.length < 40).join(' | ')}`,
  );

  // + della raffica: un fuciliere diventa raffica, e il salvataggio lo tiene
  const plus = await labelAt('Barracks', '+', 0);
  await game.gameTap(plus[0], plus[1]);
  await pause(300);
  const changed = await texts('Barracks');
  const saved = await evaluate(`JSON.parse(localStorage.getItem('fall-out.save')).profile.army`);
  await shot('C20-2-raffica');
  ok(
    changed.includes('Fucilieri: 11') && changed.includes('Raffica: 1') && saved?.burst === 1,
    `dopo + della raffica: ${changed.filter((t) => /: \d+$/.test(t)).join(' | ')}; sul telefono ${JSON.stringify(saved)}`,
  );

  // Tre fucilieri caduti: Riaddestra, poi Finisci con la gemma
  await run(`const { writeSave } = await import(url('/src/core/save.js'));
    const save = window.__game.registry.get('save');
    Object.assign(save.profile.fallen, { rifle: 3 });
    Object.assign(save.profile.resources, { rations: 10, gems: 1 });
    writeSave(save);
    window.__game.scene.getScene('Barracks').redraw();
    return 0;`);
  const fallen = await texts('Barracks');
  await shot('C22-1-caduti');
  const retrain = await labelAt('Barracks', 'Riaddestra');
  await game.gameTap(retrain[0], retrain[1]);
  await pause(300);
  const training = await texts('Barracks');
  const rations = await evaluate(`JSON.parse(localStorage.getItem('fall-out.save')).profile.resources.rations`);
  await shot('C22-2-in-addestramento');
  const rush = await labelAt('Barracks', 'Finisci · 1 gemma');
  await game.gameTap(rush[0], rush[1]);
  await pause(300);
  const done = await texts('Barracks');
  const after = await evaluate(`JSON.parse(localStorage.getItem('fall-out.save')).profile`);
  ok(
    fallen.includes('Fucilieri: 11 (3 caduti)') &&
      fallen.includes('Caduti: 3') &&
      fallen.includes('Riaddestrarli dura 15 s') &&
      training.some((t) => t.startsWith('In addestramento, finisce tra')) &&
      rations === 10 &&
      done.includes("Nessun caduto: l'esercito è al completo") &&
      Object.values(after.fallen).every((count) => count === 0) &&
      after.resources.gems === 0 &&
      after.retrain === null,
    `caduti: ${fallen.filter((t) => /cadut|Riaddestr/.test(t)).join(' | ')}; Riaddestra: ${training.filter((t) => /addestramento|Finisci/.test(t)).join(' | ')}, razioni ${rations}; Finisci: ${done.filter((t) => /cadut/i.test(t)).join(' | ')}, gemme ${after.resources.gems}`,
  );

  const back = await labelAt('Barracks', 'Mondo');
  await game.gameTap(back[0], back[1]);
  const world = await active('World');
  ok(world, `Mondo torna al mondo ${world}`);
} finally {
  await game.close();
}
