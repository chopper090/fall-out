// FPS nelle ondate più fitte: la prima battaglia della strada con due boss (sette ondate), ondata 6 e poi ondata 5, con
// l'esercito al tetto; il capo non cade e i nemici passati non contano, così si misura la strada piena.
// Errori in console
import { ok, openGame, sleep } from './lib.mjs';

// Sotto questi fotogrammi al secondo, sul PC, la prova fallisce
const FPS_MIN = 50;
const game = await openGame('410f');
const { send, evaluate, run, shot, configure, startCounting, frameStats } = game;
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await send('Page.bringToFront');
    await sleep(Math.min(250, left));
  }
};
const until = async (expression, seconds) => {
  for (let i = 0; i < seconds * 4; i++) {
    if ((await evaluate(expression)) === true) return true;
    await pause(250);
  }
  return false;
};
const keepAlive = () =>
  run(`const b = window.__game.scene.getScene('Battle').battle;
  b.army.leader.hp = b.army.leader.maxHp = 1e9;
  return 0;`);
const measure = async (wave) => {
  await pause(6000);
  await startCounting();
  await pause(8000);
  const state = await evaluate(`(() => { const b = window.__game.scene.getScene('Battle').battle;
    return { text: window.__game.scene.getScene('BattleUI').wave.text, enemies: b.spawner.enemies.length, army: b.army.soldiers.length, over: b.over }; })()`);
  const stats = await frameStats();
  ok(
    stats !== null && stats.fps >= FPS_MIN && !state.over,
    `ondata ${wave}: ${JSON.stringify(stats)} ${JSON.stringify(state)}`,
  );
  await shot(`410f-ondata-${wave}`);
};

try {
  console.log('aggancio:', await game.open('e2e410f'));
  const long = await run(`const { ROAD_TILES, storedRoad } = await import(url('/src/meta/road.js'));
    const tile = ROAD_TILES.find((t) => t.rules?.type === 'double');
    const road = storedRoad({ at: tile.index, done: false, lost: false });
    const profile = { road, resources: { rations: 5 } };
    localStorage.setItem(balance.SAVE.storageKey, JSON.stringify({ version: balance.SAVE.version, profile }));
    return tile.index;`);
  await game.reload();
  await pause(600);
  // I valori di partenza, rimessi alla fine com'erano
  await run(`const { MISSION, LEVEL, ARMY } = balance;
    window.__saved = { maxEscaped: MISSION.maxEscaped, startWave: LEVEL.startWave, startSize: ARMY.startSize };
    MISSION.maxEscaped = 1e9; LEVEL.startWave = 6; ARMY.startSize = 100; return 0;`);
  await evaluate(`window.__game.scene.getScene('World').navigate('Lineup', { mode: 'road', tile: ${long} }); 0`);
  await until(`window.__game.scene.isActive('Lineup') === true`, 5);
  const start = await run('return balance.HUD.lineup.startButton;');
  await game.gameTap(start.x, start.y);
  console.log('  in battaglia:', await until(`window.__game.scene.isActive('BattleUI') === true`, 10));
  await keepAlive();
  await measure(6);
  await configure('balance.LEVEL.startWave = 5;');
  await pause(1500);
  await keepAlive();
  await measure(5);
  await run(`const { maxEscaped, startWave, startSize } = window.__saved;
    Object.assign(balance.MISSION, { maxEscaped }); Object.assign(balance.LEVEL, { startWave });
    Object.assign(balance.ARMY, { startSize }); return 0;`);
} catch (error) {
  ok(false, `errore nel test: ${error.message}`);
} finally {
  await game.close();
}
