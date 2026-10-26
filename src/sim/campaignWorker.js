import { parentPort, workerData } from 'node:worker_threads';
import { playCampaign } from './campaign.js';

// Processo del simulatore per una campagna intera (sim/campaign.js), con il seme seed e le prime areas aree: i dati
// del gioco restano com'è (niente sim/variants.js). Rimanda il diario della campagna
const { seed, areas } = workerData;
parentPort.postMessage(playCampaign(seed, areas));
