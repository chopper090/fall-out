import { MISSION, SIM } from '../config/balance.js';
import { msToSeconds } from '../core/time.js';
import { WAVES } from '../data/waves.js';
import { bandWins, difficulty } from '../systems/power.js';

const SECONDS_PER_MINUTE = 60;

// Resoconto del simulatore, in testo. Prima il livello com'è: vittorie contro la promessa della sua fascia, e
// tratto per tratto quante partite ci arrivano e quante finiscono lì, come cambia l'esercito, quanto si perde e
// quanto si resta senza niente a tiro; sotto, dove la curva si rompe (SIM.flags). Poi, per ogni modo di cambiare
// la potenza, quanto si vince a ogni rapporto, dove la fascia non mantiene la promessa e a che rapporto si vince
// metà delle partite. points e results: un punto per riga, il primo è il livello com'è
export function formatReport({ points, results, sweeps, games, firstSeed, seconds }) {
  const perPoint = points.length > 1 ? `, ${games} a punto` : '';
  const lines = [
    'FALL-OUT · simulatore di bilanciamento',
    `${points.length * games} partite del bot${perPoint} (semi ${firstSeed}-${firstSeed + games - 1}), ` +
      `in ${decimal(seconds, 0)} s`,
    '',
    ...levelSection(results[0]),
  ];
  if (sweeps.length > 0) lines.push('', ...powerSection(points, results, sweeps));
  return lines.join('\n');
}

function levelSection(result) {
  const { games } = result;
  const wins = games.filter((game) => game.win).length;
  const lines = ["LIVELLO COM'È", `${powerLine(result)}: vinte ${winsText(wins, games.length)}`];
  const lost = games.filter((game) => !game.win);
  if (lost.length > 0) lines.push(`Perse ${lost.length}: ${reasons(lost)}`);
  const firstSeconds = msToSeconds(average(games, (game) => game.firstTargetMs ?? game.ms));
  lines.push(`Primo bersaglio a tiro dopo ${decimal(firstSeconds, 1)} s in media`, '');
  const segments = WAVES.map((_, index) => segmentStats(games, index));
  segments.push(segmentStats(games, WAVES.length));
  lines.push(...segmentTable(segments));
  const boss = segments[segments.length - 1];
  if (boss.count > 0) {
    lines.push(
      `Boss: ${decimal(boss.smashes, 1)} schiacciamenti in media, nelle partite vinte dura ` +
        `${decimal(boss.wonSeconds, 0)} s`,
    );
  }
  lines.push('', 'Dove la curva si rompe');
  const flags = curveFlags(segments, firstSeconds, games);
  lines.push(...(flags.length > 0 ? flags.map((flag) => `- ${flag}`) : ['- niente da segnalare: la curva tiene']));
  return lines;
}

// Misure medie di un tratto tra le partite che ci arrivano
function segmentStats(games, index) {
  const reached = games.filter((game) => game.segments[index] !== undefined);
  const mean = (key) => average(reached, (game) => game.segments[index][key]);
  const lost = reached.filter((game) => !game.win && game.endedIn === index);
  const won = reached.filter((game) => game.win);
  return {
    label: index < WAVES.length ? `Ondata ${index + 1}` : 'Boss',
    reached: reached.length / games.length,
    count: reached.length,
    lossRate: reached.length > 0 ? lost.length / reached.length : 0,
    lost,
    armyStart: mean('armyStart'),
    armyEnd: mean('armyEnd'),
    soldiersLost: mean('soldiersLost'),
    gateSoldiers: mean('gateSoldiers'),
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
  const header = ['Tratto', 'arrivate', 'perse lì', 'esercito', 'persi', 'cancelli', 'capo', 'eroi', 'passati'];
  header.push('scrigni', 'a vuoto', 'durata');
  const rows = segments.map((s) => {
    if (s.count === 0) return [s.label, '0%'];
    const army = `${Math.round(s.armyStart)} → ${Math.round(s.armyEnd)}`;
    const chests = `${decimal(s.chestsOpened, 1)}/${decimal(s.chestsGone, 1)}`;
    const gates = s.gateSoldiers === 0 ? '-' : `+${Math.round(s.gateSoldiers)}`;
    const row = [s.label, percent(s.reached), percent(s.lossRate), army, decimal(s.soldiersLost, 0), gates];
    row.push(decimal(s.leaderHpLost, 1), decimal(s.heroesLost, 1), decimal(s.escaped, 1), chests);
    row.push(`${decimal(s.idleSeconds, 1)} s`, `${decimal(s.seconds, 0)} s`);
    return row;
  });
  const notes = [
    'arrivate: partite che arrivano al tratto; perse lì: quelle che finiscono lì, su quelle arrivate;',
    'persi: soldati persi contro i nemici; cancelli: soldati presi; capo: vita persa dal capo; eroi: eroi caduti;',
    'scrigni: aperti/arrivati; a vuoto: secondi senza niente a tiro del fucile',
  ];
  return [...table(header, rows, 'lrrrrrrrrrrr'), ...notes];
}

function curveFlags(segments, firstSeconds, games) {
  const { lossJump, flatLoss, flatHurt, idleSeconds, firstTargetSeconds, bossSeconds } = SIM.flags;
  const flags = [];
  if (firstSeconds > firstTargetSeconds) {
    flags.push(`partenza lenta: il primo bersaglio arriva a tiro dopo ${decimal(firstSeconds, 1)} s`);
  }
  segments.forEach((s, index) => {
    if (s.count === 0) return;
    const before = segments[index - 1];
    if (before !== undefined && before.count > 0 && s.lossRate - before.lossRate >= lossJump) {
      const points = Math.round((s.lossRate - before.lossRate) * 100);
      flags.push(
        `${s.label}: salto di difficoltà, finisce qui il ${percent(s.lossRate)} delle partite che ci arrivano, ` +
          `${points} punti più che in ${lower(before.label)} (${reasons(s.lost)}); chi perde qui ci arriva con ` +
          `${decimal(carriedEscapes(s.lost, index), 1)} nemici già passati su ${MISSION.maxEscaped}`,
      );
    }
    const hurtPerMinute = (s.soldiersLost * SECONDS_PER_MINUTE) / s.seconds;
    if (index > 0 && s.lossRate < flatLoss && hurtPerMinute < flatHurt) {
      flags.push(
        `${s.label}: tratto piatto, non si perde quasi mai e l'esercito perde ${decimal(hurtPerMinute, 1)} ` +
          'soldati al minuto',
      );
    }
    if (s.idleSeconds > idleSeconds) {
      flags.push(`${s.label}: tempo morto, ${decimal(s.idleSeconds, 1)} s in media senza niente a tiro`);
    }
  });
  const boss = segments[segments.length - 1];
  const won = games.filter((game) => game.win).length;
  if (won > 0 && boss.wonSeconds < bossSeconds.min) {
    flags.push(`Boss: troppo breve, nelle partite vinte dura ${decimal(boss.wonSeconds, 1)} s: non è un momento`);
  } else if (won > 0 && boss.wonSeconds > bossSeconds.max) {
    flags.push(`Boss: troppo lungo, nelle partite vinte dura ${decimal(boss.wonSeconds, 1)} s: è un muro`);
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
    const wins = `${percent(m.rate)} (${percent(m.low)}-${percent(m.high)})`;
    const row = [`  ${m.label}`, decimal(m.ours, 0), decimal(m.theirs, 0), decimal(m.ratio, 2), m.band.label];
    row.push(`${percent(from)}-${percent(to)}`, wins, verdict);
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
    return `metà delle partite si vince a rapporto ${decimal(ratio, 2)} (la taratura vuole 1)`;
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
      `${sweep.label} ${m.label}: rapporto ${decimal(m.ratio, 2)}, «${m.band.label}» promette ` +
        `${percent(from)}-${percent(to)} ma si vince il ${percent(m.rate)}`,
    );
  }
  const rates = measured.map((m) => m.rate);
  if (Math.max(...rates) - Math.min(...rates) < SIM.flags.flatSweep) {
    const ratios = measured.map((m) => m.ratio);
    flags.push(
      `${sweep.label}: le vittorie restano tra il ${percent(Math.min(...rates))} e il ${percent(Math.max(...rates))} ` +
        `da un capo all'altro, mentre il rapporto va da ${decimal(Math.min(...ratios), 2)} a ` +
        `${decimal(Math.max(...ratios), 2)}: in battaglia non conta, nella potenza sì`,
    );
  }
  // Più potenza deve voler dire più vittorie: un punto più facile che vince chiaramente meno è fuori ordine
  for (let index = 1; index < measured.length; index += 1) {
    const easy = measured[index - 1];
    const hard = measured[index];
    if (easy.high < hard.low) {
      flags.push(
        `${sweep.label}: fuori ordine, ${hard.label} ha meno potenza di ${easy.label} ma vince di più ` +
          `(${percent(hard.rate)} contro ${percent(easy.rate)})`,
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
    `Potenza ${decimal(ours, 0)} · nemici ${decimal(theirs, 0)} · rapporto ${decimal(ratio, 2)}: ` +
    `«${band.label}», promette ${percent(from)}-${percent(to)} di vittorie`
  );
}

function winsText(wins, count) {
  const [low, high] = wilson(wins, count);
  return `${percent(wins / count)} (${percent(low)}-${percent(high)})`;
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

// Colonne allineate, ognuna a sinistra (l) o a destra (r) come dice align
function table(header, rows, align) {
  const cell = (row, column) => row[column] ?? '';
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => cell(row, column).length)));
  const fit = (text, column) => (align[column] === 'l' ? text.padEnd(widths[column]) : text.padStart(widths[column]));
  const line = (row) => header.map((_, column) => fit(cell(row, column), column)).join('  ').trimEnd();
  return [line(header), ...rows.map(line)];
}

function average(list, valueOf) {
  return list.length > 0 ? list.reduce((sum, item) => sum + valueOf(item), 0) / list.length : 0;
}

function decimal(value, digits) {
  return value.toFixed(digits).replace('.', ',');
}

function percent(share) {
  return `${Math.round(share * 100)}%`;
}

function lower(label) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}
