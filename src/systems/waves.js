import { LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { BOSS, WAVES } from '../data/waves.js';

// Avanzamento del livello: prima di ogni ondata una pausa di LEVEL.breakSeconds senza nuovi arrivi
// (LEVEL.firstBreakSeconds prima della prima), in cui l'ondata viene annunciata e il campo prende già la sua
// velocità; poi l'ondata dura duration secondi. Dopo l'ultima, con un'altra pausa, arriva il boss (BOSS):
// la sua fase dura finché il boss resta sulla strada. Poi si aspetta che la strada sia libera dai nemici
// e il livello è completato. sinceAnnounceMs: tempo dall'ultimo annuncio, per la scritta; bossNext: l'ultimo
// annuncio è quello del boss. Con LEVEL.startWithBoss la partita parte direttamente dal boss.
// Eventi: WAVE_ANNOUNCED e WAVE_STARTED con { index, wave }, WAVE_ENDED, BOSS_ANNOUNCED e BOSS_STARTED
// con { boss }, LEVEL_COMPLETED
export const WAVE_PHASES = {
  pending: 'pending',
  break: 'break',
  wave: 'wave',
  boss: 'boss',
  clearing: 'clearing',
  complete: 'complete',
};

export function createWaves(bus) {
  const last = WAVES.length - 1;
  const first = LEVEL.startWithBoss ? last : Math.min(WAVES.length, Math.max(1, LEVEL.startWave)) - 1;
  const state = {
    index: first,
    count: WAVES.length,
    phase: WAVE_PHASES.pending,
    bossNext: LEVEL.startWithBoss,
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

// enemiesLeft: nemici ancora sulla strada, per sapere quando il livello è finito davvero
export function updateWaves(state, deltaMs, enemiesLeft) {
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
    state.elapsedMs -= state.breakMs;
    if (state.bossNext) {
      state.phase = WAVE_PHASES.boss;
      bus.emit(EVENTS.BOSS_STARTED, { boss: BOSS });
    } else {
      state.phase = WAVE_PHASES.wave;
      bus.emit(EVENTS.WAVE_STARTED, { index: state.index, wave });
    }
  } else if (state.phase === WAVE_PHASES.wave && state.elapsedMs >= waveMs) {
    state.elapsedMs -= waveMs;
    bus.emit(EVENTS.WAVE_ENDED, { index: state.index, wave });
    if (state.index === WAVES.length - 1) state.bossNext = true;
    else state.index += 1;
    state.breakMs = secondsToMs(LEVEL.breakSeconds);
    announce(state, state.elapsedMs);
  } else if (state.phase === WAVE_PHASES.clearing && enemiesLeft === 0) {
    state.phase = WAVE_PHASES.complete;
    bus.emit(EVENTS.LEVEL_COMPLETED, state);
  }
}

function announce(state, elapsedMs = 0) {
  state.phase = WAVE_PHASES.break;
  state.elapsedMs = elapsedMs;
  state.sinceAnnounceMs = elapsedMs;
  if (state.bossNext) state.bus.emit(EVENTS.BOSS_ANNOUNCED, { boss: BOSS });
  else state.bus.emit(EVENTS.WAVE_ANNOUNCED, { index: state.index, wave: WAVES[state.index] });
}
