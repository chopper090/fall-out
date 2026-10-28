import { HUD } from '../config/balance.js';
import { percentText } from '../core/format.js';
import { minutesToMs } from '../core/time.js';
import { WEAPON_PATHS } from '../data/forge.js';
import { weaponPaths } from '../meta/forge.js';
import { amountText, durationText } from './words.js';

// Le scritte della fucina (scenes/Forge.js e il Catalogo), senza Phaser, con le parole di HUD.forge

// Cosa dà da solo il livello level (da 1) dell'arma weapon: "il colpo passa un nemico"
export function stepText(weapon, level) {
  return effectParts(WEAPON_PATHS[weapon][level - 1]).join(HUD.world.separator);
}

// Cosa danno insieme i livelli dell'arma weapon fino a level: "danno +15% · gittata +200"; niente a livello 0
export function levelText(weapon, level) {
  if (level === 0) return HUD.forge.labels.nothing;
  return effectParts(weaponPaths({ [weapon]: level })[weapon]).join(HUD.world.separator);
}

// Quanto costa e quanto dura un livello (cost: meta/forge.js forgeCost): "16 pietra · 4 ingranaggi · 10 min"
export function forgeCostText(cost) {
  const resources = Object.entries(cost.resources).map(([kind, amount]) => amountText(kind, amount));
  return [...resources, durationText(minutesToMs(cost.minutes))].join(HUD.world.separator);
}

// Le parti di un miglioramento (un livello di data/forge.js, o i livelli sommati di meta/forge.js weaponPaths),
// nell'ordine dei dati; quelle a zero, spente o di base (gateHits 1) non ci sono
function effectParts(step) {
  const { effects } = HUD.forge;
  const parts = [];
  if (step.damage) parts.push(`${effects.damage} ${percentText(step.damage, '+')}`);
  if (step.fireRate) parts.push(`${effects.fireRate} ${percentText(step.fireRate, '+')}`);
  if (step.range) parts.push(`${effects.range} +${step.range}`);
  if (step.pellets) parts.push(`+${step.pellets} ${step.pellets === 1 ? effects.pellet : effects.pellets}`);
  if (step.radius) parts.push(`${effects.radius} +${step.radius}`);
  if (step.pierce) parts.push(step.pierce === 1 ? effects.pierceOne : `${effects.pierce} ${step.pierce}`);
  if (step.armor) parts.push(effects.armor);
  if (step.gateHits > 1) parts.push(`${effects.gateHits} ×${step.gateHits}`);
  if (step.heavy) parts.push(effects.heavy);
  if (step.fuse) parts.push(`${effects.fuse} ×${step.fuse}`);
  if (step.aim) parts.push(effects.aim[step.aim]);
  return parts;
}
