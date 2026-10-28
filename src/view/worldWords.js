import { HUD } from '../config/balance.js';
import { minutesToMs } from '../core/time.js';
import { HEROES } from '../data/heroes.js';
import { SOLDIER_TYPES } from '../data/units.js';
import { VILLAGE } from '../data/village.js';
import { armyCapacity, typesFrom } from '../meta/barracks.js';
import { hereTile, isBattle, nextTile, rationsShort, stepCost } from '../meta/road.js';
import {
  builders,
  farmOutput,
  firstSite,
  lockOf,
  nextGoal,
  nextRationIn,
  reliefIn,
  siteOf,
  timeLeft,
} from '../meta/village.js';
import { levelPower } from '../systems/power.js';
import { battlePlan } from '../systems/waves.js';
import { amountText, durationText } from './words.js';

// Le scritte del mondo (scenes/World.js) e della sua interfaccia (scenes/WorldUI.js, scenes/worldSheets.js), senza
// Phaser: obiettivi, premi, costi, caselle della strada e razioni, con le parole di HUD.world

// La riga del prossimo obiettivo: con un posto cantiere libero il prossimo edificio e cosa serve ancora; se non ce
// n'è uno (o gli altri edifici sono al massimo), i posti occupati e il cantiere che finisce per primo, con quanto
// manca all'ora now
export function goalText(profile, now) {
  const { labels, separator } = HUD.world;
  const goal = nextGoal(profile);
  const first = firstSite(profile);
  if (goal === null && first === null) return labels.complete;
  if (goal === null) {
    const { name } = VILLAGE.buildings[first.building];
    const level = profile.village.levels[first.building] + 1;
    const left = timeLeftText(profile, first.building, now);
    return `${sitesText(profile)}${separator}${name} ${labels.level} ${level} ${labels.endsIn} ${left}`;
  }
  const target = `${labels.next}: ${VILLAGE.buildings[goal.building].name} ${labels.level} ${goal.level}`;
  const missing = Object.entries(goal.missing).filter(([, amount]) => amount > 0);
  if (missing.length === 0) return `${target} · ${labels.ready}`;
  return `${target} · ${labels.missing} ${missing.map(([kind, amount]) => amountText(kind, amount)).join(', ')}`;
}

// I posti cantiere occupati su quelli che ci sono: "Cantieri: 1/2"
export function sitesText(profile) {
  return `${HUD.world.labels.sites}: ${profile.village.sites.length}/${builders(profile)}`;
}

// Cosa tiene fermo il prossimo livello dell'edificio id (meta/village.js lockOf), scritto: "Serve il Centro città al
// liv. 3", "Servono Fattoria liv. 2, Capanno dei mastri liv. 1"; null se niente
export function lockText(profile, id) {
  const lock = lockOf(profile, id);
  if (lock === null) return null;
  const { labels } = HUD.world;
  if (lock.center !== undefined) return `${labels.needsCenter} ${lock.center}`;
  const named = ([other, level]) => `${VILLAGE.buildings[other].name} ${labels.level} ${level}`;
  return `${labels.needs} ${Object.entries(lock.buildings).map(named).join(', ')}`;
}

// Quanto manca alla fine del cantiere dell'edificio id all'ora now, scritto: "4 min 12 s" (sul mondo, nella scheda e
// nell'obiettivo)
export function timeLeftText(profile, id, now) {
  return durationText(timeLeft(profile, id, now));
}

// Il premio di una raccolta: "+12 legno", "+2 frammenti · Cecchino"
export function gainText({ kind, amount, hero }) {
  const text = amountText(kind, amount, '+');
  return hero === null ? text : `${text}${HUD.world.separator}${HEROES[hero].name}`;
}

// Dove si è nell'area da conquistare (progress, meta/road.js areaProgress): alla porta, davanti all'area, o a che
// casella e quante ne mancano al boss
export function whereText(profile, { area, count, reached }) {
  const { road: labels, separator } = HUD.world;
  if (reached === 0) return hereTile(profile).kind === 'gate' ? labels.atGate : `${labels.before} ${area + 1}`;
  const left = count - reached;
  const at = `${labels.tile} ${reached} ${labels.of} ${count}`;
  return left > 0 ? `${at}${separator}${labels.bossIn} ${left} ${left === 1 ? labels.tileOne : labels.tiles}` : at;
}

// Cosa c'è nella casella: strada libera, la raccolta con il suo premio, la battaglia o il boss con il numero della
// battaglia, quanto dura e quante ondate, la forza che chiede (systems/power.js levelPower), se le porte sono tutte
// negative e quante razioni costa; con
// retry (la battaglia dove si è, persa o lasciata a metà) che si riprova senza pagare
export function tileText(tile, { retry = false } = {}) {
  const { road: labels, separator } = HUD.world;
  const name = labels.kinds[tile.kind];
  if (tile.kind === 'collect') {
    const gain = amountText(tile.resource, tile.amount, '+');
    return `${name}${separator}${tile.resource === 'fragments' ? `${gain} ${labels.forAHero}` : gain}`;
  }
  if (!isBattle(tile)) return name;
  const { type, number } = tile.rules;
  const lasts = `${labels.types[type]}, ${battlePlan(tile.rules).waves} ${labels.waves}`;
  const title = `${name} ${number} (${lasts})`;
  const required = `${labels.required} ${Math.round(levelPower(tile.rules))}`;
  const gates = tile.rules.minusOnly ? [labels.minusOnly] : [];
  return [title, required, ...gates, retry ? labels.retry : amountText('rations', stepCost(tile))].join(separator);
}

// Le razioni e, se non bastano per la prossima casella, quante ne servono e come averle: la fattoria da costruire (o
// che si sta costruendo), quelle pronte da raccogliere o quando la fattoria ne avrà abbastanza; e quando arriva la
// prossima del centro città, all'ora now
export function rationsText(profile, now) {
  const { road: labels, separator } = HUD.world;
  const { rations } = profile.resources;
  const line = `${labels.rations}: ${rations}`;
  if (!rationsShort(profile)) return line;
  const cost = stepCost(nextTile(profile));
  const parts = [line, `${labels.need} ${cost}`, farmHint(profile, cost - rations)];
  const relief = reliefIn(profile, now);
  if (relief !== null) parts.push(`${labels.relief} ${durationText(relief)}`);
  return parts.join(separator);
}

// Come avere dalla fattoria le missing razioni che mancano: costruirla (o aspettare il suo cantiere), raccogliere
// quelle pronte o aspettarle
function farmHint(profile, missing) {
  const { road: labels } = HUD.world;
  const { levels, farm } = profile.village;
  if (levels.farm === 0) return siteOf(profile, 'farm') !== null ? labels.farmSite : labels.buildFarm;
  const wait = nextRationIn(profile, missing);
  if (farm.stored >= 1 || wait === null) return labels.collectFarm;
  return `${labels.nextRation} ${durationText(wait)}`;
}

// Le risorse di un premio, una per voce: "+25 pietra"
export function rewardText(reward) {
  return Object.entries(reward)
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => amountText(kind, amount, '+'));
}

// Costo e durata di un livello: "18 legno · 7 pietra · 2 ingranaggi · 5 min"
export function costText(cost) {
  const paid = Object.entries(cost.resources).filter(([, amount]) => amount > 0);
  const parts = paid.map(([kind, amount]) => amountText(kind, amount));
  parts.push(durationText(minutesToMs(cost.minutes)));
  return parts.join(HUD.world.separator);
}

// La caserma al livello level: i soldati in più e, se a quel livello ne arrivano, i tipi nuovi che addestra
function barracksText(soldiers, level) {
  const { labels, separator } = HUD.world;
  const text = `+${soldiers} ${labels.soldiers}`;
  const fresh = typesFrom(level).map((type) => SOLDIER_TYPES[type].label.toLowerCase());
  return fresh.length === 0 ? text : `${text}${separator}${labels.newTypes} ${fresh.join(', ')}`;
}

// Cosa dà l'edificio id al livello level (da 1)
export function effectText(id, level) {
  const { labels } = HUD.world;
  if (id === 'center') return `${labels.upToLevel} ${level}`;
  if (id === 'lodge') {
    const workers = VILLAGE.buildings.lodge.workers[level - 1];
    if (workers === 0) return labels.noWorkers;
    return `+${workers} ${workers === 1 ? labels.worker : labels.workers}`;
  }
  if (id === 'farm') {
    const { perHour, storage } = farmOutput(level);
    return `${perHour} ${labels.perHour}, ${labels.upTo} ${storage}`;
  }
  if (id === 'barracks') return barracksText(armyCapacity(level), level);
  return `${labels.weaponsUpTo} ${level}`;
}
