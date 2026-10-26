// Prova nel browser del B10, la versione del gioco e gli errori: la versione (quella di package.json con il commit) si
// legge sotto il riquadro delle impostazioni e nel titolo del pannello di sviluppo; index.html ha passato i suoi errori
// dell'avvio al registro; un errore di un'estensione del browser va nel registro senza schermata; un errore lanciato
// dalla pagina ferma il gioco e apre la schermata dell'errore, con la versione, e finisce nel registro sul telefono con
// il messaggio, lo stack, la versione, il commit, l'ora e le scene attive; sotto la schermata il gioco non riceve
// tocchi; una promessa rifiutata dopo va nel registro senza una seconda schermata; Copia il registro lo copia (o lo
// lascia selezionato, da copiare a mano); Ricarica riapre il gioco senza schermata, con il registro ancora lì; il
// pulsante del registro nel pannello di sviluppo lo mostra e Svuota lo svuota. Foto della schermata e della scheda;
// errori in console, tranne i due lanciati apposta
import { readFileSync } from 'node:fs';
import { ok, openGame, sleep } from './lib.mjs';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const game = await openGame('b10');
const { send, evaluate, shot, run, hook, tap } = game;
const front = () => send('Page.bringToFront');
const pause = async (ms) => {
  for (let left = ms; left > 0; left -= 250) {
    await front();
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
const page = (x, y) =>
  evaluate(
    `(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + ${x} * r.width / 720, r.top + ${y} * r.height / 1280]; })()`,
  );
const gameTap = async (x, y) => {
  await tap(...(await page(x, y)));
  await pause(400);
};
// Le scritte della scena name, con dove stanno sullo schermo del gioco (anche quelle dentro un contenitore)
const labels = (name) =>
  evaluate(`(() => {
  const all = (list, dx, dy) => list.flatMap((o) => (o.type === 'Container' ? all(o.list, dx + o.x, dy + o.y) : [[o, dx, dy]]));
  return all(window.__game.scene.getScene('${name}').children.list, 0, 0)
    .filter(([o]) => o.type === 'Text').map(([t, dx, dy]) => ({ text: t.text, x: t.x + dx, y: t.y + dy }));
})()`);
const tapLabel = async (text, x = null) => {
  const label = (await labels('PauseMenu')).find((one) => one.text === text);
  if (!label) throw new Error(`nel menu non c'è «${text}»`);
  await gameTap(x ?? label.x + 10, label.y);
};
// Un elemento della pagina (selector) con la scritta text, toccato dove sta
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
const paneShown = () =>
  evaluate(`(() => { const el = document.querySelector('.tp-rotv'); return !!el && getComputedStyle(el).display !== 'none'; })()`);
// Le schermate dell'errore nella pagina (title: il loro titolo), con le loro scritte, la casella del registro e
// quanto ne è selezionato
const overlays = (title) =>
  evaluate(`[...document.body.children]
  .filter((el) => getComputedStyle(el).position === 'fixed' && el.textContent.includes(${JSON.stringify(title)}))
  .map((el) => {
    const area = el.querySelector('textarea');
    const all = area.selectionStart === 0 && area.selectionEnd === area.value.length;
    return { text: el.innerText, log: area.value, selected: all && document.activeElement === area };
  })`);
const stored = (key) => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);
const reopen = async () => {
  await game.reload();
  await pause(500);
};

try {
  await game.open('e2eb10');
  await evaluate(`localStorage.clear(); 0`);
  await reopen();
  const HUD = await run('return balance.HUD;');
  const { ERROR_LOG, ERROR_SCREEN, DEBUG } = await run(
    'return { ERROR_LOG: balance.ERROR_LOG, ERROR_SCREEN: balance.ERROR_SCREEN, DEBUG: balance.DEBUG };',
  );
  const screen = ERROR_SCREEN.labels;
  const { BUILD, label } = await run(`const { BUILD, buildLabel } = await import(url('/src/core/build.js'));
    return { BUILD, label: buildLabel() };`);
  const early = await evaluate(`window.__earlyErrors === null`);
  ok(
    BUILD.version === version &&
      /^[0-9a-f]{7}(-dirty)?$/.test(BUILD.commit) &&
      BUILD.release === false &&
      label === `v${version} · ${BUILD.commit}` &&
      early,
    `versione del server di sviluppo: ${JSON.stringify(BUILD)}, «${label}»; errori dell'avvio presi dal registro ${early}`,
  );

  // La versione sotto il riquadro delle impostazioni (aperte dal mondo), e nel titolo del pannello di sviluppo
  await gameTap(HUD.settingsGear.x, HUD.settingsGear.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  const menu = await labels('PauseMenu');
  const footer = menu.find((one) => one.text === label);
  const lowest = Math.max(...menu.filter((one) => one !== footer).map((one) => one.y));
  await shot('b10-1-impostazioni');
  await tapLabel(HUD.menu.labels.dev);
  const title = await evaluate(`document.querySelector('.tp-rotv_b')?.textContent.trim() ?? null`);
  const paneOpen = await paneShown();
  const { panel } = HUD.menu;
  await tapLabel(HUD.menu.labels.dev, (720 - panel.width) / 2 + panel.padding + 20);
  ok(
    footer !== undefined && footer.y > lowest && paneOpen && title === `${DEBUG.panelTitle} ${label}`,
    `impostazioni: «${footer?.text}» a y ${Math.round(footer?.y)}, sotto l'ultima scritta (${Math.round(lowest)}); pannello di sviluppo aperto ${paneOpen}, titolo «${title}»`,
  );
  await tapLabel(HUD.menu.labels.close);
  await until(`window.__game.scene.isActive('PauseMenu') === false`, 3);

  // Un errore di uno script di un'estensione del browser: nel registro, ma senza schermata, e il gioco va avanti
  await evaluate(
    `window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught Error: estensione', filename: 'chrome-extension://abc/inject.js', error: new Error('estensione') })); 0`,
  );
  await pause(400);
  const foreign = await overlays(screen.title);
  const foreignLog = (await stored(ERROR_LOG.storageKey)) ?? [];
  const running = await evaluate(`window.__game.loop.running`);
  ok(
    foreign.length === 0 && foreignLog.length === 1 && foreignLog[0].message === 'Error: estensione' && running,
    `errore di un'estensione: schermate ${foreign.length}, registro ${foreignLog.map((one) => one.message).join(', ')}, gioco che va ${running}`,
  );
  await evaluate(`localStorage.removeItem(${JSON.stringify(ERROR_LOG.storageKey)}); 0`);

  // Un errore lanciato dalla pagina: la schermata dell'errore, e la voce nel registro sul telefono
  const before = await evaluate('Date.now()');
  await evaluate(`setTimeout(() => { throw new Error('prova'); }); 0`);
  await pause(600);
  const shown = await overlays(screen.title);
  const log = (await stored(ERROR_LOG.storageKey)) ?? [];
  const entry = log[0] ?? {};
  await shot('b10-2-errore');
  ok(
    shown.length === 1 &&
      [screen.title, screen.text, label, screen.copy, screen.reload].every((text) => shown[0].text.includes(text)),
    `schermata dell'errore: ${shown.length}, con «${shown[0]?.text.split('\n').slice(0, 3).join(' | ')}»`,
  );
  ok(
    log.length === 1 &&
      entry.message === 'Error: prova' &&
      entry.stack?.includes('prova') &&
      entry.version === BUILD.version &&
      entry.commit === BUILD.commit &&
      entry.time >= before &&
      entry.time - before < 5000 &&
      ['World', 'WorldUI'].every((scene) => entry.scenes?.includes(scene)),
    `registro sul telefono: ${log.length} voce, «${entry.message}», versione ${entry.version} ${entry.commit}, ${entry.time - before} ms dopo, scene ${entry.scenes?.join(', ')}, stack ${entry.stack?.split('\n')[0]}`,
  );

  // Il gioco si è fermato, come dice la schermata (il ciclo dei frame non va più), e sotto non riceve tocchi:
  // Costruisci non apre il suo menu
  const stopped = await evaluate(`window.__game.loop.running === false`);
  await gameTap(HUD.world.buildButton.x, HUD.world.buildButton.y);
  const sheet = await evaluate(`window.__game.scene.getScene('WorldUI').sheet`);
  ok(sheet === null && stopped, `sotto la schermata: ciclo dei frame fermo ${stopped}, Costruisci apre ${JSON.stringify(sheet)}`);

  // Una promessa rifiutata: nel registro, senza una seconda schermata
  await evaluate(`Promise.reject(new Error('prova rifiutata')); 0`);
  await pause(600);
  const again = await overlays(screen.title);
  const twice = (await stored(ERROR_LOG.storageKey)) ?? [];
  ok(
    again.length === 1 && twice.length === 2 && twice[1].message === 'Error: prova rifiutata',
    `promessa rifiutata: schermate ${again.length}, registro ${twice.map((one) => one.message).join(', ')}`,
  );

  // Copia il registro: negli appunti, o selezionato da copiare a mano; la casella ha tutto il registro di adesso
  await tapElement('button', screen.copy);
  const copied = (await overlays(screen.title))[0];
  const note = [screen.copied, screen.copyHint].find((text) => copied.text.includes(text)) ?? null;
  const inBox = JSON.parse(copied.log);
  ok(
    (note === screen.copied || (note === screen.copyHint && copied.selected)) &&
      inBox.map((one) => one.message).join() === 'Error: prova,Error: prova rifiutata',
    `Copia il registro: «${note}» (selezionato ${copied.selected}), nella casella ${inBox.length} voci`,
  );

  // Ricarica: il gioco riparte senza schermata, e il registro resta
  await tapElement('button', screen.reload);
  await pause(3000);
  await hook();
  const restarted = await until(`window.__game?.scene.isActive('WorldUI') === true`, 10);
  await pause(500);
  const afterReload = await overlays(screen.title);
  const kept = (await stored(ERROR_LOG.storageKey)) ?? [];
  ok(
    restarted && afterReload.length === 0 && kept.length === 2,
    `Ricarica: mondo ${restarted}, schermate ${afterReload.length}, registro ${kept.length} voci`,
  );

  // Il pulsante del registro nel pannello di sviluppo: la scheda con il registro, che Svuota svuota
  await gameTap(HUD.settingsGear.x, HUD.settingsGear.y);
  await until(`window.__game.scene.isActive('PauseMenu') === true`, 3);
  await pause(300);
  await tapLabel(HUD.menu.labels.dev);
  const report = DEBUG.errorLog;
  await tapElement('.tp-btnv_b', report.button);
  const card = () =>
    evaluate(`(() => {
    const el = [...document.body.children].find((e) => e.textContent.startsWith(${JSON.stringify(report.labels.title)}));
    if (!el || getComputedStyle(el).display === 'none') return null;
    return { log: el.querySelector('textarea').value, text: el.innerText };
  })()`);
  const opened = await card();
  await shot('b10-3-registro');
  const listed = opened ? JSON.parse(opened.log) : [];
  const copyNote = [report.labels.copied, report.labels.copyHint].find((text) => opened?.text.includes(text));
  await tapElement('button', report.labels.clear);
  const emptied = await card();
  const gone = await evaluate(`localStorage.getItem(${JSON.stringify(ERROR_LOG.storageKey)}) === null`);
  await tapElement('button', report.labels.close);
  const closed = (await card()) === null;
  ok(
    listed.length === 2 &&
      copyNote !== undefined &&
      emptied?.log === '[]' &&
      emptied.text.includes(report.labels.cleared) &&
      gone &&
      closed,
    `pannello: scheda con ${listed.length} voci («${copyNote}»); Svuota: ${emptied?.log}, «${emptied?.text.includes(report.labels.cleared) ? report.labels.cleared : '?'}», sul telefono niente ${gone}; Chiudi ${closed}`,
  );
  await tapLabel(HUD.menu.labels.dev, (720 - panel.width) / 2 + panel.padding + 20);
  await tapLabel(HUD.menu.labels.close);

  // In console ci sono i due errori lanciati apposta, e nient'altro
  const thrown = game.errors.filter((text) => text.includes('prova'));
  game.errors.splice(0, game.errors.length, ...game.errors.filter((text) => !text.includes('prova')));
  ok(thrown.length === 2, `in console i due errori lanciati apposta: ${thrown.length}`);
} finally {
  await game.close();
}
