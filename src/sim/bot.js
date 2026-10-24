import { CHESTS, CONTROLS, ENEMY_SHOT, GATES, HERO, SIM } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { WEAPONS } from '../data/units.js';
import { BOSS_PHASES } from '../systems/boss.js';
import { soldiersFrom } from '../systems/gates.js';

// Bot del simulatore: ogni SIM.bot.thinkMs (contati in frame, che nel simulatore durano tutti frameMs) sceglie dove
// portare gli eroi e li guida con lo stesso comando dello swipe. Tra i punti possibili (quelli di aggancio e la x
// dei nemici vicini) scarta quelli dentro la zona che il boss sta per schiacciare e quelli dove passerà un colpo
// nemico, poi prende quello che vale di più: i nemici che la folla copre da lì, che valgono di più quanto più sono
// vicini; il cancello che ci passerebbe sotto, in soldati; gli scrigni, per la parte di colpi che la folla fa in
// tempo a dargli. Il fucile fa da arma di riferimento per la gittata e la misura dei colpi. Lo swipe è
// moltiplicato per la sensibilità dei comandi: il bot la toglie, come farebbe il dito, così i risultati non
// dipendono da come è regolata
export function createBot(frameMs) {
  return { every: Math.max(1, Math.round(SIM.bot.thinkMs / frameMs)), frames: 0 };
}

export function updateBot(bot, battle) {
  bot.frames += 1;
  if (bot.frames < bot.every) return;
  bot.frames = 0;
  const { army, bus } = battle;
  const near = nearEnemies(battle);
  const inside = (x) => Math.min(army.maxX, Math.max(army.minX, x));
  const candidates = safePoints(battle, [...army.snapPoints, ...near.map((enemy) => inside(enemy.x))]);
  const scores = candidates.map((x) => score(battle, near, x));
  const best = candidates[scores.indexOf(Math.max(...scores))];
  bus.emit(EVENTS.STEER, (best - army.x) / CONTROLS.sensitivity);
}

// Nemici davanti entro la gittata più lookAhead. Un tiratore fermo fuori tiro non si può colpire: non conta
function nearEnemies({ spawner }) {
  const { range } = WEAPONS.rifle;
  return spawner.enemies.filter((enemy) => {
    if (enemy.z <= 0 || enemy.z > range + SIM.bot.lookAhead) return false;
    return !(enemy.extraSpeed < 0 && enemy !== spawner.boss && enemy.z - enemy.size / 2 > range);
  });
}

// Se tutti i punti sono a rischio restano tutti
function safePoints({ boss, enemyFire }, points) {
  let safe = points;
  if (boss.enemy && boss.phase === BOSS_PHASES.warn) {
    const outside = safe.filter((x) => Math.abs(x - boss.zone.x) > boss.zone.radius + HERO.size / 2);
    if (outside.length > 0) safe = outside;
  }
  // Dove ogni colpo in arrivo incrocia la linea degli eroi
  const incoming = enemyFire.shots.filter((shot) => shot.vz < 0 && shot.z > 0);
  const crossings = incoming.map((shot) => shot.x - (shot.vx * shot.z) / shot.vz);
  const clearance = (ENEMY_SHOT.size + HERO.size) / 2 + SIM.bot.shotMargin;
  const dodging = safe.filter((x) => crossings.every((crossing) => Math.abs(x - crossing) > clearance));
  return dodging.length > 0 ? dodging : safe;
}

function score(battle, near, x) {
  const { army, spawner, gates, chests } = battle;
  const { distanceScale, bossValue, swarmValue, gateWeight, gateLookAhead, chestWeight } = SIM.bot;
  const distance = (z) => 1 + z / distanceScale;
  let total = 0;
  const rifle = WEAPONS.rifle;
  for (const enemy of near) {
    const reach = (rifle.size + enemy.size) / 2;
    const covers = (dx) => Math.abs(x + dx - enemy.x) < reach;
    if (!covers(0) && !army.soldiers.some((soldier) => covers(soldier.slot.dx))) continue;
    const value = enemy === spawner.boss ? bossValue : enemy.type === ENEMY_TYPES.swarm ? swarmValue : enemy.hp;
    total += value / distance(enemy.z);
  }
  // Di una coppia vale quello più vicino al centro degli eroi, a pari distanza il peggiore e a pari numero il primo
  // della lista (come systems/gates.js)
  const gateReach = GATES.width / 2 + (army.left + army.right) / 2;
  for (const gate of gates.list) {
    if (gate.z > gateLookAhead || gate.z < army.front || Math.abs(gate.x - x) >= gateReach) continue;
    const { partner } = gate;
    const own = soldiersFrom(gate, army.size);
    if (partner && Math.abs(partner.x - x) < gateReach) {
      const gap = Math.abs(gate.x - x) - Math.abs(partner.x - x);
      const other = soldiersFrom(partner, army.size);
      const later = gates.list.indexOf(gate) > gates.list.indexOf(partner);
      if (gap > 0 || (gap === 0 && (own > other || (own === other && later)))) continue;
    }
    total += (gateWeight * own) / distance(gate.z);
  }
  for (const chest of chests.list) {
    if (chest.z > rifle.range + SIM.bot.lookAhead || chest.z < army.front) continue;
    const share = Math.min(1, chestShots(battle, x, chest) / chest.hits);
    total += (chestWeight * SIM.bot.rewardValue[chest.kind.effect] * share) / distance(chest.z);
  }
  return total;
}

// Colpi dritti che la folla con gli eroi in x fa in tempo a dare allo scrigno, ognuno finché lo scrigno resta
// dentro la sua gittata; le granate lo sorvolano
function chestShots({ army, scroll }, x, chest) {
  const reach = (WEAPONS.rifle.size + CHESTS.width) / 2;
  const speed = Math.max(1, scroll.speed);
  let shots = 0;
  const add = (dx, weapon) => {
    if (weapon.kind === 'lob' || Math.abs(x + dx - chest.x) >= reach) return;
    const seconds = Math.max(0, Math.min(weapon.range, chest.z) - army.front) / speed;
    shots += weapon.fireRate * (weapon.pellets ?? 1) * army.fireRateScale * seconds;
  };
  for (const hero of army.heroes) add(hero.dx, hero.weapon);
  for (const soldier of army.soldiers) add(soldier.slot.dx, WEAPONS[soldier.weapon]);
  return shots;
}
