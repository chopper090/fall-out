import { parentPort, workerData } from 'node:worker_threads';
import { armyPower, levelPower } from '../systems/power.js';
import { playGame } from './game.js';
import { VARIANTS } from './variants.js';

// Processo del simulatore: cambia i dati per il punto da giocare (niente per il livello com'è), poi gioca i semi
// che gli toccano, con il tipo type (null: la normale, DEFAULT_TYPE), e rimanda le partite con il rapporto di
// potenza di quel punto
const { sweep, value, seeds, type } = workerData;
if (sweep !== null) VARIANTS[sweep](value);
const rules = type === null ? null : { type };
const games = seeds.map((seed) => playGame(seed, rules));
parentPort.postMessage({ ours: armyPower(), theirs: levelPower(rules), games });
