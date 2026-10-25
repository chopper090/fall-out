import { LEVEL, TEST_BATTLE } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { BOSS, DEFAULT_LENGTH, LENGTHS, WAVES } from '../data/waves.js';

// Avanzamento del livello: prima di ogni ondata una pausa di LEVEL.breakSeconds senza nuovi arrivi
// (LEVEL.firstBreakSeconds prima della prima), in cui l'ondata viene annunciata e il campo prende già la sua
// velocità; poi l'ondata dura duration secondi. Le ondate sono le prime della durata della battaglia (plan,
// battlePlan). Dopo l'ultima, se la battaglia ha il boss, con un'altra pausa arriva lui, ma solo a strada libera: il
// campo si ferma al suo arrivo e niente deve restare fermo in strada. La sua fase dura finché il boss resta sulla
// strada. Poi (o subito dopo l'ultima ondata, senza boss) si aspetta che la strada sia di nuovo libera e il livello è
// completato. sinceAnnounceMs: tempo dall'annuncio dell'ultima ondata o dall'arrivo del boss, per la scritta;
// bossNext: dopo l'ultima ondata viene il boss. Con LEVEL.startWithBoss la partita parte direttamente dal boss (se la
// battaglia ce l'ha).
// Eventi: WAVE_ANNOUNCED e WAVE_STARTED con { index, wave }, WAVE_ENDED, BOSS_STARTED con { boss, hpScale } (i numeri
// del boss, BOSS, e quante volte ha la sua vita), LEVEL_COMPLETED
export const WAVE_PHASES = {
  pending: 'pending',
  break: 'break',
  wave: 'wave',
  boss: 'boss',
  clearing: 'clearing',
  complete: 'complete',
};

// La battaglia con le regole rules: la sua durata (data/waves.js LENGTHS: quante ondate, waves; se alla fine c'è il
// boss, boss, e quante volte ha la sua vita, bossHpScale; il peso della potenza del livello, powerScale) e quanto sono
// duri e fitti i nemici (hpScale e countScale: le regole e la difficoltà di prova, TEST_BATTLE)
export function battlePlan(rules = null) {
  const length = LENGTHS[rules?.length ?? DEFAULT_LENGTH];
  return {
    waves: length.waves,
    boss: length.boss,
    bossHpScale: length.boss ? length.bossHpScale : 0,
    powerScale: length.powerScale,
    hpScale: (rules?.enemyHpScale ?? 1) * TEST_BATTLE.enemyHpScale,
    countScale: TEST_BATTLE.enemyCountScale,
  };
}

// La battaglia è arrivata al boss (o l'ha già battuto); mai in una battaglia senza boss
export function reachedBoss(waves) {
  return waves.boss && [WAVE_PHASES.boss, WAVE_PHASES.clearing, WAVE_PHASES.complete].includes(waves.phase);
}

export function createWaves(bus, plan) {
  const last = plan.waves - 1;
  const fromBoss = LEVEL.startWithBoss && plan.boss;
  const first = fromBoss ? last : Math.min(plan.waves, Math.max(1, LEVEL.startWave)) - 1;
  const state = {
    index: first,
    count: plan.waves,
    boss: plan.boss,
    bossHpScale: plan.bossHpScale,
    phase: WAVE_PHASES.pending,
    bossNext: fromBoss,
    elapsedMs: 0,
    breakMs: secondsToMs(LEVEL.firstBreakSeconds),
    sinceAnnounceMs: 0,
    bus,
  };
  // La fase del boss finisce quando il boss lascia la strada, cioè quando viene abbattuto
  bus.on(EVENTS.BOSS_ENDED, () => {
    if (state.phase === WAVE_PHASES.boss) state.phase = WAVE_PHASES.clearing;
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
      state.elapsedMs = 0;
      state.sinceAnnounceMs = 0;
      state.phase = WAVE_PHASES.boss;
      bus.emit(EVENTS.BOSS_STARTED, { boss: BOSS, hpScale: state.bossHpScale });
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

// Prima del boss c'è la pausa, ma la sua scritta aspetta il suo arrivo
function announce(state, elapsedMs = 0) {
  state.phase = WAVE_PHASES.break;
  state.elapsedMs = elapsedMs;
  if (state.bossNext) return;
  state.sinceAnnounceMs = elapsedMs;
  state.bus.emit(EVENTS.WAVE_ANNOUNCED, { index: state.index, wave: WAVES[state.index] });
}
