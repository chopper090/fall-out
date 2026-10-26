// Il mondo non tiene in memoria le scritte vecchie: immagini registrate prima e dopo 40 tocchi sul terreno, 20
// aperture della scheda di un edificio, 30 passi sulla strada con la sua scheda aperta e 10 giri tra mondo,
// schieramento ed eroi
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('48l');
const { send, evaluate, run } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 200) {
    await front();
    await sleep(Math.min(200, left));
  }
};
const page = (x, y) =>
  evaluate(
    `(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${x} * r.width / 720, r.top + ${y} * r.height / 1280]; })()`,
  );
const tap = async (x, y) => {
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
  await pause(120);
};
const textures = () => evaluate(`Object.keys(window.__game.textures.list).length`);
try {
  await game.open('e2e47l');
  await evaluate(
    `localStorage.setItem('fall-out.save', JSON.stringify({ version: 1, profile: { resources: { rations: 200 }, village: { levels: { farm: 2, barracks: 1, forge: 1 } } } })); 0`,
  );
  await game.reload();
  await pause(500);
  const start = await textures();
  for (let i = 0; i < 40; i++) await tap(80, 300);
  const afterGround = await textures();
  for (let i = 0; i < 20; i++) {
    await evaluate(`window.__game.scene.getScene('World').bus.emit('buildingTapped', { id: 'farm' }); 0`);
    await pause(80);
    await evaluate(`window.__game.scene.getScene('World').bus.emit('groundTapped'); 0`);
    await pause(80);
  }
  const afterPanel = await textures();
  await evaluate(`window.__game.scene.getScene('World').bus.emit('roadTapped'); 0`);
  for (let i = 0; i < 30; i++) {
    // La prossima casella si tocca e il capo ci cammina; le battaglie si saltano come vinte (si cammina solo sulle
    // caselle senza battaglia, e dopo una battaglia non ce n'è mai un'altra)
    await run(`const { writeSave } = await import(url('/src/core/save.js'));
      const { isBattle, nextTile } = await import(url('/src/meta/road.js'));
      const s = window.__game.scene.getScene('World'); const save = window.__game.registry.get('save');
      const p = save.profile;
      if (isBattle(nextTile(p))) p.road.at += 1;
      p.road.done = true;
      writeSave(save);
      s.road.walking = false; s.tapRoad(nextTile(p)); return 0;`);
    await pause(150);
    await evaluate(
      `(() => { const g = window.__game; if (!g.scene.isActive('World')) { for (const s of g.scene.getScenes(true)) g.scene.stop(s.sys.settings.key); g.scene.start('World'); } return 0; })()`,
    );
    await pause(150);
  }
  const afterRoad = await textures();
  for (let i = 0; i < 10; i++) {
    const target =
      i % 2 ? ['Lineup', JSON.stringify({ mode: 'road', tile: 3 })] : ['Heroes', JSON.stringify({ from: 'World' })];
    await evaluate(`window.__game.scene.getScene('World').navigate('${target[0]}', ${target[1]}); 0`);
    await pause(400);
    await evaluate(
      `(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) g.scene.stop(s.sys.settings.key); g.scene.start('World'); return 0; })()`,
    );
    await pause(500);
  }
  const afterScenes = await textures();
  const objects = await evaluate(
    `window.__game.scene.getScene('World').children.list.length + window.__game.scene.getScene('WorldUI').children.list.length`,
  );
  // Il mondo smette di ascoltare il meta-gioco quando si chiude: dopo tutti i giri ascolta solo quello di adesso
  const listeners = await evaluate(`window.__game.events.listenerCount('profileChanged')`);
  ok(
    afterScenes <= start,
    `immagini registrate: all'inizio ${start}, dopo 40 tocchi ${afterGround}, dopo 20 schede ${afterPanel}, dopo 30 passi ${afterRoad}, dopo 10 giri ${afterScenes}; oggetti nel mondo ${objects}`,
  );
  ok(listeners === 1, `il mondo ascolta il meta-gioco una volta sola dopo i giri: ${listeners}`);
} finally {
  await game.close();
}
