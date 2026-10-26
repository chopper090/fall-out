import { LEVEL, TEST_BATTLE } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { BATTLE_TYPES, BOSS, DEFAULT_TYPE, WAVES } from '../data/waves.js';

// Avanzamento del livello: prima di ogni ondata una pausa di LEVEL.breakSeconds senza nuovi arrivi
// (LEVEL.firstBreakSeconds prima della prima), in cui l'ondata viene annunciata e il campo prende già la sua
// velocità; poi l'ondata dura duration secondi. Le ondate sono le prime del tipo della battaglia (plan, battlePlan).
// Dopo l'ultima, se la battaglia ha i boss, arrivano i loro gruppi uno dopo l'altro: ogni gruppo dopo una pausa e solo
// a strada libera (il campo si ferma al suo arrivo e niente deve restare fermo in strada), e la sua fase dura finché
// i suoi boss restano sulla strada (bossesLeft). Poi (o subito dopo l'ultima ondata, senza boss) si aspetta che la
// strada sia di nuovo libera e il livello è completato. sinceAnnounceMs: tempo dall'annuncio dell'ultima ondata o
// dall'arrivo dei boss, per la scritta; bossNext: viene un gruppo di boss (group, il suo numero). Con
// LEVEL.startWithBoss la partita parte direttamente dai boss (se la battaglia li ha).
// Eventi: WAVE_ANNOUNCED e WAVE_STARTED con { index, wave }, WAVE_ENDED, BOSS_STARTED con { boss, group } (i numeri
// del boss, BOSS, e il gruppo: corsia e quante volte la sua vita per ognuno), LEVEL_COMPLETED
export const WAVE_PHASES = {
  pending: 'pending',
  break: 'break',
  wave: 'wave',
  boss: 'boss',
  clearing: 'clearing',
  complete: 'complete',
};

// La battaglia con le regole rules: il suo tipo (type, il nome, e da data/waves.js BATTLE_TYPES: quante ondate, waves;
// i gruppi di boss alla fine, bosses, e se ce n'è almeno uno, boss; il peso della potenza del livello, powerScale),
// quanto sono duri e fitti i nemici (hpScale e countScale: le regole e la difficoltà di prova, test, di base
// TEST_BATTLE), quanto più spesso arrivano i tipi speciali (specialsScale, per tipo), quanti colpi chiedono scrigni e
// cancelli (hitScale), se i cancelli sono tutti negativi (minusOnly) e quanto sono profondi (deepScale)
export function battlePlan(rules = null, test = TEST_BATTLE) {
  const name = rules?.type ?? DEFAULT_TYPE;
  const type = BATTLE_TYPES[name];
  return {
    type: name,
    waves: type.waves,
    bosses: type.bosses,
    boss: type.bosses.length > 0,
    powerScale: type.powerScale,
    hpScale: (rules?.enemyHpScale ?? 1) * test.enemyHpScale,
    countScale: (rules?.enemyCountScale ?? 1) * test.enemyCountScale,
    specialsScale: rules?.specialsScale ?? {},
    hitScale: rules?.hitScale ?? 1,
    minusOnly: rules?.minusOnly ?? false,
    deepScale: rules?.deepScale ?? 1,
  };
}

// La battaglia è arrivata al boss (o l'ha già battuto, anche solo il primo gruppo); mai in una battaglia senza boss
export function reachedBoss(waves) {
  const phases = [WAVE_PHASES.boss, WAVE_PHASES.clearing, WAVE_PHASES.complete];
  return waves.boss && (phases.includes(waves.phase) || waves.group > 0);
}

export function createWaves(bus, plan) {
  const last = plan.waves - 1;
  const fromBoss = LEVEL.startWithBoss && plan.boss;
  const first = fromBoss ? last : Math.min(plan.waves, Math.max(1, LEVEL.startWave)) - 1;
  const state = {
    index: first,
    count: plan.waves,
    boss: plan.boss,
    bosses: plan.bosses,
    group: 0,
    bossesLeft: 0,
    phase: WAVE_PHASES.pending,
    bossNext: fromBoss,
    elapsedMs: 0,
    breakMs: secondsToMs(LEVEL.firstBreakSeconds),
    sinceAnnounceMs: 0,
    bus,
  };
  // La fase dei boss finisce quando tutti i boss del gruppo lasciano la strada, cioè quando vengono abbattuti: dopo
  // una pausa viene il gruppo successivo, o, dopo l'ultimo, si aspetta la strada libera
  bus.on(EVENTS.BOSS_ENDED, () => {
    if (state.phase !== WAVE_PHASES.boss) return;
    state.bossesLeft -= 1;
    if (state.bossesLeft > 0) return;
    if (state.group < state.bosses.length - 1) {
      state.group += 1;
      state.breakMs = secondsToMs(LEVEL.breakSeconds);
      announce(state);
    } else {
      state.phase = WAVE_PHASES.clearing;
    }
  });
  return state;
}

// roadLeft: nemici, cancelli, scrigni e premi ancora sulla strada, per far arrivare il boss a strada libera e per
// sapere quando il livello è finito davvero
export function updateWaves(state, deltaMs, roadLeft) {
  const { bus } = state;
  const wave = WAVES[state.index];
  if (state.phase === WAVE_PHASES.pending) {
    announce(state);
    return;
  }
  // Il tempo in più oltre la fine di una fase passa alla successiva: le ondate non accumulano ritardo
  state.elapsedMs += deltaMs;
  state.sinceAnnounceMs += deltaMs;
  const waveMs = secondsToMs(wave.duration);
  if (state.phase === WAVE_PHASES.break && state.elapsedMs >= state.breakMs) {
    if (!state.bossNext) {
      state.elapsedMs -= state.breakMs;
      state.phase = WAVE_PHASES.wave;
      bus.emit(EVENTS.WAVE_STARTED, { index: state.index, wave });
    } else if (roadLeft === 0) {
      const group = state.bosses[state.group];
      state.elapsedMs = 0;
      state.sinceAnnounceMs = 0;
      state.phase = WAVE_PHASES.boss;
      state.bossesLeft = group.length;
      bus.emit(EVENTS.BOSS_STARTED, { boss: BOSS, group });
    }
  } else if (state.phase === WAVE_PHASES.wave && state.elapsedMs >= waveMs) {
    state.elapsedMs -= waveMs;
    bus.emit(EVENTS.WAVE_ENDED, { index: state.index, wave });
    if (state.index < state.count - 1) {
      state.index += 1;
    } else if (!state.boss) {
      state.phase = WAVE_PHASES.clearing;
      return;
    } else {
      state.bossNext = true;
    }
    state.breakMs = secondsToMs(LEVEL.breakSeconds);
    announce(state, state.elapsedMs);
  } else if (state.phase === WAVE_PHASES.clearing && roadLeft === 0) {
    state.phase = WAVE_PHASES.complete;
    bus.emit(EVENTS.LEVEL_COMPLETED, state);
  }
}

// Prima dei boss c'è la pausa, ma la loro scritta aspetta il loro arrivo
function announce(state, elapsedMs = 0) {
  state.phase = WAVE_PHASES.break;
  state.elapsedMs = elapsedMs;
  if (state.bossNext) return;
  state.sinceAnnounceMs = elapsedMs;
  state.bus.emit(EVENTS.WAVE_ANNOUNCED, { index: state.index, wave: WAVES[state.index] });
}
