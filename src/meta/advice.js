import { WEAPON_PATHS } from '../data/forge.js';
import { retrainCost } from './barracks.js';
import { canForge } from './forge.js';
import { cheapestStep, trainBlock } from './heroes.js';
import { canUpgrade } from './village.js';

// Il consiglio dopo una sconfitta (scenes/Summary.js): la cosa più utile che si può fare adesso per tornare più
// forti, nell'ordine: riaddestrare i caduti della caserma (retrain, se non si stanno già addestrando e le razioni
// bastano), migliorare un'arma nella fucina (forge), potenziare un eroe dello schieramento (hero: un livello con
// l'esperienza, o una stella o un grado con i frammenti), migliorare la caserma o la fucina (build); se adesso non si
// può fare niente di questo, le missioni e le sfide del giorno (daily). Le parole sono in HUD.gameOver.advice
export function defeatAdvice(profile) {
  const retrain = retrainCost(profile);
  if (retrain.count > 0 && profile.retrain === null && profile.resources.rations >= retrain.rations) return 'retrain';
  if (Object.keys(WEAPON_PATHS).some((weapon) => canForge(profile, weapon))) return 'forge';
  if (profile.lineup.some((id) => id !== null && heroReady(profile, id))) return 'hero';
  if (['barracks', 'forge'].some((id) => canUpgrade(profile, id))) return 'build';
  return 'daily';
}

// L'eroe id può salire adesso: di livello, o di una stella o di un grado con i suoi frammenti
function heroReady(profile, id) {
  const record = profile.heroes[id];
  const step = cheapestStep(record);
  return trainBlock(profile, id) === null || (step !== null && record.fragments >= step);
}
