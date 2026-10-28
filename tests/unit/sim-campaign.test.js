import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checker } from '../support/check.js';
import { fixedText } from '../../src/core/format.js';
import { msToMinutes, msToSeconds } from '../../src/core/time.js';
import { STARTING_LOADOUT } from '../../src/data/loadout.js';
import { VILLAGE } from '../../src/data/village.js';
import { ROAD_TILES, conqueredAreas } from '../../src/meta/road.js';
import { canPlace, canUpgrade, lockOf, nextGoal } from '../../src/meta/village.js';
import { playCampaign } from '../../src/sim/campaign.js';
import { formatCampaignReport } from '../../src/sim/campaignReport.js';
import { playBattle, playGame } from '../../src/sim/game.js';

// Il simulatore della campagna (sim/campaign.js, npm run sim -- --campagna): il bot gioca il meta-gioco con le azioni
// del gioco e un orologio finto; qui la prima area con un seme, il comando e il resoconto
const MINUTE = 60000;
const repo = fileURLToPath(new URL('../../', import.meta.url));
const campaign = playCampaign(1, 1);
const yes = (value) => (value ? 'sì' : 'no');

// Le battaglie del diario, vinte e giocate
function battleCount({ battles }) {
  const counts = Object.values(battles);
  const won = counts.reduce((sum, count) => sum + count.won, 0);
  return { won, played: counts.reduce((sum, count) => sum + count.won + count.lost, 0) };
}

test('Campagna col bot: la prima area con un seme, giocata con le azioni del gioco', (t) => {
  const check = checker(t);
  const { areas, stuck, profile } = campaign;
  const [area] = areas;
  const { won, played } = battleCount(area);
  const boss = ROAD_TILES.filter((tile) => tile.area === 0).at(-1);
  const conquered = conqueredAreas(profile.road);
  check(
    `prima area col bot, seme 1: conquistata in ${Math.round(msToMinutes(area.ms))} min, battaglie vinte ${won} su ` +
      `${played} (il profilo ne conta ${profile.stats.won} su ${profile.stats.played}), sul boss ${profile.road.at} ` +
      `(${boss.index}) battuto ${yes(profile.road.done)}, aree conquistate ${conquered}`,
    stuck === null &&
      areas.length === 1 &&
      profile.stats.played === played &&
      profile.stats.won === won &&
      profile.road.at === boss.index &&
      profile.road.done &&
      conquered === 1,
  );
  const ids = Object.keys(VILLAGE.buildings);
  const building = (id) => profile.village.sites.some((site) => site.building === id);
  const built = ids.filter((id) => profile.village.levels[id] > 0 || building(id));
  // Il premio della conquista arriva con l'ultima battaglia: il prossimo obiettivo, se si paga già, parte al turno dopo
  const goal = nextGoal(profile);
  const next = goal !== null && profile.village.levels[goal.building] === 0 && canUpgrade(profile, goal.building);
  // Quelli che si potevano costruire: tutti tranne quelli che il centro città tiene ancora fermi al livello 0
  const buildable = ids.filter((id) => profile.village.levels[id] > 0 || lockOf(profile, id) === null);
  const { positions } = profile.village;
  const fits = built.every((id) => positions[id] !== null && canPlace(positions, id, positions[id], conquered));
  const lineup = profile.lineup.filter((id) => id !== null);
  check(
    `villaggio ${ids.map((id) => profile.village.levels[id]).join('/')} con ${built.length} edifici messi nel ` +
      `territorio vero: ${yes(fits)}, ${next ? `${goal.building} pronto da mettere` : 'nessuno pronto da mettere'}; ` +
      `${lineup.length} eroi schierati (${lineup.join(', ')}), come nel diario: ${area.heroes.map(({ id }) => id).join(', ')}`,
    built.length + (next ? 1 : 0) === buildable.length &&
      fits &&
      lineup.join() === area.heroes.map(({ id }) => id).join(),
  );
  check.done();
});

test('Campagna col bot: npm run sim -- --campagna gioca in un processo suo la stessa campagna, con lo stesso seme', (t) => {
  const check = checker(t);
  const run = (...args) => spawnSync(process.execPath, ['src/sim/run.js', '--campagna', ...args], { cwd: repo });
  const played = run('--aree', '1', '--semi', '1');
  const timeless = (text) => text.replace(/ · in \d+ s$/m, '').trimEnd();
  const expected = formatCampaignReport({ campaigns: [campaign], areas: 1, seconds: 0 });
  const output = played.stdout.toString();
  const seedLine = output.split('\n').find((line) => line.startsWith('Seme 1:')) ?? '(nessuna)';
  check(
    `il comando dà lo stesso resoconto: ${seedLine}`,
    played.status === 0 && timeless(output) === timeless(expected),
  );
  const wrong = run('--aree', '0');
  const message = wrong.stderr.toString().match(/--aree va da 1 a \d+/)?.[0] ?? '(nessun messaggio)';
  check(`un numero di aree sbagliato si rifiuta: ${message}`, wrong.status !== 0 && message !== '(nessun messaggio)');
  check.done();
});

// Revisione. Anche per il livello, partite e seme che non sono numeri interi da 1 in su si rifiutano, invece di un
// resoconto di NaN partite che dice che va tutto bene
test('Simulatore: partite e seme sbagliati si rifiutano', (t) => {
  const check = checker(t);
  const run = (...args) => spawnSync(process.execPath, ['src/sim/run.js', '--solo-livello', ...args], { cwd: repo });
  const cases = [
    ['--partite', 'abc'],
    ['--partite', '0'],
    ['--partite', '2.5'],
    ['--seme', 'x'],
    ['--seme', '0'],
  ];
  const results = cases.map((args) => {
    const done = run(...args);
    return {
      args: args.join(' '),
      status: done.status,
      message: done.stderr.toString().match(/Error: (--\S+ va da 1 a \S+)/)?.[1],
    };
  });
  check(
    `rifiutati: ${results.map((r) => `${r.args} → ${r.message ?? `uscita ${r.status}`}`).join('; ')}`,
    results.every((r) => r.status !== 0 && r.message !== undefined),
  );
  check.done();
});

test('Campagna col bot: playBattle gioca la stessa battaglia del bot del simulatore', (t) => {
  const check = checker(t);
  const seeds = [1, 2, 3];
  const pairs = seeds.map((seed) => [playBattle(seed, STARTING_LOADOUT), playGame(seed)]);
  const seconds = (ms) => fixedText(msToSeconds(ms), 1);
  const text = pairs.map(([battle, game], index) => {
    const outcome = `${yes(battle.mission.completed)}/${yes(game.win)}`;
    return `seme ${seeds[index]} vinta ${outcome} in ${seconds(battle.ms)}/${seconds(game.ms)} s`;
  });
  check(
    `stessi semi, stesse battaglie (playBattle/playGame): ${text.join('; ')}`,
    pairs.every(([battle, game]) => battle.over && battle.mission.completed === game.win && battle.ms === game.ms),
  );
  check.done();
});

// Il diario di un'area finto (come sim/campaign.js openArea), conquistata in minutes minuti
function diary(area, minutes, { wait = 0, worst = { losses: 0, kind: null }, battles = null } = {}) {
  return {
    area,
    startMs: 0,
    ms: minutes * MINUTE,
    waitMs: wait * MINUTE,
    battles: battles ?? { normal: { won: 1, lost: 0 }, boss: { won: 1, lost: worst.losses } },
    powers: [120, 130],
    ratios: [1.5, 2.5],
    worst,
    village: { center: 1, lodge: 0, farm: 2, barracks: 1, forge: 0 },
    heroes: [
      { id: 'leader', level: 3, stars: 1, grade: 1 },
      { id: 'sniper', level: 2, stars: 2, grade: 3 },
    ],
    resources: { rations: 4, wood: 18, stone: 12, gears: 5, circuits: 1, gems: 1, dogTags: 2 },
  };
}

test('Resoconto della campagna: area per area, ogni campagna e dove si inceppa', (t) => {
  const check = checker(t);
  const slow = diary(0, 40, { wait: 30, worst: { losses: 13, kind: 'normal' } });
  const stuck = { ...diary(1, 20), reason: 'losses', losses: 50, kind: 'boss' };
  const campaigns = [
    { seed: 1, areas: [slow, diary(1, 50)], stuck: null, ms: 90 * MINUTE, waitMs: 30 * MINUTE },
    { seed: 2, areas: [diary(0, 10)], stuck, ms: 30 * MINUTE, waitMs: 0 },
  ];
  const report = formatCampaignReport({ campaigns, areas: 2, seconds: 3 }).split('\n');
  const flags = report.slice(report.indexOf('Dove la campagna si inceppa') + 1);
  const expected = [
    "- Seme 2: bloccata nell'area 2 dopo 20 min, 50 battaglie perse di fila (boss)",
    '- Area 1: 13 battaglie perse di fila (normale, seme 1), più di 12',
    '- Area 1: lenta, 40 min nel seme 1 (al massimo 30)',
    '- Area 1: attese 60% del tempo',
  ];
  check(`segnalati: ${flags.join(' ')}`, flags.join() === expected.join());
  const row = report.find((line) => line.startsWith('1 ')) ?? '';
  const growth = report.filter((line) => line.startsWith('1 '))[1] ?? '';
  check(
    `prima area: «${row.replace(/ +/g, ' ')}»; crescita: «${growth.replace(/ +/g, ' ')}»`,
    row.replace(/ +/g, ' ') === '1 2/2 25 10-40 15 2/2 2/15 - - - 13 normale' &&
      growth.replace(/ +/g, ' ') === '1 2,00 125 1/0/2/1/0 2 2,5 1,5 2,0 4 18 12 5 1 1 2',
  );
  const lines = report.filter((line) => line.startsWith('Seme '));
  check(
    `campagne: ${lines.join(' | ')}`,
    lines[0].startsWith("Seme 1: fino all'area 2 in 1,5 ore (attese 33%)") &&
      lines[1].startsWith("Seme 2: BLOCCATA nell'area 2 in 0,5 ore (attese 0%)"),
  );
  const clean = formatCampaignReport({ campaigns: [{ ...campaigns[1], stuck: null }], areas: 1, seconds: 1 });
  check(
    `campagna che scorre: ${clean.split('\n').at(-1)}`,
    clean.endsWith('- niente da segnalare: la campagna scorre'),
  );
  check.done();
});
