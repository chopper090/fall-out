import { SIM } from '../config/balance.js';
import { decimalText, fixedText, percentText } from '../core/format.js';
import { msToHours, msToMinutes } from '../core/time.js';
import { SOLDIER_TYPES } from '../data/units.js';
import { VILLAGE } from '../data/village.js';
import { average, table } from './report.js';

// I tipi di battaglia del diario della campagna (sim/campaign.js), come colonna e come nome di una battaglia
const KINDS = {
  normal: { column: 'normali', name: 'normale' },
  boss: { column: 'boss', name: 'boss' },
  double: { column: 'doppie', name: 'doppia' },
  triple: { column: 'triple', name: 'tripla' },
  challenge: { column: 'sfide', name: 'sfida' },
};
const ROAD_KINDS = ['normal', 'boss', 'double', 'triple'];
// Le risorse alla conquista, nell'ordine del profilo, come colonne
const RESOURCES = {
  rations: 'razioni',
  wood: 'legno',
  stone: 'pietra',
  gears: 'ingranaggi',
  circuits: 'circuiti',
  gems: 'gemme',
  dogTags: 'piastrine',
};

// Resoconto delle campagne del bot (sim/campaign.js playCampaign), in testo. Area per area: quante campagne la
// conquistano, i minuti per farlo (in media e dalla più svelta alla più lenta) e quanti ad aspettare le razioni, i
// soldati della caserma caduti e i minuti ad aspettare che tornino, le battaglie vinte su giocate per tipo e le perse
// di fila al massimo; poi come si cresce, alla conquista: rapporto di potenza e forza della squadra nelle battaglie
// della strada, villaggio, eroi, esercito della caserma per tipo e risorse. Poi ogni campagna con le sue ore e quanto
// ha aspettato (le razioni e i caduti), la media, e dove la campagna si inceppa (SIM.campaign.flags). areas: quante
// aree doveva conquistare ogni campagna; seconds: quanto ci ha messo il simulatore
export function formatCampaignReport({ campaigns, areas, seconds }) {
  const rows = byArea(campaigns, areas);
  const seeds = campaigns.map(({ seed }) => seed);
  const flags = campaignFlags(campaigns, rows);
  const buildings = Object.values(VILLAGE.buildings).map(({ name }) => name.toLowerCase());
  return [
    'FALL-OUT · campagna col bot',
    `Semi ${seeds.join(', ')} · fino all'area ${areas} · in ${fixedText(seconds, 0)} s`,
    '',
    'AREA PER AREA',
    ...timeTable(rows, campaigns.length),
    "minuti: dall'arrivo nell'area alla conquista, attese comprese; attese: minuti ad aspettare le razioni; caduti:",
    "soldati della caserma caduti nell'area; riaddestr.: minuti ad aspettare che tornino;",
    'battaglie: vinte su giocate, di tutte le campagne; perse di fila: il massimo, sempre su una casella sola',
    '',
    'CRESCITA ALLA CONQUISTA, IN MEDIA',
    ...growthTable(rows),
    'rapporto: la nostra potenza su quella del livello nelle battaglie della strada; forza: la nostra potenza',
    '(systems/power.js armyPower) nelle stesse battaglie; villaggio: livelli di',
    `${buildings.join('/')}; eroi: quanti schierati, con il loro livello, le stelle e il grado del potere;`,
    `esercito: soldati della caserma per tipo, ${Object.values(SOLDIER_TYPES)
      .map(({ label }) => label.toLowerCase())
      .join('/')}`,
    '',
    'CAMPAGNE',
    ...campaigns.map(campaignLine),
    totalLine(campaigns),
    '',
    'Dove la campagna si inceppa',
    ...(flags.length > 0 ? flags.map((flag) => `- ${flag}`) : ['- niente da segnalare: la campagna scorre']),
  ].join('\n');
}

// Per ogni area da 0 a count - 1 i diari delle campagne che l'hanno conquistata, ognuno con il suo seme
function byArea(campaigns, count) {
  return Array.from({ length: count }, (_, area) =>
    campaigns.flatMap(({ seed, areas }) => (areas[area] === undefined ? [] : [{ ...areas[area], seed }])),
  );
}

function timeTable(rows, total) {
  const kinds = Object.keys(KINDS);
  const header = ['Area', 'conquistata', 'minuti', 'da-a', 'attese', 'caduti', 'riaddestr.'];
  header.push(...kinds.map((kind) => KINDS[kind].column));
  header.push('perse di fila');
  const lines = rows.map((entries, area) => {
    const row = [String(area + 1), `${entries.length}/${total}`];
    if (entries.length === 0) return row;
    const minutes = entries.map(({ ms }) => msToMinutes(ms));
    row.push(
      fixedText(
        average(minutes, (value) => value),
        0,
      ),
    );
    row.push(`${fixedText(Math.min(...minutes), 0)}-${fixedText(Math.max(...minutes), 0)}`);
    row.push(
      fixedText(
        average(entries, ({ waitMs }) => msToMinutes(waitMs)),
        0,
      ),
      fixedText(
        average(entries, ({ fallen }) => fallen),
        0,
      ),
      fixedText(
        average(entries, ({ retrainMs }) => msToMinutes(retrainMs)),
        0,
      ),
    );
    for (const kind of kinds) row.push(battlesText(entries, kind));
    row.push(streakText(worstOf(entries).worst));
    return row;
  });
  return table(header, lines, `lrrrrrr${'r'.repeat(kinds.length)}l`);
}

function growthTable(rows) {
  const header = [
    'Area',
    'rapporto',
    'forza',
    'villaggio',
    'eroi',
    'livello',
    'stelle',
    'gradi',
    'esercito',
    ...Object.values(RESOURCES),
  ];
  const lines = rows.map((entries, area) => {
    const row = [String(area + 1)];
    if (entries.length === 0) return row;
    const heroes = entries.flatMap((entry) => entry.heroes);
    const levels = Object.keys(VILLAGE.buildings).map((id) => decimalText(average(entries, (e) => e.village[id])));
    row.push(
      fixedText(
        average(
          entries.flatMap((entry) => entry.ratios),
          (ratio) => ratio,
        ),
        2,
      ),
    );
    row.push(
      fixedText(
        average(
          entries.flatMap((entry) => entry.powers),
          (power) => power,
        ),
        0,
      ),
      levels.join('/'),
    );
    row.push(decimalText(average(entries, (entry) => entry.heroes.length)));
    row.push(
      fixedText(
        average(heroes, ({ level }) => level),
        1,
      ),
      fixedText(
        average(heroes, ({ stars }) => stars),
        1,
      ),
    );
    row.push(
      fixedText(
        average(heroes, ({ grade }) => grade),
        1,
      ),
    );
    row.push(
      Object.keys(SOLDIER_TYPES)
        .map((type) =>
          fixedText(
            average(entries, (e) => e.army[type]),
            0,
          ),
        )
        .join('/'),
    );
    for (const kind of Object.keys(RESOURCES))
      row.push(
        fixedText(
          average(entries, (e) => e.resources[kind]),
          0,
        ),
      );
    return row;
  });
  return table(header, lines, `lrrlrrrrl${'r'.repeat(Object.keys(RESOURCES).length)}`);
}

// Le battaglie del tipo kind vinte su giocate nei diari entries, - se non ce ne sono
function battlesText(entries, kind) {
  const { won, lost } = totals(entries, kind);
  return won + lost === 0 ? '-' : `${won}/${won + lost}`;
}

// Le battaglie del tipo kind vinte e perse in tutti i diari
function totals(diaries, kind) {
  const counts = diaries.map(({ battles }) => battles[kind] ?? { won: 0, lost: 0 });
  return { won: counts.reduce((sum, { won }) => sum + won, 0), lost: counts.reduce((sum, { lost }) => sum + lost, 0) };
}

function streakText({ losses, kind }) {
  return losses === 0 ? '0' : `${losses} ${KINDS[kind].name}`;
}

// Il diario con più perse di fila (a parità il primo)
function worstOf(entries) {
  return entries.reduce((worst, entry) => (entry.worst.losses > worst.worst.losses ? entry : worst));
}

// Una campagna: aree conquistate, ore e attese, battaglie della strada e sfide vinte su giocate, le perse di fila al
// massimo e dove; o dove si è bloccata
function campaignLine(campaign) {
  const { seed, areas, stuck, ms } = campaign;
  const diaries = stuck === null ? areas : [...areas, stuck];
  const road = ROAD_KINDS.map((kind) => totals(diaries, kind));
  const won = road.reduce((sum, count) => sum + count.won, 0);
  const played = road.reduce((sum, count) => sum + count.won + count.lost, 0);
  const challenge = totals(diaries, 'challenge');
  const time = `${fixedText(msToHours(ms), 1)} ore (attese ${percentText(waitedShare([campaign]))})`;
  const battles = `strada vinte ${won} su ${played}, sfide ${challenge.won} su ${challenge.won + challenge.lost}`;
  const worst = worstOf(diaries);
  const where = worst.worst.losses === 0 ? '' : ` (area ${worst.area + 1}, ${KINDS[worst.worst.kind].name})`;
  const streak = `perse di fila al massimo ${worst.worst.losses}${where}`;
  const head = stuck === null ? `fino all'area ${areas.length}` : `BLOCCATA nell'area ${stuck.area + 1}`;
  return `Seme ${seed}: ${head} in ${time}; ${battles}; ${streak}`;
}

function totalLine(campaigns) {
  const hours = campaigns.map(({ ms }) => msToHours(ms));
  const range = `da ${fixedText(Math.min(...hours), 1)} a ${fixedText(Math.max(...hours), 1)}`;
  const mean = fixedText(
    average(hours, (value) => value),
    1,
  );
  const stuck = campaigns.filter((campaign) => campaign.stuck !== null).length;
  const waits = `attese ${percentText(waitedShare(campaigns))} del tempo`;
  return `In media ${mean} ore a campagna, ${range}; ${waits}; bloccate ${stuck} su ${campaigns.length}`;
}

// Campagne bloccate; per area: più perse di fila di lossStreak, una campagna che ci mette troppo (la prima area oltre
// firstAreaMinutes, le altre oltre areaMinutes), attese oltre waitShare del tempo; e attese oltre waitShare di tutto
function campaignFlags(campaigns, rows) {
  const { lossStreak, firstAreaMinutes, areaMinutes, waitShare } = SIM.campaign.flags;
  const flags = campaigns.filter(({ stuck }) => stuck !== null).map(stuckFlag);
  rows.forEach((entries, area) => {
    if (entries.length === 0) return;
    const name = `Area ${area + 1}`;
    const { seed, worst } = worstOf(entries);
    if (worst.losses > lossStreak) {
      const where = `${KINDS[worst.kind].name}, seme ${seed}`;
      flags.push(`${name}: ${worst.losses} battaglie perse di fila (${where}), più di ${lossStreak}`);
    }
    const limit = area === 0 ? firstAreaMinutes : areaMinutes;
    const slowest = entries.reduce((slow, entry) => (entry.ms > slow.ms ? entry : slow));
    const minutes = msToMinutes(slowest.ms);
    if (minutes > limit) {
      flags.push(`${name}: lenta, ${fixedText(minutes, 0)} min nel seme ${slowest.seed} (al massimo ${limit})`);
    }
    const waited = waitedShare(entries);
    if (waited > waitShare) flags.push(`${name}: attese ${percentText(waited)} del tempo`);
  });
  const waited = waitedShare(campaigns);
  if (waited > waitShare) flags.push(`Tutta la campagna: attese ${percentText(waited)} del tempo`);
  return flags;
}

function stuckFlag({ seed, stuck, turns }) {
  const why =
    stuck.reason === 'losses'
      ? `${stuck.losses} battaglie perse di fila (${KINDS[stuck.kind].name})`
      : `non finisce in ${turns} giri`;
  return `Seme ${seed}: bloccata nell'area ${stuck.area + 1} dopo ${fixedText(msToMinutes(stuck.ms), 0)} min, ${why}`;
}

// La parte del tempo passata ad aspettare, le razioni e i caduti che si riaddestrano, in tutti i diari (o le campagne)
// list
function waitedShare(list) {
  const ms = list.reduce((sum, item) => sum + item.ms, 0);
  return ms > 0 ? list.reduce((sum, item) => sum + item.waitMs + item.retrainMs, 0) / ms : 0;
}
