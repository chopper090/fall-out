import { HERO, LANES } from '../config/balance.js';
import { STARTING_LOADOUT } from '../data/heroes.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { createLanes } from './lanes.js';
import { createArmy, updateArmy } from './army.js';
import { createScroll, updateScroll } from './scroll.js';
import { clashEnemies, createSpawner, updateSpawner } from './spawn.js';
import { createGates, reachGates, updateGates } from './gates.js';
import { createChests, reachChests, updateChests } from './chests.js';
import { createLoot, reachLoot, updateLoot } from './loot.js';
import { createBattleStats } from './battleStats.js';
import { createCombat, updateCombat } from './combat.js';
import { createMission } from './mission.js';
import { createBoss, updateBoss } from './boss.js';
import { createEnemyFire, updateEnemyFire } from './enemyFire.js';
import { createHeroes, updateHeroes } from './heroes.js';
import { WAVE_PHASES, createWaves, updateWaves } from './waves.js';

// Battaglia senza disegno: crea tutti i sistemi con il loro bus di eventi e li fa avanzare di un frame, nello
// stesso ordine per la scena e per il simulatore (sim/). Il simulatore passa un bus a cui ha già attaccato le sue
// misure, così sente ogni evento prima dei sistemi. seed: il seme della partita, per rigiocarla uguale; loadout: gli
// eroi in campo con i loro numeri, quelli del meta-gioco (senza, lo schieramento di partenza); ms: tempo di gioco;
// over: missione finita, fallita o compiuta
export function createBattle(seed, bus = createEventBus(), loadout = STARTING_LOADOUT) {
  const lanes = createLanes(LANES.count, LANES.fieldWidth);
  const laneCenters = lanes.map((lane) => lane.centerX);
  const rng = createRng(seed);
  const scroll = createScroll(bus);
  const waves = createWaves(bus);
  const army = createArmy(bus, rng, { startX: laneCenters[HERO.startLane], laneCenters, loadout });
  const spawner = createSpawner(bus, rng, laneCenters);
  // Dopo i nemici, che a ogni colpo tolgono la vita: così il boss conta gli strati con la vita già ridotta
  const boss = createBoss(bus, rng, laneCenters);
  const enemyFire = createEnemyFire(bus, rng);
  const abilities = createHeroes(bus, army);
  const gates = createGates(bus, rng, laneCenters);
  const chests = createChests(bus, rng, laneCenters);
  const combat = createCombat(bus);
  const mission = createMission(bus);
  const loot = createLoot(bus, seed, army.heroes.map((hero) => hero.id));
  const heroStats = createBattleStats(bus, army.heroes);
  const battle = {
    seed,
    lanes,
    bus,
    scroll,
    waves,
    army,
    spawner,
    boss,
    enemyFire,
    abilities,
    gates,
    chests,
    combat,
    mission,
    loot,
    heroStats,
    targets: { enemies: spawner.enemies, chests: chests.list },
    ms: 0,
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
  const { waves, scroll, army, spawner, boss, enemyFire, abilities, gates, chests, loot, combat, targets } = battle;
  battle.ms += deltaMs;
  // Prima l'ondata, che decide la velocità del campo per tutti gli altri
  updateWaves(waves, deltaMs, spawner.enemies.length + gates.list.length + chests.list.length + loot.list.length);
  updateScroll(scroll, deltaMs);
  updateArmy(army, deltaMs);
  updateSpawner(spawner, deltaMs, scroll.speed);
  // Il boss si pianta, cambia corsia e schiaccia dopo che i nemici si sono mossi
  updateBoss(boss, deltaMs, army);
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
}

// Risultato della battaglia per il meta-gioco: compiuta o no, distanza percorsa (in unità del mondo), ondata
// raggiunta (da 1), se si era già arrivati al boss, il bottino preso (una copia) e le statistiche di ogni eroe
// schierato
export function battleResult({ mission, scroll, waves, loot, heroStats }) {
  const boss = [WAVE_PHASES.boss, WAVE_PHASES.clearing, WAVE_PHASES.complete].includes(waves.phase);
  return {
    completed: mission.completed,
    distance: scroll.distance,
    wave: waves.index + 1,
    boss,
    loot: { ...loot.collected, fragments: { ...loot.collected.fragments } },
    heroes: heroStats.map((entry) => ({ ...entry })),
  };
}
