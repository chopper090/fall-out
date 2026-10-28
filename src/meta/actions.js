import { now as clockNow } from '../core/clock.js';
import { META_EVENTS as E } from '../core/events.js';
import { clearSave, refreshSave, writeSave } from '../core/save.js';
import { localDay, minutesToMs } from '../core/time.js';
import { DAILY } from '../data/daily.js';
import { RECRUIT } from '../data/growth.js';
import { VILLAGE } from '../data/village.js';
import { advanceByBattle, advanceMission, claimMission, dailyRules, refreshDaily, startDaily } from './daily.js';
import { assembleHero, assembledFor, giveFragments, placeHero, recruit, starUp, trainHero } from './heroes.js';
import { loadoutFrom } from './loadout.js';
import { recordBattle } from './profile.js';
import { grantRewards } from './rewards.js';
import { ROAD_TILES, enterBattle, loseRoadTile, walk, winRoadTile } from './road.js';
import {
  collectRations,
  moveBuilding,
  placeBuilding,
  settle,
  siteOf,
  startChallenge,
  startUpgrade,
  useGem,
  winChallenge,
} from './village.js';

// Le azioni del giocatore sul meta-gioco, in un posto solo: le scene le chiamano invece di cambiare il profilo e
// salvare da sole. Ognuna rilegge il salvataggio save (un'altra finestra del gioco può averlo cambiato; non in sola
// lettura e non dopo una scrittura non riuscita, quando i cambi della partita stanno solo in memoria), porta il
// villaggio ad adesso (now, di base l'orologio del gioco; dayOf il giorno delle missioni, di base del telefono) e fa
// il suo cambio. Se ha cambiato qualcosa salva e lo dice
// con emit (META_EVENTS di core/events.js); se no non salva e non dice niente. Porta ad adesso anche il giorno delle
// missioni (meta/daily.js), e le azioni che le missioni contano le fanno avanzare. Le azioni prendono id e posti, mai
// profili: il profilo si rilegge ogni volta, e uno tenuto da prima sarebbe vecchio
export function createMetaActions({ save, emit, now = clockNow, dayOf = localDay }) {
  // Un'azione (action, il suo nome): change(profile, time) fa il cambio e restituisce il risultato dell'azione;
  // report(risultato, profile) dice cosa è successo, con gli eventi da dire ([nome, dati]), o un valore falso se non è
  // cambiato niente. Si dice anche ogni cantiere finito: prima degli eventi dell'azione se è finito portando il
  // villaggio ad adesso, dopo se è finito con l'azione (la gemma)
  function run(action, change, report) {
    if (!save.readOnly && !save.writeFailed) refreshSave(save);
    const { profile } = save;
    const time = now();
    const before = { ...profile.village.levels };
    // Il giorno nuovo da solo non si salva: le sue missioni si ripescano uguali dal giorno
    refreshDaily(profile, time, dayOf);
    const caughtUp = settle(profile, time);
    const levels = { ...profile.village.levels };
    const result = change(profile, time);
    const told = report(result, profile);
    if (!caughtUp && !told) return result;
    writeSave(save);
    const events = [...finished(before, levels), ...(told || []), ...finished(levels, profile.village.levels)];
    announce(told ? action : 'settle', events);
    return result;
  }

  // Gli eventi, poi SAVE_FAILED se l'ultima scrittura non è riuscita, per ultimo PROFILE_CHANGED
  function announce(action, events) {
    for (const [name, payload] of events) emit(name, payload);
    if (save.writeFailed) emit(E.SAVE_FAILED);
    emit(E.PROFILE_CHANGED, { action });
  }

  // Il profilo portato ad adesso, letto da read senza cambiarlo
  const settled = (read = () => undefined) => run('settle', read, () => false);

  const actions = {
    // Il villaggio portato ad adesso, e nient'altro
    settle: () => settled(),

    // Un passo sulla strada verso una casella senza battaglia (meta/road.js walk): la casella nuova e il premio di una
    // raccolta, o null. In una battaglia si entra partendo (prepareBattle)
    step: () => run('step', walk, (moved) => moved && [[E.STEPPED, moved]]),

    // Le razioni pronte della fattoria entrano tra le risorse; restituisce quante
    collectRations: () =>
      run(
        'collectRations',
        counted('harvests', collectRations),
        (amount) => amount > 0 && [[E.RATIONS_COLLECTED, { amount }]],
      ),

    // Il cantiere per il prossimo livello dell'edificio id, già messo, in un posto cantiere libero. Dice se è partito
    startUpgrade: (id) =>
      run(
        'startUpgrade',
        counted('builds', (profile, time) => startUpgrade(profile, id, time)),
        started(id),
      ),

    // Il primo livello dell'edificio id con l'angolo nord nella cella cell. Dice se il cantiere è partito
    placeBuilding: (id, cell) =>
      run(
        'placeBuilding',
        counted('builds', (profile, time) => placeBuilding(profile, id, cell, time)),
        started(id),
      ),

    // L'edificio id, già messo, con l'angolo nord nella cella cell. Dice se si è spostato
    moveBuilding: (id, cell) =>
      run(
        'moveBuilding',
        (profile) => moveBuilding(profile, id, cell),
        (done) => done && [],
      ),

    // Una gemma sul cantiere dell'edificio id. Dice se è stata usata
    useGem: (id) => {
      const shorten = (profile, time) =>
        useGem(profile, id, time) ? { building: id, ms: minutesToMs(VILLAGE.gemMinutes) } : null;
      const report = (shortened) => shortened && [[E.CONSTRUCTION_SHORTENED, shortened]];
      return run('useGem', shorten, report) !== null;
    },

    // La sfida del cantiere dell'edificio id si spende. Dice se si poteva
    startChallenge: (id) =>
      run(
        'startChallenge',
        (profile, time) => startChallenge(profile, id, time),
        (done) => done && [],
      ),

    // La battaglia della casella index della strada parte (meta/road.js enterBattle): nella prossima si entra adesso,
    // con un passo che paga le sue razioni; in quella dove si è, da vincere, non si paga di nuovo. Dice se parte
    enterBattle: (index) => {
      const enter = (profile) => enterBattle(profile, index);
      return run('enterBattle', enter, ({ moved }) => moved !== null && [[E.STEPPED, moved]]).ready;
    },

    // La sfida del giorno id si spende. Dice se si poteva
    startDaily: (id) =>
      run(
        'startDaily',
        (profile) => startDaily(profile, id),
        (done) => done && [],
      ),

    // Prima di una battaglia (context, come battleContext: kind road con la sua casella tile, challenge con l'edificio
    // del suo cantiere, building, o daily con la sfida del giorno, daily): la sfida si spende, sulla strada si entra
    // nella casella (enterBattle); se intanto la battaglia non può più partire restituisce null. Altrimenti la funzione
    // che costruisce la squadra a ogni partenza, con il villaggio di quel momento (ricominciando prende i numeri di
    // allora, senza pagare di nuovo). Le regole della sfida del giorno si fissano partendo
    prepareBattle: (context) => {
      if (context.kind === 'challenge' && !actions.startChallenge(context.building)) return null;
      if (context.kind === 'daily' && !actions.startDaily(context.daily)) return null;
      if (context.kind === 'road' && !actions.enterBattle(context.tile)) return null;
      const rules = battleRulesOf(context, save.profile);
      return () => settled((profile) => loadoutFrom(profile, rules));
    },

    // Una battaglia finita (result: systems/battle.js battleResult) del suo context: entra nelle statistiche, dà i suoi
    // premi e fa avanzare le missioni del giorno; la sfida vinta, al posto del premio della vittoria, toglie tempo al
    // suo cantiere, e la sfida del giorno vinta dà le sue gemme e i frammenti del mitico del giorno; la casella della
    // strada vinta è fatta (il boss conquista la sua area, che dà anche i frammenti del suo mitico: RECRUIT.fragments),
    // persa per la prima volta dà la consolazione. Restituisce i premi (meta/rewards.js grantRewards), la sfida
    // ({ saved: i millisecondi tolti }, null se non era una sfida), la sfida del giorno ({ id, gems e fragments avuti:
    // { id, amount }, null se persa }, null se non lo era) e la conquista (con fragments come sopra; null se non c'è
    // stata)
    finishBattle: (context, result) => {
      const finish = (profile, time) => {
        const isChallenge = context.kind === 'challenge';
        const isDaily = context.kind === 'daily';
        recordBattle(profile, result);
        const firstLoss = context.kind === 'road' && !result.completed && loseRoadTile(profile, context.tile);
        const rewards = grantRewards(profile, result, { prize: context.kind === 'road', consolation: firstLoss });
        const saved = isChallenge && result.completed ? winChallenge(profile, context.building, time) : 0;
        const dailyWon = isDaily && result.completed;
        const gems = dailyWon ? DAILY.challenges[context.daily].gems : 0;
        profile.resources.gems += gems;
        const mythic = (index, amount) => giveFragments(profile, assembledFor(index), amount);
        const fragments = dailyWon ? mythic(Math.max(0, profile.daily.day), RECRUIT.fragments.daily) : null;
        const won = context.kind === 'road' && result.completed ? winRoadTile(profile, context.tile) : null;
        const conquest = won && { ...won, fragments: mythic(won.area, RECRUIT.fragments.conquest) };
        advanceByBattle(profile, context, result, rewards.kept);
        const daily = isDaily ? { id: context.daily, gems, fragments } : null;
        return { rewards, challenge: isChallenge ? { saved } : null, daily, conquest };
      };
      return run('finishBattle', finish, (outcome) => battleEvents(context, result, outcome));
    },

    // La missione del giorno numero index, finita, si ritira: le sue gemme (e, se è l'ultima, quelle di tutte).
    // Restituisce le gemme avute, 0 se non si poteva
    claimMission: (index) =>
      run(
        'claimMission',
        (profile) => claimMission(profile, index),
        (gems, profile) => gems > 0 && [[E.MISSION_CLAIMED, { id: profile.daily.missions[index].id, gems }]],
      ),

    // L'eroe id (posseduto) nel posto slot, o il posto vuoto con id null (meta/heroes.js placeHero). Dice se lo
    // schieramento è cambiato
    placeHero: (slot, id) => {
      const place = (profile) => {
        const before = JSON.stringify(profile.lineup);
        placeHero(profile, slot, id);
        return JSON.stringify(profile.lineup) !== before;
      };
      return run('placeHero', place, (done) => done && [[E.HERO_PLACED, { slot, id }]]);
    },

    // Un tiro del reclutamento (meta/heroes.js recruit): cosa è uscito, o null senza piastrine
    recruit: () => run('recruit', counted('recruits', recruit), (pulled) => pulled && [[E.HERO_RECRUITED, pulled]]),

    // L'eroe id, che il reclutamento non dà, diventa tuo con i suoi frammenti (meta/heroes.js assembleHero). Dice se è
    // successo
    assembleHero: (id) =>
      run(
        'assembleHero',
        (profile) => assembleHero(profile, id),
        (done) => done && [[E.HERO_ASSEMBLED, { id }]],
      ),

    // Una stella in più all'eroe id, se ha i frammenti. Dice se è salito
    starUp: (id) =>
      run(
        'starUp',
        (profile) => starUp(profile, id),
        (done, profile) => done && [[E.HERO_STARRED, { id, stars: profile.heroes[id].stars }]],
      ),

    // Un livello in più all'eroe id con l'esperienza e i materiali delle scorte (meta/heroes.js trainHero). Dice se è
    // salito
    trainHero: (id) =>
      run(
        'trainHero',
        (profile) => trainHero(profile, id),
        (done, profile) => done && [[E.HERO_TRAINED, { id, level: profile.heroes[id].level }]],
      ),

    // Si riparte da zero (core/save.js clearSave)
    clearSave: () => {
      clearSave(save);
      announce('clearSave', [[E.SAVE_CLEARED]]);
    },
  };
  return actions;
}

// Il cambio change di un'azione che la missione del giorno kind conta: se riesce (un risultato vero o un numero sopra
// zero) la missione avanza di uno
function counted(kind, change) {
  return (profile, time) => {
    const result = change(profile, time);
    if (result) advanceMission(profile, kind);
    return result;
  };
}

// Le regole della battaglia di context: quelle della sfida del cantiere, della sfida del giorno o della casella
function battleRulesOf(context, profile) {
  if (context.kind === 'challenge') return VILLAGE.challenge.rules;
  if (context.kind === 'daily') return dailyRules(profile, context.daily);
  return ROAD_TILES[context.tile].rules;
}

// Cosa dice l'azione che apre il cantiere dell'edificio building: il cantiere appena partito, se è partito (done)
function started(building) {
  return (done, profile) => done && [[E.CONSTRUCTION_STARTED, { building, endsAt: siteOf(profile, building).endsAt }]];
}

// I cantieri finiti tra i livelli degli edifici from e quelli di to, con il livello nuovo, nell'ordine degli edifici
function finished(from, to) {
  const risen = Object.keys(from).filter((id) => to[id] > from[id]);
  return risen.map((building) => [E.CONSTRUCTION_FINISHED, { building, level: to[building] }]);
}

// Una battaglia finita entra nelle statistiche; la sfida vinta accorcia il suo cantiere, il boss battuto conquista
// l'area
function battleEvents(context, result, { rewards, challenge, conquest }) {
  const events = [[E.BATTLE_RECORDED, { context, result, rewards }]];
  if (challenge?.saved > 0) {
    events.push([E.CONSTRUCTION_SHORTENED, { building: context.building, ms: challenge.saved }]);
  }
  if (conquest !== null) events.push([E.AREA_CONQUERED, conquest]);
  return events;
}
