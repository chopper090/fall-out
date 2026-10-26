import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { SIM } from '../config/balance.js';
import { msToSeconds } from '../core/time.js';
import { WORLD } from '../data/world.js';
import { battlePlan } from '../systems/waves.js';
import { formatCampaignReport } from './campaignReport.js';
import { formatReport } from './report.js';

// Simulatore di bilanciamento, senza grafica: npm run sim. Il bot gioca il livello com'è e ogni punto di
// SIM.sweeps, SIM.games partite a punto dal seme SIM.firstSeed in su, divise tra i processori; poi stampa il
// resoconto (sim/report.js). Opzioni: --partite N, --seme S (numeri interi da 1), --solo-livello (senza i punti della
// potenza), --durata corta, media o lunga (data/waves.js LENGTHS; senza, la media, DEFAULT_LENGTH).
// Con --campagna gioca invece campagne intere (sim/campaign.js), una per processo, dal seme SIM.firstSeed in su, e ne
// stampa il resoconto (sim/campaignReport.js): --aree N, quante aree conquistare (senza, tutte quelle della strada),
// --semi K, quante campagne (senza, SIM.campaign.seeds)
const LENGTH_NAMES = { corta: 'short', media: 'medium', lunga: 'long' };
const { values: options } = parseArgs({
  options: {
    partite: { type: 'string' },
    seme: { type: 'string' },
    'solo-livello': { type: 'boolean' },
    durata: { type: 'string' },
    campagna: { type: 'boolean' },
    aree: { type: 'string' },
    semi: { type: 'string' },
  },
});
if (options.campagna) await simulateCampaigns();
else await simulateLevel();

async function simulateLevel() {
  const known = options.durata === undefined || Object.hasOwn(LENGTH_NAMES, options.durata);
  if (!known) throw new Error(`durata sconosciuta: ${options.durata} (${Object.keys(LENGTH_NAMES)})`);
  const length = options.durata === undefined ? null : LENGTH_NAMES[options.durata];
  const plan = battlePlan(length === null ? null : { length });
  const games = wholeOption('partite', SIM.games, Infinity);
  const firstSeed = wholeOption('seme', SIM.firstSeed, Number.MAX_SAFE_INTEGER);
  const seeds = Array.from({ length: games }, (_, index) => firstSeed + index);
  const sweeps = options['solo-livello'] ? [] : SIM.sweeps;
  const points = [{ sweep: null, value: null }];
  for (const { id, values } of sweeps) for (const value of values) points.push({ sweep: id, value });

  const startMs = performance.now();
  const results = await playAll(points, seeds, length);
  const seconds = msToSeconds(performance.now() - startMs);
  const name = options.durata ?? null;
  console.log(formatReport({ points, results, sweeps, games, firstSeed, seconds, plan, length: name }));
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

// L'opzione name, un numero intero da 1 a max; senza, fallback
function wholeOption(name, fallback, max) {
  const value = Number(options[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`--${name} va da 1 a ${max}`);
  return value;
}

// Ogni punto in pezzi da SIM.chunk partite, ognuno giocato da un processo (sim/worker.js) con la durata length
async function playAll(list, allSeeds, length) {
  const tasks = [];
  const pointOf = [];
  list.forEach((point, index) => {
    for (let start = 0; start < allSeeds.length; start += SIM.chunk) {
      tasks.push({ ...point, length, seeds: allSeeds.slice(start, start + SIM.chunk) });
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

// Ogni compito di tasks in un processo del file file (in sim/), tanti alla volta quanti i processori meno uno.
// Restituisce i loro risultati nell'ordine dei compiti
async function inWorkers(file, tasks) {
  const results = [];
  let next = 0;
  const run = async () => {
    for (let index = next++; index < tasks.length; index = next++) results[index] = await inWorker(file, tasks[index]);
  };
  const workers = Math.max(1, Math.min(tasks.length, availableParallelism() - 1));
  await Promise.all(Array.from({ length: workers }, run));
  return results;
}

function inWorker(file, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(file, import.meta.url), { workerData });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}
