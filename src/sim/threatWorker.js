import { parentPort, workerData } from 'node:worker_threads';
import { SIM } from '../config/balance.js';
import { THREAT_HEROES, threatBattles } from './threats.js';

// Processo del simulatore per la prova eroe contro minaccia (sim/threats.js): le battaglie dell'eroe della categoria
// category contro la minaccia di indice threat in SIM.threats.list, con il potere acceso o spento, sui semi seeds
const { category, threat, powered, seeds } = workerData;
parentPort.postMessage(threatBattles(seeds, THREAT_HEROES[category], powered, SIM.threats.list[threat]));
