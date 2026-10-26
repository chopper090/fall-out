import { DEBUG } from '../config/balance.js';
import { now } from '../core/clock.js';
import { createEventBus } from '../core/events.js';
import { createBattle } from '../systems/battle.js';
import { endBattle, recordFrame, startReplay, watchReplay } from '../systems/replay.js';
import { copyText } from '../view/clipboard.js';
import { createCard, row, text, textBox } from './card.js';

// Le battaglie rigiocabili nelle build di sviluppo (systems/replay.js). Gli strumenti della battaglia, che la scena
// trova nel registro del gioco (battleTools): createBattle(loadout) crea la battaglia con il suo seme e il bus con il
// registro degli eventi events (debug/eventLog.js) e la registra; frame(deltaMs) segna ogni frame prima che la
// battaglia lo giochi; end(won) la finisce adesso, vinta o persa (il trucco del pannello), e lo registra. Finita, la
// battaglia va tra le ultime DEBUG.replay.keep sul telefono (se non c'è posto escono le più vecchie; se il telefono non
// le lascia scrivere restano quelle di questa pagina). Il pulsante in cima al pannello pane, sotto il registro degli
// errori, copia l'ultima, da rigiocare in node: npm run replay -- file.json. Con ?seed=N nell'indirizzo ogni battaglia
// ha il seme N, per le prove; senza, l'ora del gioco come nell'uscita
export function createReplays(pane, events) {
  const { keep, seedParam } = DEBUG.replay;
  const asked = new URLSearchParams(location.search).get(seedParam) ?? '';
  const fixedSeed = /^\d+$/.test(asked) ? Number(asked) : null;
  let kept = readReplays();
  let current = null;
  let battle = null;
  const store = (replay) => {
    kept = [...kept, replay].slice(-keep);
    writeReplays(kept);
  };
  addCopyButton(pane, () => kept.at(-1) ?? null);
  return {
    createBattle(loadout) {
      const seed = fixedSeed ?? now();
      current = startReplay(seed, loadout);
      events.watch(null);
      battle = createBattle(seed, createEventBus(events.tap), loadout);
      events.watch(battle);
      watchReplay(current, battle, store);
      return battle;
    },
    frame(deltaMs) {
      recordFrame(current, deltaMs);
    },
    end(won) {
      endBattle(battle, won, current);
    },
  };
}

// Il pulsante che apre una scheda sopra il gioco (debug/card.js) con l'ultima battaglia finita, last(), in JSON, e la
// copia subito negli appunti (fuori da https resta selezionata, da copiare a mano)
function addCopyButton(pane, last) {
  const { button, labels } = DEBUG.replay;
  const card = createCard();
  const close = () => {
    card.style.display = 'none';
    card.replaceChildren();
  };
  const show = () => {
    const replay = last();
    const area = textBox(replay === null ? '' : JSON.stringify(replay), true);
    const note = text(replay === null ? labels.empty : '');
    const copy = () => copyText(area, note, labels);
    card.replaceChildren(text(labels.title, true), area, note, row([[labels.copy, copy], [labels.close, close]]));
    card.style.display = 'flex';
    if (replay !== null) copy();
  };
  pane.addButton({ title: button, index: 1 }).on('click', show);
}

// Le battaglie tenute sul telefono, dalla più vecchia; nessuna se non si leggono o sono rovinate
function readReplays() {
  try {
    const list = JSON.parse(localStorage.getItem(DEBUG.replay.storageKey));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Scrive le battaglie list sul telefono; se non c'è posto ci riprova senza le più vecchie, una alla volta
function writeReplays(list) {
  for (let from = 0; from < list.length; from++) {
    try {
      localStorage.setItem(DEBUG.replay.storageKey, JSON.stringify(list.slice(from)));
      return;
    } catch {
      // Troppo grandi per il posto che c'è, o niente permesso: si riprova con meno
    }
  }
}
