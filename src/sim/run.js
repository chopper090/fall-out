import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { SIM } from '../config/balance.js';
import { msToSeconds } from '../core/time.js';
import { battlePlan } from '../systems/waves.js';
import { formatReport } from './report.js';

// Simulatore di bilanciamento, senza grafica: npm run sim. Il bot gioca il livello com'è e ogni punto di
// SIM.sweeps, SIM.games partite a punto dal seme SIM.firstSeed in su, divise tra i processori; poi stampa il
// resoconto (sim/report.js). Opzioni: --partite N, --seme S, --solo-livello (senza i punti della potenza), --durata
// corta, media o lunga (data/waves.js LENGTHS; senza, la media, DEFAULT_LENGTH)
const LENGTH_NAMES = { corta: 'short', media: 'medium', lunga: 'long' };
const { values: options } = parseArgs({
  options: {
    partite: { type: 'string' },
    seme: { type: 'string' },
    'solo-livello': { type: 'boolean' },
    durata: { type: 'string' },
  },
});
const known = options.durata === undefined || Object.hasOwn(LENGTH_NAMES, options.durata);
if (!known) throw new Error(`durata sconosciuta: ${options.durata} (${Object.keys(LENGTH_NAMES)})`);
const length = options.durata === undefined ? null : LENGTH_NAMES[options.durata];
const plan = battlePlan(length === null ? null : { length });
const games = Number(options.partite ?? SIM.games);
const firstSeed = Number(options.seme ?? SIM.firstSeed);
const seeds = Array.from({ length: games }, (_, index) => firstSeed + index);
const sweeps = options['solo-livello'] ? [] : SIM.sweeps;
const points = [{ sweep: null, value: null }];
for (const { id, values } of sweeps) for (const value of values) points.push({ sweep: id, value });

const startMs = performance.now();
const results = await playAll(points, seeds);
const seconds = msToSeconds(performance.now() - startMs);
console.log(formatReport({ points, results, sweeps, games, firstSeed, seconds, plan, length: options.durata ?? null }));

// Ogni punto in pezzi da SIM.chunk partite, giocati da tanti processi quanti i processori meno uno
async function playAll(list, allSeeds) {
  const results = list.map(() => ({ ours: 0, theirs: 0, games: [] }));
  const tasks = [];
  list.forEach((point, index) => {
    for (let start = 0; start < allSeeds.length; start += SIM.chunk) {
      tasks.push({ index, ...point, length, seeds: allSeeds.slice(start, start + SIM.chunk) });
    }
  });
  const run = async () => {
    for (let task = tasks.shift(); task !== undefined; task = tasks.shift()) {
      const { index, ...workerData } = task;
      const { ours, theirs, games: played } = await playTask(workerData);
      Object.assign(results[index], { ours, theirs });
      results[index].games.push(...played);
    }
  };
  const workers = Math.max(1, Math.min(tasks.length, availableParallelism() - 1));
  await Promise.all(Array.from({ length: workers }, run));
  for (const result of results) result.games.sort((a, b) => a.seed - b.seed);
  return results;
}

function playTask(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}
