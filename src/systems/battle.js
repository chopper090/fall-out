import { HERO, LANES } from '../config/balance.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { WAVES } from '../data/waves.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { createLanes } from './lanes.js';
import { createArmy, updateArmy } from './army.js';
import { createScroll } from './scroll.js';
import { clashEnemies, createSpawner, updateSpawner } from './spawn.js';
import { createGates, reachGates, updateGates } from './gates.js';
import { createChests, reachChests, updateChests } from './chests.js';
import { createLoot, reachLoot, updateLoot } from './loot.js';
import { createBattleStats } from './battleStats.js';
import { createFeats } from './feats.js';
import { createCombat, updateCombat } from './combat.js';
import { createMission } from './mission.js';
import { createBosses, updateBosses } from './boss.js';
import { createEnemyFire, updateEnemyFire } from './enemyFire.js';
import { createHeroes, updateHeroes } from './heroes.js';
import { battlePlan, createWaves, reachedBoss, updateWaves } from './waves.js';

// Battaglia senza disegno: crea tutti i sistemi con il loro bus di eventi e li fa avanzare di un frame, nello
// stesso ordine per la scena e per il simulatore (sim/). Il simulatore passa un bus a cui ha già attaccato le sue
// misure, così sente ogni evento prima dei sistemi. seed: il seme della partita, per rigiocarla uguale; loadout:
// cosa porta in battaglia il meta-gioco (data/loadout.js: eroi, soldati e armi del villaggio, regole della battaglia,
// con il tipo; senza, lo schieramento di partenza); number: il numero della battaglia sulla strada (null fuori dalla
// strada); ms: tempo di gioco; frame: i frame giocati, per i comandi di una battaglia registrata (systems/replay.js);
// over: missione finita, fallita o compiuta.
// Il tipo e quanto sono duri e fitti i nemici li dice battlePlan (con la difficoltà di prova del pannello)
export function createBattle(seed, bus = createEventBus(), loadout = STARTING_LOADOUT) {
  const lanes = createLanes(LANES.count, LANES.fieldWidth);
  const laneCenters = lanes.map((lane) => lane.centerX);
  const rng = createRng(seed);
  const scroll = createScroll(bus);
  const plan = battlePlan(loadout.rules);
  const waves = createWaves(bus, plan);
  const army = createArmy(bus, rng, { startX: laneCenters[HERO.startLane], laneCenters, loadout });
  // Le regole della battaglia (loadout.rules: una casella della strada, la sfida) fanno i nemici più duri
  const spawner = createSpawner(bus, rng, laneCenters, plan.hpScale, plan.countScale, plan.specialsScale);
  // Dopo i nemici, che a ogni colpo tolgono la vita: così il boss conta gli strati con la vita già ridotta
  const bosses = createBosses(bus, rng, laneCenters);
  const enemyFire = createEnemyFire(bus, rng);
  const abilities = createHeroes(bus, army, powerHp(plan));
  const gates = createGates(bus, rng, laneCenters, plan);
  const chests = createChests(bus, rng, laneCenters, plan.hitScale);
  const combat = createCombat(bus);
  const mission = createMission(bus);
  const loot = createLoot(
    bus,
    seed,
    army.heroes.map((hero) => hero.id),
  );
  const heroStats = createBattleStats(bus, army.heroes);
  const feats = createFeats(bus);
  const battle = {
    seed,
    number: loadout.rules?.number ?? null,
    lanes,
    bus,
    scroll,
    waves,
    army,
    spawner,
    bosses,
    enemyFire,
    abilities,
    gates,
    chests,
    combat,
    mission,
    loot,
    heroStats,
    feats,
    targets: { enemies: spawner.enemies, chests: chests.list, gates: gates.list },
    ms: 0,
    frame: 0,
    over: false,
  };
  const stop = () => {
    battle.over = true;
  };
  bus.on(EVENTS.MISSION_FAILED, stop);
  bus.on(EVENTS.MISSION_COMPLETED, stop);
  return battle;
}

export function updateBattle(battle, deltaMs) {
  const { waves, scroll, army, spawner, bosses, enemyFire, abilities, gates, chests, loot, combat, targets } = battle;
  battle.ms += deltaMs;
  // Prima l'ondata, che decide la velocità del campo per tutti gli altri
  updateWaves(waves, deltaMs, spawner.enemies.length + gates.list.length + chests.list.length + loot.list.length);
  updateArmy(army, deltaMs);
  updateSpawner(spawner, deltaMs, scroll.speed);
  // I boss si piantano, cambiano corsia e schiacciano dopo che i nemici si sono mossi
  updateBosses(bosses, deltaMs, army);
  // I tiratori si fermano e sparano; i loro colpi colpiscono chi incontrano
  updateEnemyFire(enemyFire, spawner.enemies, army, deltaMs, scroll.speed);
  // Le abilità degli eroi partono da sole quando sono pronte e servono
  updateHeroes(abilities, army, spawner.enemies, enemyFire.shots, deltaMs);
  updateGates(gates, deltaMs, scroll.speed);
  updateChests(chests, deltaMs, scroll.speed);
  updateLoot(loot, deltaMs, scroll.speed);
  // Ognuno spara al suo ritmo; dopo i colpi si vede chi si scontra con l'esercito e chi lo supera
  updateCombat(combat, army, targets, deltaMs, scroll.speed);
  clashEnemies(spawner, army);
  // A missione finita nessun cancello vale più
  if (!battle.over) reachGates(gates, army);
  reachChests(chests, army);
  // Come i cancelli: a missione finita il risultato è già preso, nessun premio vale più
  if (!battle.over) reachLoot(loot, army);
  battle.frame += 1;
}

// Risultato della battaglia per il meta-gioco: compiuta o no, il numero della battaglia (null fuori dalla strada),
// ondata raggiunta (da 1), se si era già arrivati al boss (mai nelle battaglie senza boss), il bottino preso (una
// copia), le statistiche di ogni eroe schierato, le imprese (systems/feats.js, una copia) e il seme, per rigiocarla
// La vita di un nemico normale dell'ondata più dura della battaglia (quelle di data/waves.js fino a plan.waves, con la
// vita del piano): quella su cui i poteri degli eroi contano la loro quota (systems/powers.js)
export function powerHp(plan) {
  return Math.max(...WAVES.slice(0, plan.waves).map((wave) => wave.enemyHp)) * plan.hpScale;
}

export function battleResult({ mission, number, waves, loot, heroStats, feats, seed }) {
  const boss = reachedBoss(waves);
  return {
    completed: mission.completed,
    number,
    wave: waves.index + 1,
    boss,
    loot: { ...loot.collected, fragments: { ...loot.collected.fragments } },
    heroes: heroStats.map((entry) => ({ ...entry })),
    feats: { ...feats },
    seed,
  };
}
