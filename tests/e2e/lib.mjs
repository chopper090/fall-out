// Prove nel browser: Edge (o Chrome) senza finestra, pilotato via CDP sul server di sviluppo. Aggancio al gioco
// (window.__game) e alla battaglia (window.__battle), configurazione dal vivo dei moduli del gioco, foto, conteggio dei
// frame, errori in console. Si regola con l'ambiente: E2E_URL (un server già acceso; senza, ne parte uno di Vite su una
// porta libera), E2E_BROWSER (il programma del browser), E2E_OUT (dove vanno foto e profili, di base tests/e2e/out)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const dir = process.env.E2E_OUT ?? fileURLToPath(new URL('./out/', import.meta.url));
// I profili del browser stanno fuori dal progetto: dentro, Vite li guarderebbe e li analizzerebbe come pagine
const PROFILES = `${tmpdir()}/fall-out-e2e`;
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const SCREEN = { width: 375, height: 812, scale: 2 };
const GAME = { width: 720, height: 1280 };
// Quanto si aspetta il browser (che risponda e che apra il suo canale) e la risposta a un comando
const BROWSER_WAIT_MS = 10000;
const COMMAND_WAIT_MS = 20000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Esito dei controlli: una riga per controllo; un ERR (o un errore in console, vedi close) fa uscire con codice 1
export function ok(pass, text) {
  console.log(`  ${pass ? 'OK ' : 'ERR'} ${text}`);
  if (!pass) process.exitCode = 1;
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

let vite = null;
async function gameUrl() {
  if (process.env.E2E_URL) return process.env.E2E_URL.replace(/\/?$/, '/');
  const { createServer } = await import('vite');
  vite = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await vite.listen();
  return vite.resolvedUrls.local[0];
}

function browserPath() {
  const path = process.env.E2E_BROWSER ?? BROWSERS.find((candidate) => existsSync(candidate));
  if (!path) throw new Error('nessun browser trovato: imposta E2E_BROWSER');
  return path;
}

// Il profilo del browser via, riprovando qualche volta: appena chiuso il browser può tenere ancora dei file
async function removeProfile(profile) {
  for (let i = 0; i < 5 && existsSync(profile); i++) {
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      await sleep(500);
    }
  }
}

// Il canale CDP della pagina del browser sulla porta port, aperto; un errore se il browser non risponde o il canale
// non si apre in BROWSER_WAIT_MS
async function pageSocket(port) {
  let target;
  for (let waited = 0; waited < BROWSER_WAIT_MS && !target; waited += 200) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {
      // il browser non è ancora pronto
    }
  }
  if (!target) throw new Error('il browser non risponde');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let timer;
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('il canale del browser non si apre')), { once: true });
    timer = setTimeout(() => reject(new Error('il canale del browser non si apre in tempo')), BROWSER_WAIT_MS);
  });
  await opened.finally(() => clearTimeout(timer));
  return ws;
}

export async function openGame(tag) {
  const port = await freePort();
  const base = await gameUrl();
  const profile = `${PROFILES}/${tag}-${port}`;
  mkdirSync(profile, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const browser = spawn(
    browserPath(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling',
      '--no-default-browser-check',
      `--window-size=${SCREEN.width},${SCREEN.height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  // Se il browser non parte, non resta acceso da solo con il suo profilo, e nemmeno il server
  let ws;
  try {
    ws = await pageSocket(port);
  } catch (error) {
    browser.kill();
    await removeProfile(profile);
    if (vite) await vite.close();
    throw error;
  }
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  // Un comando al browser, con la sua risposta; un errore se non arriva in COMMAND_WAIT_MS. L'attesa si chiude con la
  // risposta, così finita la prova il processo esce subito
  const send = (method, params = {}) => {
    const n = ++id;
    let timer;
    const reply = new Promise((resolve) => {
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        pending.delete(n);
        reject(new Error(`timeout ${method}`));
      }, COMMAND_WAIT_MS);
    });
    return Promise.race([reply, timeout]).finally(() => clearTimeout(timer));
  };
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    const details = res.result?.exceptionDetails;
    if (details) return 'ECCEZIONE ' + JSON.stringify(details.exception?.description ?? details.text);
    return res.result?.result?.value;
  };
  const shot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${dir}/${name}.png`, Buffer.from(res.result.data, 'base64'));
    console.log('foto', name);
  };
  // Moduli del gioco con lo stesso indirizzo che usa la pagina; body li trova già importati
  const modules = `
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes(name)).at(-1);
    const balance = await import(url('/src/config/balance.js'));
    const { WAVES, BOSS, LIMITS } = await import(url('/src/data/waves.js'));
    const { ENEMY_TYPES } = await import(url('/src/data/enemies.js'));
    const { GATE_KINDS } = await import(url('/src/data/gates.js'));
    const { CHEST_KINDS } = await import(url('/src/data/chests.js'));`;
  const run = (body) => evaluate(`(async () => { ${modules}\n${body} })()`);
  const configure = (body) =>
    run(`${body}
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === balance.DEBUG.restartLabel);
    button.click();
    return 'ok';`);
  const wait = async (seconds) => {
    for (let q = 0; q < seconds; q++) {
      await sleep(1000);
      await send('Page.bringToFront');
    }
  };
  const startCounting = () =>
    evaluate(`window.__frames = [];
    if (!window.__ticking) {
      window.__ticking = true;
      (function tick(t) { window.__frames.push(t); requestAnimationFrame(tick); })(performance.now());
    }
    0`);
  const frameStats = () =>
    evaluate(`(() => {
    const f = window.__frames; if (f.length < 2) return null;
    let worst = 0; for (let i = 1; i < f.length; i++) worst = Math.max(worst, f[i] - f[i - 1]);
    const slow = f.slice(1).filter((t, i) => t - f[i] > 33.4).length;
    const fps = +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1);
    return { fps, worstFrameMs: +worst.toFixed(1), framesOver33ms: slow };
  })()`);
  const tap = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  // Tocco in un punto del gioco (schermo logico 720x1280), dove sta sulla pagina
  const gameTap = async (x, y) => {
    const [px, py] = await evaluate(`(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return [r.left + ${x} * r.width / ${GAME.width}, r.top + ${y} * r.height / ${GAME.height}];
    })()`);
    await tap(px, py);
    await sleep(300);
  };
  // Aggancio al gioco (window.__game, a ogni frame) e alla scena della battaglia (window.__battle, window.__scene)
  const hook = () =>
    evaluate(`(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/deps/phaser.js'));
    const Phaser = await import(url);
    const manager = Phaser.Scenes.SceneManager.prototype;
    const update = manager.update;
    manager.update = function (...args) { window.__game = this.game; return update.apply(this, args); };
    const clear = Phaser.GameObjects.Graphics.prototype.clear;
    Phaser.GameObjects.Graphics.prototype.clear = function (...args) {
      if (this.scene?.battle) { window.__battle = this.scene.battle; window.__scene = this.scene; }
      return clear.apply(this, args);
    };
    return 'ok';
  })()`);
  // Finché expression è vera, al massimo seconds secondi, con la pagina davanti (dietro il browser la rallenta); dice
  // se lo è diventata
  const until = async (expression, seconds) => {
    for (let waited = 0; waited < seconds * 1000; waited += 250) {
      if ((await evaluate(expression)) === true) return true;
      await send('Page.bringToFront');
      await sleep(250);
    }
    return false;
  };
  // La pagina ricaricata: quando la nuova ha caricato Phaser la si aggancia di nuovo, poi si aspetta il mondo pronto
  // (WorldUI attiva, al massimo seconds secondi). Dice se è pronto. Con un'attesa fissa, su un PC carico il mondo
  // poteva non esserci ancora
  const reload = async (seconds = 10) => {
    const before = await evaluate('performance.timeOrigin');
    await send('Page.reload');
    const phaser = `performance.timeOrigin !== ${before} &&
      performance.getEntriesByType('resource').some((e) => e.name.includes('/deps/phaser.js'))`;
    await until(phaser, seconds);
    await hook();
    return until(`window.__game?.scene.isActive('WorldUI') === true`, seconds);
  };
  // Pagina del gioco, aperta e agganciata
  async function open(query) {
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: SCREEN.width,
      height: SCREEN.height,
      deviceScaleFactor: SCREEN.scale,
      mobile: true,
    });
    await send('Page.navigate', { url: `${base}?${query}` });
    await sleep(2500);
    await wait(2);
    return hook();
  }
  // Il browser apre tanti processi: si chiude con il suo comando, e solo se non risponde si uccide quello di avvio.
  // Poi via il profilo e il server; un errore in console fa fallire la prova
  const close = async () => {
    console.log('errori in console:', errors.length ? errors : 'nessuno');
    if (errors.length) process.exitCode = 1;
    try {
      const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      const root = new WebSocket(webSocketDebuggerUrl);
      await new Promise((r) => root.addEventListener('open', r, { once: true }));
      root.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      await sleep(1500);
    } catch {
      // già chiuso
    }
    ws.close();
    browser.kill();
    await removeProfile(profile);
    if (vite) await vite.close();
  };
  return {
    send,
    evaluate,
    run,
    configure,
    shot,
    wait,
    startCounting,
    frameStats,
    tap,
    gameTap,
    hook,
    reload,
    open,
    close,
    errors,
  };
}
