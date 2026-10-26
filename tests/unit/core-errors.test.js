import { test } from 'node:test';
import { checker } from '../support/check.js';
import { ERROR_LOG } from '../../src/config/balance.js';
import { BUILD } from '../../src/core/build.js';
import { resetClock } from '../../src/core/clock.js';
import {
  clearErrors,
  errorEntries,
  errorLogText,
  logError,
  setEventSource,
  startErrorLog,
} from '../../src/core/errorLog.js';

// Uno storage finto al posto di quello del browser, come nelle prove del salvataggio (con removeItem), e un
// interruttore per farlo rifiutare come in navigazione privata
const storage = { items: new Map(), broken: false };
const refuse = () => {
  if (storage.broken) throw new Error('storage negato');
};
globalThis.localStorage = {
  getItem(key) {
    refuse();
    return storage.items.has(key) ? storage.items.get(key) : null;
  },
  setItem(key, value) {
    refuse();
    storage.items.set(key, String(value));
  },
  removeItem(key) {
    refuse();
    storage.items.delete(key);
  },
};
const REAL = 1_800_000_000_000;
const messages = (list) => list.map((entry) => entry.message);
// Un evento della finestra (type) con i suoi campi, come quelli del browser
const fire = (target, type, fields) => target.dispatchEvent(Object.assign(new Event(type), fields));

// Il registro tiene gli ultimi ERROR_LOG.size errori, i più vecchi escono; ogni voce ha l'ora del gioco, il messaggio
// con il tipo dell'errore, lo stack, la versione, il commit e le scene attive, ed è scritta sul telefono così com'è
test('Registro degli errori: gli ultimi, con ora, versione e scene, scritti sul telefono', (t) => {
  const check = checker(t);
  t.mock.method(Date, 'now', () => REAL);
  resetClock();
  storage.items.clear();
  clearErrors();
  const total = ERROR_LOG.size + 3;
  for (let i = 1; i <= total; i++) logError(new Error(`errore ${i}`), '', ['World', 'WorldUI']);
  logError(new TypeError('non è una funzione'), 'Uncaught TypeError: non è una funzione', ['Battle']);
  const list = errorEntries();
  const [first] = list;
  const last = list.at(-1);
  const stored = JSON.parse(storage.items.get(ERROR_LOG.storageKey));
  check(
    `registro: ${total + 1} errori, ne restano ${list.length} (dal «${first.message}» al «${last.message}»); ora +${first.time - REAL} ms, versione ${first.version} ${first.commit}, scene ${first.scenes.join(', ')}, stack ${first.stack.split('\n')[0]}; sul telefono uguale ${JSON.stringify(stored) === JSON.stringify(list)}`,
    list.length === ERROR_LOG.size &&
      first.message === 'Error: errore 5' &&
      last.message === 'TypeError: non è una funzione' &&
      last.scenes.join() === 'Battle' &&
      first.time === REAL &&
      first.version === BUILD.version &&
      first.commit === BUILD.commit &&
      first.scenes.join() === 'World,WorldUI' &&
      first.stack.startsWith('Error: errore 5') &&
      JSON.stringify(stored) === JSON.stringify(list) &&
      JSON.stringify(JSON.parse(errorLogText())) === JSON.stringify(list),
  );
  clearErrors();
  check(
    `svuotato: ${errorEntries().length} voci, sul telefono ${storage.items.has(ERROR_LOG.storageKey) ? 'ancora' : 'niente'}`,
    errorEntries().length === 0 && !storage.items.has(ERROR_LOG.storageKey),
  );
  check.done();
});

// Se il browser non lascia leggere né scrivere, niente si rompe e valgono gli errori di questa pagina; tornato il
// permesso, il registro torna quello sul telefono. Un registro rovinato sul telefono vale vuoto e si riscrive
test('Registro degli errori: senza il permesso di salvare, e rovinato, non si rompe', (t) => {
  const check = checker(t);
  storage.items.clear();
  storage.broken = true;
  let threw = false;
  try {
    clearErrors();
    logError(new Error('primo'));
    logError(new Error('secondo'));
  } catch {
    threw = true;
  }
  const refused = messages(errorEntries());
  const text = messages(JSON.parse(errorLogText()));
  storage.broken = false;
  logError(new Error('terzo'));
  const back = messages(errorEntries());
  check(
    `senza permesso: eccezioni ${threw}, voci ${refused.join(', ')} (nel testo da copiare ${text.join(', ')}); con il permesso di nuovo: ${back.join(', ')}`,
    !threw &&
      refused.join() === 'Error: primo,Error: secondo' &&
      text.join() === refused.join() &&
      back.join() === 'Error: terzo',
  );
  storage.items.set(ERROR_LOG.storageKey, '{rotto');
  const broken = errorEntries().length;
  logError(new Error('dopo'));
  const rewritten = messages(JSON.parse(storage.items.get(ERROR_LOG.storageKey)));
  check(
    `registro rovinato: ${broken} voci; dopo un errore sul telefono ${rewritten.join(', ')}`,
    broken === 0 && rewritten.join() === 'Error: dopo',
  );
  check.done();
});

// startErrorLog prende prima gli errori dell'avvio (tenuti da index.html, senza scene), poi ascolta la finestra: le
// eccezioni non prese (anche di qualcosa che non è un Error) e le promesse rifiutate, ognuna con le scene attive e
// passata a onError. Se le scene non si leggono (il gioco non c'è ancora) la voce non ne ha, e niente si rompe
test("Registro degli errori: ascolta la finestra e prende gli errori dell'avvio", (t) => {
  const check = checker(t);
  storage.items.clear();
  clearErrors();
  const target = new EventTarget();
  target.__earlyErrors = [{ error: new Error('presto'), text: 'Uncaught Error: presto', time: 123 }];
  const seen = [];
  startErrorLog({ target, scenes: () => ['Battle', 'BattleUI'], onError: (entry) => seen.push(entry) });
  const taken = target.__earlyErrors === null;
  fire(target, 'error', { error: new Error('prova'), message: 'Uncaught Error: prova' });
  fire(target, 'error', { error: 42, message: 'Uncaught 42' });
  fire(target, 'unhandledrejection', { reason: 'motivo' });
  const early = seen[0];
  check(
    `avvio: preso ${taken}, «${early?.message}» alle ${early?.time} con ${early?.scenes.length} scene; poi ${seen
      .slice(1)
      .map((entry) => `«${entry.message}» (${entry.scenes.join(', ')}, stack ${entry.stack === null ? 'no' : 'sì'})`)
      .join(', ')}; nel registro ${errorEntries().length}`,
    taken &&
      seen.length === 4 &&
      early.message === 'Error: presto' &&
      early.time === 123 &&
      early.scenes.length === 0 &&
      messages(seen.slice(1)).join() === 'Error: prova,Uncaught 42,motivo' &&
      seen.slice(1).every((entry) => entry.scenes.join() === 'Battle,BattleUI') &&
      seen[1].stack !== null &&
      seen[3].stack === null &&
      errorEntries().length === 4,
  );
  const unborn = new EventTarget();
  const late = [];
  const scenes = () => {
    throw new ReferenceError("il gioco non c'è ancora");
  };
  startErrorLog({ target: unborn, scenes, onError: (entry) => late.push(entry) });
  fire(unborn, 'error', { error: new Error('nascita'), message: 'Uncaught Error: nascita' });
  check(
    `senza le scene (il gioco non c'è ancora): ${late.length} voce «${late[0]?.message}» con ${late[0]?.scenes.length} scene`,
    late.length === 1 && late[0].message === 'Error: nascita' && late[0].scenes.length === 0,
  );
  check.done();
});

// Con il registro degli eventi della battaglia (B11, nelle build di sviluppo) ogni voce ha anche gli ultimi eventi,
// scritti sul telefono con il resto; se non si leggono la voce ne ha nessuno e niente si rompe; senza registro le voci
// non ne hanno
test('Registro degli errori: con il registro degli eventi, ogni voce ha gli ultimi eventi della battaglia', (t) => {
  const check = checker(t);
  storage.items.clear();
  clearErrors();
  const events = [[120, 'enemyHit', { damage: 2.5 }], [121, 'steerEnd']];
  setEventSource(() => events);
  const entry = logError(new Error('con gli eventi'));
  const stored = JSON.parse(storage.items.get(ERROR_LOG.storageKey)).at(-1);
  setEventSource(() => {
    throw new Error('registro rotto');
  });
  let threw = false;
  let broken = null;
  try {
    broken = logError(new Error('registro degli eventi rotto'));
  } catch {
    threw = true;
  }
  setEventSource(null);
  const without = logError(new Error('senza'));
  check(
    `eventi nella voce ${JSON.stringify(entry.events)}, sul telefono uguali ${JSON.stringify(stored.events) === JSON.stringify(events)}; registro rotto: eccezioni ${threw}, eventi ${JSON.stringify(broken?.events)}; senza registro: eventi ${'events' in without}`,
    JSON.stringify(entry.events) === JSON.stringify(events) &&
      JSON.stringify(stored.events) === JSON.stringify(events) &&
      !threw &&
      broken.events.length === 0 &&
      !('events' in without),
  );
  clearErrors();
  check.done();
});
