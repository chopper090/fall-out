import { SIM } from '../config/balance.js';
import { minutesToMs, utcDay } from '../core/time.js';
import { RECRUIT } from '../data/growth.js';
import { WORLD } from '../data/world.js';
import { createMetaActions } from '../meta/actions.js';
import { retrainCost } from '../meta/barracks.js';
import { gradeCost, heroData, starCost, trainBlock } from '../meta/heroes.js';
import { loadoutFrom } from '../meta/loadout.js';
import { createProfile } from '../meta/profile.js';
import { ROAD_TILES, conqueredAreas, isBattle, nextTile, rationsShort, stepCost } from '../meta/road.js';
import { canChallenge, canUpgrade, firstSite, freeSpot, nextGoal, nextRationIn, timeLeft } from '../meta/village.js';
import { battleResult } from '../systems/battle.js';
import { armyPower, levelPower } from '../systems/power.js';
import { playBattle } from './game.js';

// Una campagna giocata dal bot senza grafica, dalla porta fino a conquistare le prime areaCount aree della strada (di
// partenza tutte). Il meta-gioco passa dalle azioni del gioco (meta/actions.js), le battaglie partono e finiscono come
// dallo schieramento (prepareBattle, finishBattle) e le gioca il bot (sim/game.js). L'ora è un orologio finto
// (SIM.campaign) che va avanti solo con quello che fa il bot, e il seme di ogni battaglia è l'ora a cui parte, come nel
// gioco: lo stesso seme fa sempre la stessa campagna. A ogni giro il bot si occupa del villaggio, poi fa una cosa sola:
// la sfida se si può (del primo cantiere che ce l'ha), la battaglia della casella se è da vincere (le perse si
// riprovano), l'attesa delle razioni se
// non bastano, la battaglia della prossima casella se ne ha aperto lo schieramento, altrimenti un passo (o, davanti a
// una battaglia, apre il suo schieramento). Restituisce il diario di ogni area conquistata (openArea), dove si è
// bloccata (stuck: il diario dell'area fino a lì, con perché, reason losses o guard, le perse di fila e il tipo di
// battaglia; null se non si è bloccata), i giri fatti (turns), il tempo di tutta la campagna e delle attese (ms,
// waitMs) e il profilo alla fine
export function playCampaign(seed, areaCount = WORLD.road.length) {
  const { startMs, seedMs, guard } = SIM.campaign;
  const clock = { time: startMs + seed * seedMs };
  const start = clock.time;
  // Il salvataggio resta in memoria: in sola lettura non si rilegge e non si scrive sul telefono. Gli eventi delle
  // azioni non li ascolta nessuno, il diario lo scrive il bot
  const save = { profile: createProfile(), readOnly: true, status: 'new' };
  // I giorni delle missioni senza fuso orario: la stessa campagna su ogni computer
  const actions = createMetaActions({ save, emit: () => {}, now: () => clock.time, dayOf: utcDay });
  const log = { areas: [], current: openArea(0, start), losses: 0, waitMs: 0, stuck: null };
  // lineup: l'ultima casella con una battaglia di cui il bot ha aperto lo schieramento (null all'inizio)
  const run = { actions, save, clock, log, lineup: null };
  const goal = Math.min(areaCount, WORLD.road.length);
  const playing = () => log.areas.length < goal && log.stuck === null;
  let turns = 0;
  while (turns < guard && playing()) {
    playTurn(run);
    turns += 1;
  }
  if (playing()) log.stuck = { reason: 'guard', losses: log.losses, kind: null };
  const { current } = log;
  const stuck = log.stuck === null ? null : { ...current, ms: clock.time - current.startMs, ...log.stuck };
  const { areas, waitMs } = log;
  return { seed, areas, stuck, turns, ms: clock.time - start, waitMs, profile: save.profile };
}

// Un giro del bot: il villaggio, poi una cosa sola tra sfida, battaglia della casella, attesa delle razioni e passo.
// Come nel gioco, toccando la prossima casella con una battaglia se ne apre lo schieramento (il tempo di un passo) e
// la battaglia parte al giro dopo, se prima non c'è la sfida: le razioni si pagano partendo
function playTurn(run) {
  const { actions, save, clock } = run;
  manage(run);
  const { profile } = save;
  const next = nextTile(profile);
  const challenge = profile.village.sites.find(({ building }) => canChallenge(profile, building, clock.time));
  if (challenge !== undefined) fight(run, { kind: 'challenge', building: challenge.building });
  else if (!profile.road.done) fight(run, { kind: 'road', tile: profile.road.at });
  else if (rationsShort(profile)) wait(run);
  else if (next !== null && run.lineup === next.index) fight(run, { kind: 'road', tile: next.index });
  else if (next !== null && isBattle(next)) openLineup(run, next.index);
  else if (actions.step() !== null) clock.time += SIM.campaign.stepMs;
}

// Toccata la casella index, con una battaglia: si apre il suo schieramento, senza pagare niente
function openLineup(run, index) {
  run.lineup = index;
  run.clock.time += SIM.campaign.stepMs;
}

// Il villaggio (ogni azione lo porta prima ad adesso): le missioni del giorno finite si ritirano, le razioni della
// fattoria entrano tra le risorse, i caduti si riaddestrano se restano le razioni per il prossimo passo, il prossimo
// obiettivo si costruisce finché ci sono posti cantiere liberi, i cantieri lunghi si accelerano (nell'ordine in cui si
// sono aperti), le piastrine si spendono nel reclutamento, gli eroi che si ottengono con i frammenti si prendono, i
// posti vuoti dello schieramento si riempiono, i frammenti si spendono in stelle e gradi del potere (spendFragments) e
// l'esperienza sugli eroi schierati (train)
function manage({ actions, save, clock }) {
  save.profile.daily.missions.forEach((_, index) => actions.claimMission(index));
  actions.collectRations();
  retrain(actions, save.profile);
  while (build(actions, save.profile));
  for (const { building } of [...save.profile.village.sites]) {
    const longer = () => timeLeft(save.profile, building, clock.time) > minutesToMs(SIM.campaign.gemsAboveMinutes);
    while (longer() && actions.useGem(building));
  }
  while (save.profile.resources.dogTags >= RECRUIT.cost) actions.recruit();
  for (const id of Object.keys(save.profile.heroes)) actions.assembleHero(id);
  fillLineup(actions, save);
  spendFragments(actions, save.profile);
  train(actions, save.profile);
}

// I caduti si riaddestrano se, pagato, restano le razioni per il prossimo passo (meta/barracks.js)
function retrain(actions, profile) {
  const next = nextTile(profile);
  const keep = next === null ? 0 : stepCost(next);
  if (profile.resources.rations - retrainCost(profile).rations >= keep) actions.startRetrain();
}

// I frammenti di ogni eroe vanno nel passo che costa meno, stella o grado del potere (a pari costo il grado), finché
// bastano
function spendFragments(actions, profile) {
  for (const [id, record] of Object.entries(profile.heroes)) {
    const cheaperGrade = () => (gradeCost(record.grade) ?? Infinity) <= (starCost(record.stars) ?? Infinity);
    while (cheaperGrade() ? actions.gradeUp(id) : actions.starUp(id));
  }
}

// Gli eroi dello schieramento salgono di livello finché si può pagare (meta/heroes.js trainBlock), uno alla volta
// quello con il livello più basso; a pari livello il primo dello schieramento
function train(actions, profile) {
  for (;;) {
    const ready = profile.lineup.filter((id) => id !== null && trainBlock(profile, id) === null);
    if (ready.length === 0) return;
    const level = (id) => profile.heroes[id].level;
    actions.trainHero(ready.reduce((low, id) => (level(id) < level(low) ? id : low)));
  }
}

// Il prossimo obiettivo del villaggio (meta/village.js nextGoal), se lo si può pagare: un edificio già messo sale di
// livello, uno nuovo va nel posto libero più vicino al centro del villaggio, nel territorio di adesso. Dice se il
// cantiere è partito
function build(actions, profile) {
  const goal = nextGoal(profile);
  if (goal === null || !canUpgrade(profile, goal.building)) return false;
  const { building } = goal;
  const { positions } = profile.village;
  if (positions[building] !== null) return actions.startUpgrade(building);
  const spot = freeSpot(positions, building, conqueredAreas(profile.road));
  return spot !== null && actions.placeBuilding(building, spot);
}

// I posti vuoti dello schieramento (mai quello del capo, sempre pieno) prendono uno alla volta l'eroe posseduto e
// fuori dallo schieramento che dà alla squadra più potenza (systems/power.js); a pari potenza il primo dei dati
function fillLineup(actions, save) {
  for (let slot = save.profile.lineup.indexOf(null); slot > 0; slot = save.profile.lineup.indexOf(null)) {
    const best = strongestBench(save.profile);
    if (best === null || !actions.placeHero(slot, best)) return;
  }
}

function strongestBench(profile) {
  const { heroes, lineup } = profile;
  const loadout = loadoutFrom(profile);
  const power = (id) => armyPower({ ...loadout, heroes: [...loadout.heroes, { hero: heroData(id, heroes[id]) }] });
  const bench = Object.keys(heroes).filter((id) => heroes[id].owned && !lineup.includes(id));
  return bench.sort((a, b) => power(b) - power(a))[0] ?? null;
}

// Una battaglia come la fa partire lo schieramento (context: road con la casella tile, o challenge con l'edificio del
// suo cantiere, building, che si spende partendo), con l'ora come seme. Finita passa al meta-gioco; una che non
// finisce in tempo è lasciata a metà e non conta, come nel gioco. Se i caduti si stanno riaddestrando si aspetta che
// tornino (è un'attesa). L'ora va avanti della battaglia, poi di schieramento e riepilogo
function fight(run, context) {
  const { actions, clock, save, log } = run;
  const training = save.profile.retrain === null ? 0 : Math.max(0, save.profile.retrain.endsAt - clock.time);
  clock.time += training;
  log.current.waitMs += training;
  log.waitMs += training;
  const makeLoadout = actions.prepareBattle(context);
  if (makeLoadout === null) return;
  const loadout = makeLoadout();
  const battle = playBattle(clock.time, loadout);
  clock.time += battle.ms;
  const outcome = battle.over ? actions.finishBattle(context, battleResult(battle)) : null;
  clock.time += SIM.campaign.overheadMs;
  noteBattle(run, context, loadout, battle.mission.completed, outcome?.conquest ?? null);
}

// Le razioni non bastano per il prossimo passo: si aspetta che la fattoria le faccia, ma si torna prima se intanto
// finisce un cantiere (per aprire il prossimo); se la fattoria non produce, SIM.campaign.idleWaitMs o fino alla fine
// del primo cantiere (forse è lei). Almeno minWaitMs: a un niente dalla razione intera il tempo non andrebbe avanti
function wait({ save, clock, log }) {
  const { profile } = save;
  const { minWaitMs, idleWaitMs } = SIM.campaign;
  const missing = stepCost(nextTile(profile)) - profile.resources.rations;
  const ready = nextRationIn(profile, missing) ?? idleWaitMs;
  const building = timeLeft(profile, firstSite(profile)?.building, clock.time);
  const ms = Math.max(minWaitMs, building > 0 ? Math.min(ready, building) : ready);
  clock.time += ms;
  log.current.waitMs += ms;
  log.waitMs += ms;
}

// Il diario dell'area numero area (da 0) da quando ci si arriva (startMs): quanto ci si mette a conquistarla (ms) e
// quanto si aspetta (waitMs); le battaglie vinte e perse per tipo (battles: normal, boss, double, triple e challenge,
// la sfida); la forza della squadra (systems/power.js armyPower) e il rapporto di potenza di ogni battaglia della
// strada (powers e ratios); le battaglie perse di fila al massimo,
// tutte sulla stessa casella, che non si lascia finché non è vinta (worst: quante e il tipo); alla conquista i livelli
// del villaggio, gli eroi schierati con livello, stelle e grado, e le risorse
function openArea(area, startMs) {
  const worst = { losses: 0, kind: null };
  const conquest = { village: null, heroes: null, resources: null };
  return { area, startMs, ms: 0, waitMs: 0, battles: {}, powers: [], ratios: [], worst, ...conquest };
}

// Una battaglia giocata (vinta o no, con la conquista che ha dato, o null) entra nel diario dell'area; quelle della
// strada contano per le perse di fila, fino al blocco a SIM.campaign.maxLosses. Il boss battuto chiude l'area
function noteBattle(run, context, loadout, won, conquest) {
  const { log } = run;
  const area = log.current;
  const kind = battleKind(context);
  area.battles[kind] ??= { won: 0, lost: 0 };
  area.battles[kind][won ? 'won' : 'lost'] += 1;
  if (context.kind !== 'road') return;
  area.powers.push(armyPower(loadout));
  area.ratios.push(armyPower(loadout) / levelPower(loadout.rules));
  log.losses = won ? 0 : log.losses + 1;
  if (log.losses > area.worst.losses) area.worst = { losses: log.losses, kind };
  if (log.losses >= SIM.campaign.maxLosses) log.stuck = { reason: 'losses', losses: log.losses, kind };
  if (conquest !== null) closeArea(run);
}

// Il tipo di battaglia per il diario: quello di una della strada (data/waves.js BATTLE_TYPES), o challenge per la sfida
function battleKind(context) {
  return context.kind === 'challenge' ? 'challenge' : ROAD_TILES[context.tile].rules.type;
}

// L'area conquistata: si chiude con com'è il profilo adesso, e comincia la prossima
function closeArea({ log, save, clock }) {
  const area = log.current;
  const { village, lineup, heroes, resources } = save.profile;
  area.ms = clock.time - area.startMs;
  area.village = { ...village.levels };
  const placed = lineup.filter((id) => id !== null);
  area.heroes = placed.map((id) => ({ id, level: heroes[id].level, stars: heroes[id].stars, grade: heroes[id].grade }));
  area.resources = { ...resources };
  log.areas.push(area);
  log.current = openArea(area.area + 1, clock.time);
}
