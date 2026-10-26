import { now as clockNow } from '../core/clock.js';
import { META_EVENTS as E } from '../core/events.js';
import { clearSave, refreshSave, writeSave } from '../core/save.js';
import { minutesToMs } from '../core/time.js';
import { VILLAGE } from '../data/village.js';
import { placeHero, recruit, starUp } from './heroes.js';
import { loadoutFrom } from './loadout.js';
import { recordBattle } from './profile.js';
import { grantRewards } from './rewards.js';
import { ROAD_TILES, enterBattle, walk, winRoadTile } from './road.js';
import {
  collectRations,
  moveBuilding,
  placeBuilding,
  settle,
  startChallenge,
  startUpgrade,
  useAccelerator,
  winChallenge,
} from './village.js';

// Le azioni del giocatore sul meta-gioco, in un posto solo: le scene le chiamano invece di cambiare il profilo e
// salvare da sole. Ognuna rilegge il salvataggio save (un'altra finestra del gioco può averlo cambiato; non in sola
// lettura e non dopo una scrittura non riuscita, quando i cambi della partita stanno solo in memoria), porta il
// villaggio ad adesso (now, di base l'orologio del gioco) e fa il suo cambio. Se ha cambiato qualcosa salva e lo dice
// con emit (META_EVENTS di core/events.js); se no non salva e non dice niente. Le azioni prendono id e posti, mai
// profili: il profilo si rilegge ogni volta, e uno tenuto da prima sarebbe vecchio
export function createMetaActions({ save, emit, now = clockNow }) {
  // Un'azione (action, il suo nome): change(profile, time) fa il cambio e restituisce il risultato dell'azione;
  // report(risultato, profile) dice cosa è successo, con gli eventi da dire ([nome, dati]), o un valore falso se non è
  // cambiato niente. Si dice anche un cantiere finito: prima degli eventi dell'azione se è finito portando il villaggio
  // ad adesso, dopo se è finito con l'azione (l'acceleratore)
  function run(action, change, report) {
    if (!save.readOnly && !save.writeFailed) refreshSave(save);
    const { profile } = save;
    const time = now();
    const before = { ...profile.village.levels };
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
      run('collectRations', collectRations, (amount) => amount > 0 && [[E.RATIONS_COLLECTED, { amount }]]),

    // Il cantiere per il prossimo livello dell'edificio id, già messo. Dice se è partito
    startUpgrade: (id) => run('startUpgrade', (profile, time) => startUpgrade(profile, id, time), started),

    // Il primo livello dell'edificio id con l'angolo nord nella cella cell. Dice se il cantiere è partito
    placeBuilding: (id, cell) =>
      run('placeBuilding', (profile, time) => placeBuilding(profile, id, cell, time), started),

    // L'edificio id, già messo, con l'angolo nord nella cella cell. Dice se si è spostato
    moveBuilding: (id, cell) => run('moveBuilding', (profile) => moveBuilding(profile, id, cell), (done) => done && []),

    // Un acceleratore sul cantiere aperto. Dice se è stato usato
    useAccelerator: () => {
      const shorten = (profile, time) => {
        const building = profile.village.construction?.building;
        return useAccelerator(profile, time) ? { building, ms: minutesToMs(VILLAGE.acceleratorMinutes) } : null;
      };
      const report = (shortened) => shortened && [[E.CONSTRUCTION_SHORTENED, shortened]];
      return run('useAccelerator', shorten, report) !== null;
    },

    // La sfida del cantiere aperto si spende. Dice se si poteva
    startChallenge: () => run('startChallenge', startChallenge, (done) => done && []),

    // La battaglia della casella index della strada parte (meta/road.js enterBattle): nella prossima si entra adesso,
    // con un passo che paga le sue razioni; in quella dove si è, da vincere, non si paga di nuovo. Dice se parte
    enterBattle: (index) => {
      const enter = (profile) => enterBattle(profile, index);
      return run('enterBattle', enter, ({ moved }) => moved !== null && [[E.STEPPED, moved]]).ready;
    },

    // Prima di una battaglia (context, come battleContext: kind road con la sua casella tile, o challenge): la sfida si
    // spende, sulla strada si entra nella casella (enterBattle); se intanto la battaglia non può più partire
    // restituisce null. Altrimenti la funzione che costruisce la squadra a ogni partenza, con il villaggio di quel
    // momento (ricominciando prende i numeri di allora, senza pagare di nuovo)
    prepareBattle: (context) => {
      if (context.kind === 'challenge' && !actions.startChallenge()) return null;
      if (context.kind === 'road' && !actions.enterBattle(context.tile)) return null;
      const rules = context.kind === 'challenge' ? VILLAGE.challenge.rules : ROAD_TILES[context.tile].rules;
      return () => settled((profile) => loadoutFrom(profile, rules));
    },

    // Una battaglia finita (result: systems/battle.js battleResult) del suo context: entra nelle statistiche e dà i
    // suoi premi; la sfida vinta, al posto del premio della vittoria, toglie tempo al cantiere; la casella della strada
    // vinta è fatta (il boss conquista la sua area). Restituisce i premi (meta/rewards.js grantRewards), la sfida
    // ({ saved: i millisecondi tolti }, null se non era una sfida) e la conquista (null se non c'è stata)
    finishBattle: (context, result) => {
      const finish = (profile, time) => {
        const isChallenge = context.kind === 'challenge';
        recordBattle(profile, result);
        const rewards = grantRewards(profile, result, { prize: !isChallenge });
        const saved = isChallenge && result.completed ? winChallenge(profile, time) : 0;
        const conquest = context.kind === 'road' && result.completed ? winRoadTile(profile, context.tile) : null;
        return { rewards, challenge: isChallenge ? { saved } : null, conquest };
      };
      return run('finishBattle', finish, (outcome, profile) => battleEvents(context, result, outcome, profile));
    },

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
    recruit: () => run('recruit', recruit, (pulled) => pulled && [[E.HERO_RECRUITED, pulled]]),

    // Una stella in più all'eroe id, se ha i frammenti. Dice se è salito
    starUp: (id) =>
      run(
        'starUp',
        (profile) => starUp(profile, id),
        (done, profile) => done && [[E.HERO_STARRED, { id, stars: profile.heroes[id].stars }]],
      ),

    // Si riparte da zero (core/save.js clearSave)
    clearSave: () => {
      clearSave(save);
      announce('clearSave', [[E.SAVE_CLEARED]]);
    },
  };
  return actions;
}

// Il cantiere appena partito, se è partito (done)
function started(done, profile) {
  if (!done) return false;
  const { building, endsAt } = profile.village.construction;
  return [[E.CONSTRUCTION_STARTED, { building, endsAt }]];
}

// I cantieri finiti tra i livelli degli edifici from e quelli di to, con il livello nuovo
function finished(from, to) {
  const risen = Object.keys(from).filter((id) => to[id] > from[id]);
  return risen.map((building) => [E.CONSTRUCTION_FINISHED, { building, level: to[building] }]);
}

// Una battaglia finita entra nelle statistiche; la sfida vinta accorcia il cantiere, il boss battuto conquista l'area
function battleEvents(context, result, { rewards, challenge, conquest }, profile) {
  const events = [[E.BATTLE_RECORDED, { context, result, rewards }]];
  if (challenge?.saved > 0) {
    events.push([E.CONSTRUCTION_SHORTENED, { building: profile.village.construction.building, ms: challenge.saved }]);
  }
  if (conquest !== null) events.push([E.AREA_CONQUERED, conquest]);
  return events;
}
