// Prova a caso del 4.8: un minuto di tocchi, trascinamenti, pressioni lunghe, pizzichi e rotella in tutto lo schermo,
// con risorse abbondanti, edifici messi e spostati, passi sulla strada e battaglie vinte a volte; alla fine e ogni
// tanto: niente errori in console, edifici sempre nel territorio (con le aree conquistate), separati e fuori dalla
// strada, il capo sulla sua casella, zoom nei limiti, si è ancora nel mondo o in una scena raggiungibile
import { ok, openGame, sleep } from './lib.mjs';

const game = await openGame('48f');
const { send, evaluate, run, hook } = game;
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
const mouse = async (type, x, y, buttons = 1) => {
  const [px, py] = await page(x, y);
  await send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', buttons, clickCount: 1 });
};
const touch = async (type, points) => {
  const touchPoints = [];
  for (const [id, x, y] of points) {
    const [px, py] = await page(x, y);
    touchPoints.push({ x: px, y: py, id });
  }
  await send('Input.dispatchTouchEvent', { type, touchPoints });
};
let seed = 4711;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const between = (a, b) => a + random() * (b - a);
const invariants = () =>
  run(`const { canPlace } = await import(url('/src/meta/village.js'));
  const { conqueredAreas, ROAD_TILES } = await import(url('/src/meta/road.js'));
  const { toWorld } = await import(url('/src/view/iso.js'));
  const p = window.__game.registry.get('save').profile;
  const conquered = conqueredAreas(p.road);
  const bad = Object.entries(p.village.positions).filter(([id, at]) => at !== null && !canPlace(p.village.positions, id, at, conquered)).map(([id]) => id);
  const s = window.__game.scene.getScene('World');
  if (s.sys.isActive() && !s.road.walking && p.road.at > 0) {
    const tile = ROAD_TILES[p.road.at];
    const at = toWorld(tile.col + 0.5, tile.row + 0.5);
    if (Math.abs(s.road.pawn.x - at.x) > 0.01 || Math.abs(s.road.pawn.y - at.y) > 0.01) bad.push('capo');
  }
  const active = window.__game.scene.getScenes(true).map((x) => x.sys.settings.key).join(',');
  let zoom = null;
  if (s.sys.isActive()) {
    const { zoomLimits } = await import(url('/src/view/worldCamera.js'));
    const l = zoomLimits(s.cameras.main);
    const z = s.cameras.main.zoom;
    zoom = z >= l.min - 1e-6 && z <= l.max + 1e-6;
  }
  return { bad, active, zoom };`);

try {
  await game.open('e2e47f');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await evaluate(
    `localStorage.setItem('fall-out.save', JSON.stringify({ version: 1, profile: { road: { at: 23, done: true }, resources: { materials: 5000, scrap: 2000, rations: 500, accelerators: 50 } } })); 0`,
  );
  await send('Page.reload');
  await pause(3000);
  await hook();
  const counts = { tap: 0, drag: 0, hold: 0, pinch: 0, wheel: 0, back: 0 };
  const problems = [];
  const started = Date.now();
  while (Date.now() - started < 60000) {
    // Fuori dal mondo (mappa, eroi, schieramento, battaglia): si torna al villaggio come farebbe il giocatore
    const world = await evaluate(`window.__game.scene.isActive('World') === true`);
    if (!world) {
      counts.back += 1;
      await evaluate(
        `(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) g.scene.stop(s.sys.settings.key); g.scene.start('World'); return 0; })()`,
      );
      await pause(600);
      continue;
    }
    // Ogni tanto un passo sulla strada, e a volte la battaglia dove si è si vince
    if (random() < 0.15) {
      counts.step = (counts.step ?? 0) + 1;
      await evaluate(
        `(() => { const s = window.__game.scene.getScene('World'); s.bus.emit('roadTapped'); s.bus.emit('stepRequested'); return 0; })()`,
      );
      await pause(between(50, 500));
    }
    if (random() < 0.1) {
      counts.win = (counts.win ?? 0) + 1;
      await run(`const { winRoadTile } = await import(url('/src/meta/road.js'));
        const { writeSave } = await import(url('/src/core/save.js'));
        const save = window.__game.registry.get('save');
        const p = save.profile;
        if (!p.road.done) winRoadTile(p, p.road.at);
        writeSave(save);
        return 0;`);
    }
    // Ogni tanto si comincia a mettere o spostare un edificio, e a volte si tocca la sua ✓
    if (random() < 0.12) {
      counts.place = (counts.place ?? 0) + 1;
      const id = ['farm', 'barracks', 'forge'][Math.floor(random() * 3)];
      await run(`const { writeSave } = await import(url('/src/core/save.js'));
        const s = window.__game.scene.getScene('World'); const save = window.__game.registry.get('save'); const p = save.profile;
        p.village.construction = null;
        writeSave(save);
        s.bus.emit(p.village.positions['${id}'] === null ? 'placeRequested' : 'moveRequested', { id: '${id}' }); return 0;`);
      await pause(500);
    }
    if (random() < 0.15) {
      const at = await run(`const { worldToScreen } = await import(url('/src/view/worldCamera.js'));
        const s = window.__game.scene.getScene('World');
        if (!s.placement) return null;
        const p = worldToScreen(s.cameras.main, s.placement.buttons.x, s.placement.buttons.y);
        const c = balance.WORLD_VIEW.overlays.confirm;
        return [p.x + c.gap / 2, p.y + c.offsetY];`);
      if (at !== null) {
        counts.ok = (counts.ok ?? 0) + 1;
        await mouse('mousePressed', at[0], at[1]);
        await mouse('mouseReleased', at[0], at[1], 0);
        await pause(300);
      }
    }
    const kind = random();
    const x = between(20, 700);
    const y = between(140, 1260);
    if (kind < 0.45) {
      counts.tap += 1;
      await mouse('mousePressed', x, y);
      await mouse('mouseReleased', x, y, 0);
      await pause(between(80, 400));
    } else if (kind < 0.65) {
      counts.drag += 1;
      const x2 = between(20, 700);
      const y2 = between(140, 1260);
      await mouse('mousePressed', x, y);
      for (let i = 1; i <= 6; i++) await mouse('mouseMoved', x + ((x2 - x) * i) / 6, y + ((y2 - y) * i) / 6);
      await mouse('mouseReleased', x2, y2, 0);
      await pause(150);
    } else if (kind < 0.78) {
      counts.hold += 1;
      await mouse('mousePressed', x, y);
      await pause(between(300, 800));
      const x2 = x + between(-150, 150);
      const y2 = y + between(-150, 150);
      for (let i = 1; i <= 5; i++) await mouse('mouseMoved', x + ((x2 - x) * i) / 5, y + ((y2 - y) * i) / 5);
      await mouse('mouseReleased', x2, y2, 0);
      await pause(150);
    } else if (kind < 0.9) {
      counts.pinch += 1;
      const spread = between(-12, 12);
      await touch('touchStart', [[1, x, y]]);
      await touch('touchStart', [
        [1, x, y],
        [2, x + 80, y],
      ]);
      for (let i = 1; i <= 6; i++)
        await touch('touchMove', [
          [1, x - i * spread, y],
          [2, x + 80 + i * spread, y],
        ]);
      // A volte il primo dito si alza prima del secondo, che continua a trascinare
      if (random() < 0.5) {
        await touch('touchMove', [[2, x + 80 + 7 * spread, y + 30]]);
        await touch('touchEnd', []);
      } else {
        await touch('touchEnd', []);
      }
      await pause(150);
    } else {
      counts.wheel += 1;
      const [px, py] = await page(x, y);
      await send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: px,
        y: py,
        deltaX: 0,
        deltaY: between(-800, 800),
      });
      await pause(100);
    }
    if ((counts.tap + counts.drag + counts.hold + counts.pinch + counts.wheel) % 25 === 0) {
      const state = await invariants();
      if (state.bad.length > 0 || state.zoom === false) problems.push(state);
    }
  }
  const last = await invariants();
  const full = JSON.parse(await evaluate(`JSON.stringify(window.__game.registry.get('save').profile)`));
  const p = full.village;
  console.log('azioni', JSON.stringify(counts));
  console.log(
    'villaggio',
    JSON.stringify(p.levels),
    JSON.stringify(p.positions),
    p.construction?.building ?? null,
    'strada',
    JSON.stringify(full.road),
  );
  ok(
    problems.length === 0 && last.bad.length === 0,
    `ultimo stato ${JSON.stringify(last)}, problemi ${JSON.stringify(problems)}`,
  );
} finally {
  await game.close();
}
