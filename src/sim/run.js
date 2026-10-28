import { parseArgs } from 'node:util';
import { SIM } from '../config/balance.js';
import { msToSeconds } from '../core/time.js';
import { CATEGORIES } from '../data/heroes.js';
import { ELITE, SOLDIER_TYPES } from '../data/units.js';
import { WORLD } from '../data/world.js';
import { battlePlan } from '../systems/waves.js';
import { formatCampaignReport } from './campaignReport.js';
import { formatReport } from './report.js';
import { formatThreatReport } from './threatReport.js';
import { playThreats } from './threats.js';
import { inWorkers } from './workers.js';

// Simulatore di bilanciamento, senza grafica: npm run sim. Il bot gioca il livello com'è e ogni punto di
// SIM.sweeps, SIM.games partite a punto dal seme SIM.firstSeed in su, divise tra i processori; poi stampa il
// resoconto (sim/report.js). Opzioni: --partite N, --seme S (numeri interi da 1), --solo-livello (senza i punti della
// potenza), --tipo normale, boss, doppia o tripla (data/waves.js BATTLE_TYPES; senza, la normale, DEFAULT_TYPE),
// --esercito F:R:L:E, l'esercito di partenza: le proporzioni dei soldati normali (fucilieri, raffica e lanciatori, che
// arrivano dalle porte; almeno uno) e quante élite partono già in campo (senza, quello di data/loadout.js
// STARTING_LOADOUT).
// Con --campagna gioca invece campagne intere (sim/campaign.js), una per processo, dal seme SIM.firstSeed in su, e ne
// stampa il resoconto (sim/campaignReport.js): --aree N, quante aree conquistare (senza, tutte quelle della strada),
// --semi K, quante campagne (senza, SIM.campaign.seeds). Con --minacce gioca la prova eroe contro minaccia
// (sim/threats.js), SIM.threats.games partite a cella (o --partite) dal seme SIM.firstSeed (o --seme), e ne stampa la
// tabella (sim/threatReport.js)
const TYPE_NAMES = { normale: 'normal', boss: 'boss', doppia: 'double', tripla: 'triple' };
const { values: options } = parseArgs({
  options: {
    partite: { type: 'string' },
    seme: { type: 'string' },
    'solo-livello': { type: 'boolean' },
    tipo: { type: 'string' },
    campagna: { type: 'boolean' },
    aree: { type: 'string' },
    semi: { type: 'string' },
    minacce: { type: 'boolean' },
    esercito: { type: 'string' },
  },
});
if (options.campagna) await simulateCampaigns();
else if (options.minacce) await simulateThreats();
else await simulateLevel();

async function simulateLevel() {
  const known = options.tipo === undefined || Object.hasOwn(TYPE_NAMES, options.tipo);
  if (!known) throw new Error(`tipo sconosciuto: ${options.tipo} (${Object.keys(TYPE_NAMES)})`);
  const type = options.tipo === undefined ? null : TYPE_NAMES[options.tipo];
  const plan = battlePlan(type === null ? null : { type });
  const games = wholeOption('partite', SIM.games, Infinity);
  const firstSeed = wholeOption('seme', SIM.firstSeed, Number.MAX_SAFE_INTEGER);
  const seeds = Array.from({ length: games }, (_, index) => firstSeed + index);
  const sweeps = options['solo-livello'] ? [] : SIM.sweeps;
  const points = [{ sweep: null, value: null }];
  for (const { id, values } of sweeps) for (const value of values) points.push({ sweep: id, value });

  const army = armyOption();
  const startMs = performance.now();
  const results = await playAll(points, seeds, type, army);
  const seconds = msToSeconds(performance.now() - startMs);
  const name = options.tipo ?? null;
  console.log(formatReport({ points, results, sweeps, games, firstSeed, seconds, plan, name, army }));
}

async function simulateCampaigns() {
  const areas = wholeOption('aree', WORLD.road.length, WORLD.road.length);
  const count = wholeOption('semi', SIM.campaign.seeds, Infinity);
  const tasks = Array.from({ length: count }, (_, index) => ({ seed: SIM.firstSeed + index, areas }));
  const startMs = performance.now();
  const campaigns = await inWorkers('./campaignWorker.js', tasks);
  const seconds = msToSeconds(performance.now() - startMs);
  console.log(formatCampaignReport({ campaigns, areas, seconds }));
}

// Ogni categoria contro ogni minaccia, con il potere acceso e spento (sim/threats.js)
async function simulateThreats() {
  const games = wholeOption('partite', SIM.threats.games, Infinity);
  const firstSeed = wholeOption('seme', SIM.firstSeed, Number.MAX_SAFE_INTEGER);
  const seeds = Array.from({ length: games }, (_, index) => firstSeed + index);
  const cells = SIM.threats.list.flatMap((_, threat) =>
    Object.keys(CATEGORIES).flatMap((category) => [true, false].map((powered) => ({ threat, category, powered }))),
  );
  const startMs = performance.now();
  const played = await playThreats(cells, seeds);
  const seconds = msToSeconds(performance.now() - startMs);
  const battles = new Map(
    cells.map(({ threat, category, powered }, index) => [`${threat} ${category} ${powered}`, played[index]]),
  );
  const of = (threat, category, powered) => battles.get(`${threat} ${category} ${powered}`);
  console.log(formatThreatReport({ of, games, firstSeed, seconds }));
}

// L'opzione --esercito: un intero da 0 per ogni tipo di soldati, nell'ordine di data/units.js SOLDIER_TYPES, divisi da
// due punti, con almeno un soldato normale (le élite no); null senza
function armyOption() {
  if (options.esercito === undefined) return null;
  const types = Object.keys(SOLDIER_TYPES);
  const parts = options.esercito.split(':');
  const army = Object.fromEntries(types.map((type, index) => [type, Number(parts[index])]));
  const plain = types.filter((type) => SOLDIER_TYPES[type].weapon !== ELITE.weapon);
  const digits = parts.length === types.length && parts.every((part) => /^\d+$/.test(part));
  if (!digits || plain.every((type) => army[type] === 0)) {
    const wanted = `${types.length} interi da 0 divisi da due punti (${types.join(':')})`;
    throw new Error(`--esercito vuole ${wanted}, con almeno un soldato normale`);
  }
  return army;
}

// L'opzione name, un numero intero da 1 a max; senza, fallback
function wholeOption(name, fallback, max) {
  const value = Number(options[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`--${name} va da 1 a ${max}`);
  return value;
}

// Ogni punto in pezzi da SIM.chunk partite, ognuno giocato da un processo (sim/worker.js) con il tipo type e
// l'esercito army (null: quello di partenza)
async function playAll(list, allSeeds, type, army) {
  const tasks = [];
  const pointOf = [];
  list.forEach((point, index) => {
    for (let start = 0; start < allSeeds.length; start += SIM.chunk) {
      tasks.push({ ...point, type, army, seeds: allSeeds.slice(start, start + SIM.chunk) });
      pointOf.push(index);
    }
  });
  const played = await inWorkers('./worker.js', tasks);
  const results = list.map(() => ({ ours: 0, theirs: 0, games: [] }));
  played.forEach(({ ours, theirs, games }, task) => {
    const result = results[pointOf[task]];
    Object.assign(result, { ours, theirs });
    result.games.push(...games);
  });
  for (const result of results) result.games.sort((a, b) => a.seed - b.seed);
  return results;
}
