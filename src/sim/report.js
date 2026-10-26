import { MISSION, SIM } from '../config/balance.js';
import { fixedText, percentPoints, percentText } from '../core/format.js';
import { msToSeconds } from '../core/time.js';
import { bandWins, difficulty } from '../systems/power.js';

const SECONDS_PER_MINUTE = 60;

// Resoconto del simulatore, in testo. Prima il livello com'è: vittorie contro la promessa della sua fascia, e
// tratto per tratto quante partite ci arrivano e quante finiscono lì, come cambia l'esercito, quanto si perde e
// quanto si resta senza niente a tiro; sotto, dove la curva si rompe (SIM.flags). Poi, per ogni modo di cambiare
// la potenza, quanto si vince a ogni rapporto, dove la fascia non mantiene la promessa e a che rapporto si vince
// metà delle partite. points e results: un punto per riga, il primo è il livello com'è; plan: la durata della
// battaglia giocata (systems/waves.js battlePlan), con le sue ondate e il boss se c'è, e length il suo nome (null: la
// battaglia di partenza)
export function formatReport({ points, results, sweeps, games, firstSeed, seconds, plan, length }) {
  const perPoint = points.length > 1 ? `, ${games} a punto` : '';
  const lines = [
    'FALL-OUT · simulatore di bilanciamento',
    `${points.length * games} partite del bot${perPoint} (semi ${firstSeed}-${firstSeed + games - 1}), ` +
      `in ${fixedText(seconds, 0)} s`,
    '',
    ...levelSection(results[0], plan, length),
  ];
  if (sweeps.length > 0) lines.push('', ...powerSection(points, results, sweeps));
  return lines.join('\n');
}

function levelSection(result, plan, length) {
  const { games } = result;
  const wins = games.filter((game) => game.win).length;
  const ending = plan.boss ? 'e il boss' : 'senza boss';
  const title = `LIVELLO COM'È · durata ${length ?? 'di partenza'}: ${plan.waves} ondate ${ending}`;
  const lines = [title, `${powerLine(result)}: vinte ${winsText(wins, games.length)}`];
  const lost = games.filter((game) => !game.win);
  if (lost.length > 0) lines.push(`Perse ${lost.length}: ${reasons(lost)}`);
  const firstSeconds = msToSeconds(average(games, (game) => game.firstTargetMs ?? game.ms));
  lines.push(`Primo bersaglio a tiro dopo ${fixedText(firstSeconds, 1)} s in media`, '');
  const segments = Array.from({ length: plan.waves }, (_, index) => segmentStats(games, index, plan));
  if (plan.boss) segments.push(segmentStats(games, plan.waves, plan));
  lines.push(...segmentTable(segments));
  const boss = plan.boss ? segments[segments.length - 1] : null;
  if (boss !== null && boss.count > 0) {
    lines.push(
      `Boss: ${fixedText(boss.smashes, 1)} schiacciamenti in media, nelle partite vinte dura ` +
        `${fixedText(boss.wonSeconds, 0)} s`,
    );
  }
  lines.push('', 'Dove la curva si rompe');
  const flags = curveFlags(segments, firstSeconds, games, boss);
  lines.push(...(flags.length > 0 ? flags.map((flag) => `- ${flag}`) : ['- niente da segnalare: la curva tiene']));
  return lines;
}

// Misure medie di un tratto tra le partite che ci arrivano (dopo le ondate di plan, il boss)
function segmentStats(games, index, plan) {
  const reached = games.filter((game) => game.segments[index] !== undefined);
  const mean = (key) => average(reached, (game) => game.segments[index][key]);
  const lost = reached.filter((game) => !game.win && game.endedIn === index);
  const won = reached.filter((game) => game.win);
  return {
    label: index < plan.waves ? `Ondata ${index + 1}` : 'Boss',
    reached: reached.length / games.length,
    count: reached.length,
    lossRate: reached.length > 0 ? lost.length / reached.length : 0,
    lost,
    armyStart: mean('armyStart'),
    armyEnd: mean('armyEnd'),
    soldiersLost: mean('soldiersLost'),
    gateSoldiers: mean('gateSoldiers'),
    elites: mean('elites'),
    leaderHpLost: mean('leaderHpLost'),
    heroesLost: mean('heroesLost'),
    escaped: mean('escaped'),
    chestsOpened: mean('chestsOpened'),
    chestsGone: mean('chestsGone'),
    smashes: mean('smashes'),
    idleSeconds: msToSeconds(mean('idleMs')),
    seconds: msToSeconds(mean('ms')),
    wonSeconds: msToSeconds(average(won, (game) => game.segments[index].ms)),
  };
}

function segmentTable(segments) {
  const header = ['Tratto', 'arrivate', 'perse lì', 'esercito', 'persi', 'cancelli', 'élite', 'capo', 'eroi'];
  header.push('passati', 'scrigni', 'a vuoto', 'durata');
  const rows = segments.map((s) => {
    if (s.count === 0) return [s.label, '0%'];
    const army = `${Math.round(s.armyStart)} → ${Math.round(s.armyEnd)}`;
    const chests = `${fixedText(s.chestsOpened, 1)}/${fixedText(s.chestsGone, 1)}`;
    const gates = s.gateSoldiers === 0 ? '-' : `+${Math.round(s.gateSoldiers)}`;
    const elites = s.elites === 0 ? '-' : `+${fixedText(s.elites, 1)}`;
    const row = [s.label, percentText(s.reached), percentText(s.lossRate), army, fixedText(s.soldiersLost, 0), gates];
    row.push(elites, fixedText(s.leaderHpLost, 1), fixedText(s.heroesLost, 1), fixedText(s.escaped, 1), chests);
    row.push(`${fixedText(s.idleSeconds, 1)} s`, `${fixedText(s.seconds, 0)} s`);
    return row;
  });
  const notes = [
    'arrivate: partite che arrivano al tratto; perse lì: quelle che finiscono lì, su quelle arrivate;',
    'persi: soldati persi contro i nemici; cancelli: soldati presi; élite: avute dagli scrigni; capo: vita persa dal',
    'capo; eroi: eroi caduti;',
    'scrigni: aperti/arrivati; a vuoto: secondi senza niente a tiro del fucile',
  ];
  return [...table(header, rows, 'lrrrrrrrrrrrr'), ...notes];
}

// boss: il tratto del boss, null se la battaglia non ce l'ha
function curveFlags(segments, firstSeconds, games, boss) {
  const { lossJump, flatLoss, flatHurt, idleSeconds, firstTargetSeconds, bossSeconds } = SIM.flags;
  const flags = [];
  if (firstSeconds > firstTargetSeconds) {
    flags.push(`partenza lenta: il primo bersaglio arriva a tiro dopo ${fixedText(firstSeconds, 1)} s`);
  }
  segments.forEach((s, index) => {
    if (s.count === 0) return;
    const before = segments[index - 1];
    if (before !== undefined && before.count > 0 && s.lossRate - before.lossRate >= lossJump) {
      const points = percentPoints(s.lossRate - before.lossRate);
      flags.push(
        `${s.label}: salto di difficoltà, finisce qui il ${percentText(s.lossRate)} delle partite che ci arrivano, ` +
          `${points} punti più che in ${lower(before.label)} (${reasons(s.lost)}); chi perde qui ci arriva con ` +
          `${fixedText(carriedEscapes(s.lost, index), 1)} nemici già passati su ${MISSION.maxEscaped}`,
      );
    }
    const hurtPerMinute = (s.soldiersLost * SECONDS_PER_MINUTE) / s.seconds;
    if (index > 0 && s.lossRate < flatLoss && hurtPerMinute < flatHurt) {
      flags.push(
        `${s.label}: tratto piatto, non si perde quasi mai e l'esercito perde ${fixedText(hurtPerMinute, 1)} ` +
          'soldati al minuto',
      );
    }
    if (s.idleSeconds > idleSeconds) {
      flags.push(`${s.label}: tempo morto, ${fixedText(s.idleSeconds, 1)} s in media senza niente a tiro`);
    }
  });
  if (boss === null) return flags;
  const won = games.filter((game) => game.win).length;
  if (won > 0 && boss.wonSeconds < bossSeconds.min) {
    flags.push(`Boss: troppo breve, nelle partite vinte dura ${fixedText(boss.wonSeconds, 1)} s: non è un momento`);
  } else if (won > 0 && boss.wonSeconds > bossSeconds.max) {
    flags.push(`Boss: troppo lungo, nelle partite vinte dura ${fixedText(boss.wonSeconds, 1)} s: è un muro`);
  }
  return flags;
}

function powerSection(points, results, sweeps) {
  const lines = ['VITTORIE PER RAPPORTO DI POTENZA'];
  const flags = [];
  for (const sweep of sweeps) {
    const rows = [{ value: sweep.unit === '+' ? 0 : 1, result: results[0] }];
    points.forEach((point, index) => {
      if (point.sweep === sweep.id) rows.push({ value: point.value, result: results[index] });
    });
    const measured = rows.map(({ value, result }) => measure(sweep, value, result));
    measured.sort((a, b) => b.ratio - a.ratio);
    lines.push('', sweep.label, ...sweepTable(measured), `  ${halfLine(measured)}`);
    flags.push(...sweepFlags(sweep, measured));
  }
  lines.push('', 'Dove la potenza sbaglia');
  const none = ['- niente da segnalare: ogni fascia mantiene'];
  lines.push(...(flags.length > 0 ? flags.map((flag) => `- ${flag}`) : none));
  return lines;
}

// Un punto: il suo rapporto e la sua fascia, le vittorie con il loro intervallo di confidenza e se stanno nella
// promessa della fascia (verdict: 0 sì, 1 si vince di più, -1 di meno)
function measure(sweep, value, { ours, theirs, games }) {
  const ratio = ours / theirs;
  const band = difficulty(ratio);
  const wins = games.filter((game) => game.win).length;
  const [low, high] = wilson(wins, games.length);
  const [from, to] = bandWins(band);
  const verdict = low > to ? 1 : high < from ? -1 : 0;
  const label = `${sweep.unit}${String(value).replace('.', ',')}`;
  return { label, ours, theirs, ratio, band, rate: wins / games.length, low, high, verdict };
}

function sweepTable(measured) {
  const header = ['  valore', 'potenza', 'nemici', 'rapporto', 'fascia', 'promette', 'vinte', ''];
  const rows = measured.map((m) => {
    const [from, to] = bandWins(m.band);
    const verdict = m.verdict === 0 ? 'sì' : m.verdict > 0 ? 'no, più facile' : 'no, più difficile';
    const wins = `${percentText(m.rate)} (${percentText(m.low)}-${percentText(m.high)})`;
    const row = [`  ${m.label}`, fixedText(m.ours, 0), fixedText(m.theirs, 0), fixedText(m.ratio, 2), m.band.label];
    row.push(`${percentText(from)}-${percentText(to)}`, wins, verdict);
    return row;
  });
  return table(header, rows, 'lrrrlrrl');
}

// Rapporto a cui si vince metà delle partite, tra i due punti che stanno a cavallo del 50%
function halfLine(measured) {
  for (let index = 1; index < measured.length; index += 1) {
    const easy = measured[index - 1];
    const hard = measured[index];
    if (easy.rate < 0.5 || hard.rate >= 0.5) continue;
    const ratio = hard.ratio + ((easy.ratio - hard.ratio) * (0.5 - hard.rate)) / (easy.rate - hard.rate);
    return `metà delle partite si vince a rapporto ${fixedText(ratio, 2)} (la taratura vuole 1)`;
  }
  const side = measured.every((m) => m.rate >= 0.5) ? 'sopra' : 'sotto';
  return `si resta sempre ${side} la metà delle vittorie`;
}

function sweepFlags(sweep, measured) {
  const flags = [];
  for (const m of measured) {
    if (m.verdict === 0) continue;
    const [from, to] = bandWins(m.band);
    flags.push(
      `${sweep.label} ${m.label}: rapporto ${fixedText(m.ratio, 2)}, «${m.band.label}» promette ` +
        `${percentText(from)}-${percentText(to)} ma si vince il ${percentText(m.rate)}`,
    );
  }
  const rates = measured.map((m) => m.rate);
  if (Math.max(...rates) - Math.min(...rates) < SIM.flags.flatSweep) {
    const ratios = measured.map((m) => m.ratio);
    flags.push(
      `${sweep.label}: le vittorie restano tra il ${percentText(Math.min(...rates))} e il ` +
        `${percentText(Math.max(...rates))} da un capo all'altro, mentre il rapporto va da ` +
        `${fixedText(Math.min(...ratios), 2)} a ${fixedText(Math.max(...ratios), 2)}: in battaglia non conta, ` +
        'nella potenza sì',
    );
  }
  // Più potenza deve voler dire più vittorie: un punto più facile che vince chiaramente meno è fuori ordine
  for (let index = 1; index < measured.length; index += 1) {
    const easy = measured[index - 1];
    const hard = measured[index];
    if (easy.high < hard.low) {
      flags.push(
        `${sweep.label}: fuori ordine, ${hard.label} ha meno potenza di ${easy.label} ma vince di più ` +
          `(${percentText(hard.rate)} contro ${percentText(easy.rate)})`,
      );
    }
  }
  return flags;
}

function powerLine({ ours, theirs }) {
  const ratio = ours / theirs;
  const band = difficulty(ratio);
  const [from, to] = bandWins(band);
  return (
    `Potenza ${fixedText(ours, 0)} · nemici ${fixedText(theirs, 0)} · rapporto ${fixedText(ratio, 2)}: ` +
    `«${band.label}», promette ${percentText(from)}-${percentText(to)} di vittorie`
  );
}

function winsText(wins, count) {
  const [low, high] = wilson(wins, count);
  return `${percentText(wins / count)} (${percentText(low)}-${percentText(high)})`;
}

// I nemici passati si sommano su tutto il livello: quanti ne avevano già lasciati passare, in media, le partite
// perse nel tratto index
function carriedEscapes(lost, index) {
  return average(lost, (game) => game.segments.slice(0, index).reduce((sum, s) => sum + (s?.escaped ?? 0), 0));
}

// Come finiscono le partite perse: muore il capo, passano troppi nemici, non finiscono in tempo
function reasons(lost) {
  const names = { hero: 'muore il capo', escaped: 'passano i nemici', time: 'non finisce' };
  return Object.entries(names)
    .map(([why, name]) => [name, lost.filter((game) => game.why === why).length])
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name} ${count}`)
    .join(', ');
}

// Intervallo di confidenza di Wilson per wins vittorie su count partite
function wilson(wins, count) {
  if (count === 0) return [0, 1];
  const z = SIM.flags.confidenceZ;
  const rate = wins / count;
  const z2n = (z * z) / count;
  const center = (rate + z2n / 2) / (1 + z2n);
  const half = (z * Math.sqrt((rate * (1 - rate)) / count + z2n / (4 * count))) / (1 + z2n);
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// Colonne allineate, ognuna a sinistra (l) o a destra (r) come dice align (anche per sim/campaignReport.js)
export function table(header, rows, align) {
  const cell = (row, column) => row[column] ?? '';
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => cell(row, column).length)));
  const fit = (text, column) => (align[column] === 'l' ? text.padEnd(widths[column]) : text.padStart(widths[column]));
  const line = (row) => header.map((_, column) => fit(cell(row, column), column)).join('  ').trimEnd();
  return [line(header), ...rows.map(line)];
}

// La media di valueOf sugli elementi di list, 0 se è vuota
export function average(list, valueOf) {
  return list.length > 0 ? list.reduce((sum, item) => sum + valueOf(item), 0) / list.length : 0;
}

function lower(label) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}
