import * as Phaser from 'phaser';
import { DEBUG, MISSION } from '../config/balance.js';
import { msToSeconds, secondsToMs } from '../core/time.js';
import { armyPower, bandWins, difficulty, levelPower } from '../systems/power.js';
import { reachedBoss } from '../systems/waves.js';

const SECONDS_PER_MINUTE = 60;

// Test delle partite di fila, il gate della Fase 3 (DEBUG.playtest). Ogni partita finita si segna da sola: esito,
// fin dove si è arrivati, durata, esercito, vita del capo, nemici passati, seme e ora. Sotto la schermata di fine
// una scheda chiede al volo le risposte alle domande; dopo l'ultima partita mostra il riepilogo da copiare. Le
// partite ricominciate a metà non contano, ma si contano a parte (abandoned): lasciarle può voler dire noia. Il
// registro si salva sul telefono e resta anche chiudendo il gioco. Dal pannello si spegne, si vede il riepilogo e
// si ricomincia
export function createPlaytest(game, pane) {
  const config = DEBUG.playtest;
  const { labels } = config;
  const status = { games: 0 };
  let log = load();
  let battle = null;
  let recorded = false;
  let view = null;
  const card = createCard();

  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const current = game.scene.getScene('Battle')?.battle;
    if (current === undefined) return;
    if (current !== battle) {
      const running = log.games.length < config.games && config.enabled;
      if (running && battle !== null && !battle.over && battle.ms > 0) {
        log.abandoned = (log.abandoned ?? 0) + 1;
        save(log);
      }
      battle = current;
      recorded = false;
      show(null);
    }
    if (!battle.over || recorded || !config.enabled) return;
    recorded = true;
    if (log.games.length >= config.games) {
      show('done');
      return;
    }
    log.games.push(entryOf(battle));
    save(log);
    show('ask');
  });

  const folder = pane.addFolder({ title: config.title, expanded: false });
  folder.addBinding(config, 'enabled', { label: labels.enabled }).on('change', () => show(view));
  folder.addBinding(status, 'games', { label: labels.played, readonly: true, format: (value) => value.toFixed(0) });
  folder.addButton({ title: labels.summary }).on('click', () => show('summary'));
  folder.addButton({ title: labels.newTest }).on('click', restartTest);

  function restartTest() {
    log = emptyLog();
    save(log);
    show(null);
  }

  // La scheda: le domande sull'ultima partita, il riepilogo o il test già finito; null la nasconde
  function show(next) {
    view = next;
    status.games = log.games.length;
    card.replaceChildren();
    // Spento, il test non mostra più le schede delle partite; il riepilogo dal pannello sì
    card.style.display = view === null || (!config.enabled && view !== 'summary') ? 'none' : 'flex';
    if (view === 'ask') fillAsk();
    else if (view === 'summary') fillSummary();
    else if (view === 'done') fillDone();
  }

  function fillAsk() {
    const entry = log.games[log.games.length - 1];
    card.append(text(`${config.title} · ${log.games.length} ${labels.of} ${config.games}`, true));
    for (const question of config.questions) {
      card.append(text(question.label));
      const choose = (index) => () => {
        entry.answers[question.id] = index;
        save(log);
        show('ask');
      };
      const chosen = entry.answers[question.id];
      card.append(row(question.options.map((option, index) => [option, choose(index), chosen === index])));
    }
    if (log.games.length === config.games) card.append(row([[labels.summary, () => show('summary')]]));
  }

  function fillSummary() {
    const area = document.createElement('textarea');
    area.readOnly = true;
    area.value = summaryText(log);
    const { textFont, textHeight, color } = config.card;
    Object.assign(area.style, { font: textFont, height: textHeight, color, background: 'transparent' });
    Object.assign(area.style, { width: '100%', boxSizing: 'border-box', resize: 'none' });
    const note = text('');
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(area.value);
        note.textContent = labels.copied;
      } catch {
        // Fuori da https (il telefono sul server di sviluppo) gli appunti non si possono scrivere
        area.focus();
        area.select();
        note.textContent = labels.copyHint;
      }
    };
    const buttons = [[labels.copy, copy], [labels.newTest, restartTest], [labels.close, () => show(null)]];
    card.append(area, note, row(buttons));
  }

  function fillDone() {
    card.append(text(`${labels.done}: ${log.games.length} ${labels.of} ${config.games}`, true));
    card.append(row([[labels.summary, () => show('summary')], [labels.newTest, restartTest]]));
  }
}

// Una partita finita: reached è l'ondata in cui è finita, null se è arrivata al boss
function entryOf({ seed, ms, mission, waves, army }) {
  const { leader } = army;
  return {
    seed,
    win: mission.completed,
    why: mission.completed ? null : leader.hp === 0 ? 'hero' : 'escaped',
    reached: reachedBoss(waves) ? null : waves.index + 1,
    seconds: Math.round(msToSeconds(ms)),
    army: army.size,
    leaderHp: leader.hp,
    leaderMaxHp: leader.maxHp,
    escaped: mission.escaped,
    endedAt: Date.now(),
    answers: {},
  };
}

// Riepilogo da copiare nella chat: quando si è giocato, la fascia promessa dallo schieramento, le vittorie, dove
// sono finite le partite perse e quante sono state lasciate a metà, le risposte contate e una riga per partita
function summaryText({ games, startedAt, abandoned = 0 }) {
  const { title, questions, labels } = DEBUG.playtest;
  const ours = armyPower();
  const theirs = levelPower();
  const band = difficulty(ours / theirs);
  const [from, to] = bandWins(band);
  const wins = games.filter((entry) => entry.win).length;
  const endings = new Map();
  for (const entry of games.filter((item) => !item.win)) {
    const where = place(entry);
    endings.set(where, (endings.get(where) ?? 0) + 1);
  }
  const lost = [...endings].map(([where, count]) => `${where}: ${count}`).join(', ');
  const lines = [
    `FALL-OUT · ${title}, ${when(games, startedAt)}: ${games.length} ${labels.of} ${DEBUG.playtest.games}`,
    `Schieramento: potenza ${Math.round(ours)} · nemici ${Math.round(theirs)} · «${band.label}», promette il ` +
      `${percent(from)}-${percent(to)} di vittorie`,
    `Vinte ${wins} su ${games.length}${lost ? ` · perse ${lost}` : ''} · ricominciate a metà: ${abandoned}`,
  ];
  for (const { id, label, options } of questions) {
    const counts = options.map((option, index) => `${option} ${games.filter((g) => g.answers[id] === index).length}`);
    const missing = games.filter((entry) => entry.answers[id] === undefined).length;
    lines.push(`${label} ${counts.join(' · ')}${missing > 0 ? ` · senza risposta ${missing}` : ''}`);
  }
  lines.push('');
  games.forEach((entry, index) => lines.push(`${index + 1}. ${entryLine(entry, questions)}`));
  return lines.join('\n');
}

function entryLine(entry, questions) {
  const reason = { hero: 'muore il capo', escaped: 'passano i nemici' }[entry.why];
  const result = entry.win ? 'vinta' : `persa ${place(entry)} (${reason})`;
  const minutes = Math.floor(entry.seconds / SECONDS_PER_MINUTE);
  const seconds = String(entry.seconds % SECONDS_PER_MINUTE).padStart(2, '0');
  const parts = [`${result} in ${minutes}:${seconds}`, `esercito ${entry.army}`];
  parts.push(`capo ${entry.leaderHp}/${entry.leaderMaxHp}`, `passati ${entry.escaped}/${MISSION.maxEscaped}`);
  parts.push(`seme ${entry.seed}`);
  for (const { id, short, options } of questions) parts.push(`${short}: ${options[entry.answers[id]] ?? '-'}`);
  return parts.join(' · ');
}

// Il giorno e le ore della prima e dell'ultima partita
function when(games, startedAt) {
  const first = games[0];
  const last = games[games.length - 1];
  const start = new Date(first ? first.endedAt - secondsToMs(first.seconds) : startedAt);
  const hour = (date) => date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('it-IT');
  return last ? `${day} dalle ${hour(start)} alle ${hour(new Date(last.endedAt))}` : day;
}

function place(entry) {
  return entry.reached === null ? 'al boss' : `all'ondata ${entry.reached}`;
}

function percent(share) {
  return `${Math.round(share * 100)}%`;
}

function createCard() {
  const { bottom, width, padding, radius, gap, background, color, font, zIndex } = DEBUG.playtest.card;
  const card = document.createElement('div');
  Object.assign(card.style, {
    position: 'fixed',
    display: 'none',
    flexDirection: 'column',
    gap,
    left: '50%',
    bottom,
    transform: 'translateX(-50%)',
    width,
    boxSizing: 'border-box',
    padding,
    borderRadius: radius,
    background,
    color,
    font,
    zIndex,
    touchAction: 'manipulation',
  });
  document.body.appendChild(card);
  return card;
}

function text(content, bold = false) {
  const { font, titleFont } = DEBUG.playtest.card;
  const line = document.createElement('div');
  line.textContent = content;
  line.style.font = bold ? titleFont : font;
  return line;
}

// Una fila di pulsanti larghi uguali: [scritta, azione, scelto]
function row(buttons) {
  const { gap, button: color, selected, buttonPadding, radius, font } = DEBUG.playtest.card;
  const line = document.createElement('div');
  Object.assign(line.style, { display: 'flex', gap });
  for (const [label, onTap, chosen] of buttons) {
    const button = document.createElement('button');
    button.textContent = label;
    Object.assign(button.style, {
      flex: '1',
      padding: buttonPadding,
      border: 'none',
      borderRadius: radius,
      background: chosen ? selected : color,
      color: DEBUG.playtest.card.color,
      font,
    });
    button.addEventListener('click', onTap);
    line.append(button);
  }
  return line;
}

function emptyLog() {
  return { version: DEBUG.playtest.version, startedAt: Date.now(), games: [] };
}

// Il registro salvato; se manca, è di un'altra versione o il browser non permette di leggerlo, se ne apre uno nuovo
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEBUG.playtest.storageKey));
    return saved?.version === DEBUG.playtest.version && Array.isArray(saved.games) ? saved : emptyLog();
  } catch {
    return emptyLog();
  }
}

function save(log) {
  try {
    localStorage.setItem(DEBUG.playtest.storageKey, JSON.stringify(log));
  } catch {
    // Salvataggio non permesso: il registro vale finché la pagina resta aperta
  }
}
