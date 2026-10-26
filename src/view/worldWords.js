import { HUD } from '../config/balance.js';
import { decimalText, percentText } from '../core/format.js';
import { minutesToMs } from '../core/time.js';
import { HEROES } from '../data/heroes.js';
import { VILLAGE } from '../data/village.js';
import { hereTile, isBattle, nextTile, rationsShort, stepCost } from '../meta/road.js';
import { farmOutput, nextGoal, nextRationIn, timeLeft, villageBonus } from '../meta/village.js';
import { battlePlan } from '../systems/waves.js';
import { amountText, durationText } from './words.js';

// Le scritte del mondo (scenes/World.js) e della sua interfaccia (scenes/WorldUI.js, scenes/worldSheets.js), senza
// Phaser: obiettivi, premi, costi, caselle della strada e razioni, con le parole di HUD.world

// La riga del prossimo obiettivo: il cantiere aperto e quanto manca all'ora now, oppure il prossimo edificio e cosa
// serve ancora
export function goalText(profile, now) {
  const { labels } = HUD.world;
  const job = profile.village.construction;
  if (job !== null) {
    const { name } = VILLAGE.buildings[job.building];
    const level = profile.village.levels[job.building] + 1;
    const left = timeLeftText(profile, now);
    return `${labels.building}: ${name} ${labels.level} ${level}, ${labels.endsIn} ${left}`;
  }
  const goal = nextGoal(profile);
  if (goal === null) return labels.complete;
  const target = `${labels.next}: ${VILLAGE.buildings[goal.building].name} ${labels.level} ${goal.level}`;
  const missing = Object.entries(goal.missing).filter(([, amount]) => amount > 0);
  if (missing.length === 0) return `${target} · ${labels.ready}`;
  return `${target} · ${labels.missing} ${missing.map(([kind, amount]) => amountText(kind, amount)).join(', ')}`;
}

// Quanto manca alla fine del cantiere all'ora now, scritto: "4 min 12 s" (sul mondo, nella scheda e nell'obiettivo)
export function timeLeftText(profile, now) {
  return durationText(timeLeft(profile, now));
}

// Il premio di una raccolta: "+12 materiali", "+2 frammenti · Cecchino"
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
  return left > 0 ? `${at}${separator}${labels.bossIn} ${left} ${labels.tiles}` : at;
}

// Cosa c'è nella casella: strada libera, la raccolta con il suo premio, la battaglia o il boss con la sua durata e
// quante ondate, quanto sono duri i nemici (più duri, con quanta vita in più, o normali) e quante razioni costa
export function tileText(tile) {
  const { road: labels, separator } = HUD.world;
  const name = labels.kinds[tile.kind];
  if (tile.kind === 'collect') {
    const gain = amountText(tile.resource, tile.amount, '+');
    return `${name}${separator}${tile.resource === 'fragments' ? `${gain} ${labels.forAHero}` : gain}`;
  }
  if (!isBattle(tile)) return name;
  const { enemyHpScale: scale, length } = tile.rules;
  const waves = `${battlePlan(tile.rules).waves} ${labels.waves}`;
  const title = tile.kind === 'battle'
    ? `${name} ${labels.lengths[length]} (${waves})`
    : `${name} (${labels.lengths[length]}, ${waves})`;
  const enemies = scale > 1 ? `${labels.harder} ×${decimalText(scale)}` : labels.normal;
  return [title, enemies, amountText('rations', stepCost(tile))].join(separator);
}

// Le razioni e, se non bastano per la prossima casella, quante ne servono e come averle: la fattoria da costruire (o
// che si sta costruendo), quelle pronte da raccogliere o quando la fattoria ne avrà abbastanza
export function rationsText(profile) {
  const { road: labels, separator } = HUD.world;
  const { rations } = profile.resources;
  const line = `${labels.rations}: ${rations}`;
  if (!rationsShort(profile)) return line;
  const cost = stepCost(nextTile(profile));
  const need = `${line}${separator}${labels.need} ${cost}`;
  const { levels, farm, construction } = profile.village;
  const site = construction?.building === 'farm';
  if (levels.farm === 0) return `${need}${separator}${site ? labels.farmSite : labels.buildFarm}`;
  const wait = nextRationIn(profile, cost - rations);
  if (farm.stored >= 1 || wait === null) return `${need}${separator}${labels.collectFarm}`;
  return `${need}${separator}${labels.nextRation} ${durationText(wait)}`;
}

// Le risorse di un premio, una per voce: "+25 materiali"
export function rewardText(reward) {
  return Object.entries(reward)
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => amountText(kind, amount, '+'));
}

// Costo e durata di un livello: "25 materiali · 2 rottami · 5 min"
export function costText(cost) {
  const parts = [amountText('materials', cost.materials)];
  if (cost.scrap > 0) parts.push(amountText('scrap', cost.scrap));
  parts.push(durationText(minutesToMs(cost.minutes)));
  return parts.join(HUD.world.separator);
}

// Cosa dà l'edificio id al livello level (da 1)
export function effectText(id, level) {
  const { labels, separator } = HUD.world;
  if (id === 'farm') {
    const { perHour, storage } = farmOutput(level);
    return `${perHour} ${labels.perHour}, ${labels.upTo} ${storage}`;
  }
  const bonus = villageBonus({ barracks: level, forge: level });
  if (id === 'barracks') return `+${bonus.soldiers} ${labels.soldiers}`;
  const { damage, fireRate, autoAim } = bonus.weapons;
  const parts = [`${labels.damage} ${percentText(damage, '+')}`];
  if (fireRate > 0) parts.push(`${labels.fireRate} ${percentText(fireRate, '+')}`);
  if (autoAim) parts.push(labels.autoAim);
  return parts.join(separator);
}
