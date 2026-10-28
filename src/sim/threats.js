import { SIM } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { CATEGORIES, HEROES } from '../data/heroes.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { createBattle } from '../systems/battle.js';
import { playOut } from './game.js';
import { inWorkers } from './workers.js';

// Prova eroe contro minaccia (C18, npm run sim -- --minacce): l'eroe comune di ogni categoria, nello schieramento di
// partenza (nel suo posto se c'è già, se no nel posto libero SIM.threats.slot), gioca ogni minaccia di
// SIM.threats.list (la battaglia del tipo SIM.threats.type con le regole della minaccia) con il potere acceso e
// spento: le vittorie in più e i soldati persi in meno dicono quanto serve il suo potere contro quella minaccia

// L'eroe comune di ogni categoria
export const THREAT_HEROES = Object.fromEntries(
  Object.keys(CATEGORIES).map((category) => [
    category,
    Object.values(HEROES).find((hero) => hero.category === category && hero.rarity === 'common'),
  ]),
);

// Lo schieramento di partenza con l'eroe hero, con il potere acceso o spento (powered falso: la ricarica non finisce
// mai), contro la minaccia threat
export function threatLoadout(hero, powered, threat) {
  const subject = powered ? hero : { ...hero, ability: { ...hero.ability, cooldownSeconds: Infinity } };
  const own = STARTING_LOADOUT.heroes.find((entry) => entry.hero.id === hero.id);
  const others = STARTING_LOADOUT.heroes.filter((entry) => entry !== own);
  const heroes = [...others, { hero: subject, slot: own?.slot ?? SIM.threats.slot }].sort((a, b) => a.slot - b.slot);
  return { ...STARTING_LOADOUT, heroes, rules: { ...threat.rules, type: SIM.threats.type } };
}

// Le battaglie di ogni cella di cells ({ threat: indice in SIM.threats.list, category, powered }) sui semi seeds, a
// pezzi da SIM.chunk partite in processi diversi (sim/threatWorker.js): per ogni cella le sue, nell'ordine dei semi
export async function playThreats(cells, seeds) {
  const chunks = Math.ceil(seeds.length / SIM.chunk);
  const pieces = Array.from({ length: chunks }, (_, index) => seeds.slice(index * SIM.chunk, (index + 1) * SIM.chunk));
  const tasks = cells.flatMap((cell) => pieces.map((piece) => ({ ...cell, seeds: piece })));
  const played = await inWorkers('./threatWorker.js', tasks);
  return cells.map((_, index) => played.slice(index * chunks, (index + 1) * chunks).flat());
}

// Le battaglie del bot sui semi seeds con quello schieramento (threatBattle)
export function threatBattles(seeds, hero, powered, threat) {
  const loadout = threatLoadout(hero, powered, threat);
  return seeds.map((seed) => threatBattle(seed, loadout));
}

// Quanto serve il potere, dalle battaglie on (acceso) e off (spento) sugli stessi semi: gain, la parte di battaglie
// vinte in più; cut, la parte di soldati persi in meno (di quelli persi a potere spento)
export function threatEffect(on, off) {
  const wins = (battles) => battles.filter(({ won }) => won).length;
  const lost = (battles) => battles.reduce((sum, battle) => sum + battle.lost, 0);
  return { gain: (wins(on) - wins(off)) / on.length, cut: lost(off) > 0 ? 1 - lost(on) / lost(off) : 0 };
}

// Una battaglia giocata dal bot: se la vince e quanti soldati perde, contro i nemici e alle porte negative, meno quelli
// che il soccorso riporta. L'ascoltatore messo prima della battaglia sente la porta prima dell'esercito e apre la
// porta; quello messo dopo la chiude e conta quelli che ha tolto (army.gateLoss): i soldati morti alla porta non si
// contano due volte
function threatBattle(seed, loadout) {
  const bus = createEventBus();
  const tally = { lost: 0, atGate: false };
  bus.on(EVENTS.GATE_PASSED, () => {
    tally.atGate = true;
  });
  bus.on(EVENTS.SOLDIER_KILLED, () => {
    if (!tally.atGate) tally.lost += 1;
  });
  bus.on(EVENTS.SOLDIERS_REVIVED, ({ count }) => {
    tally.lost -= count;
  });
  const battle = createBattle(seed, bus, loadout);
  bus.on(EVENTS.GATE_PASSED, () => {
    tally.lost += battle.army.gateLoss;
    tally.atGate = false;
  });
  playOut(battle);
  return { won: battle.mission.completed, lost: tally.lost };
}
