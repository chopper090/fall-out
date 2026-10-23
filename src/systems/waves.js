import { LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { WAVES } from '../data/waves.js';

// Avanzamento del livello: prima di ogni ondata una pausa di LEVEL.breakSeconds senza nuovi arrivi
// (LEVEL.firstBreakSeconds prima della prima), in cui l'ondata viene annunciata e il campo prende già la sua
// velocità; poi l'ondata dura duration secondi. sinceAnnounceMs: tempo dall'ultimo annuncio, per la scritta.
// Dopo l'ultima si aspetta che la strada sia libera dai nemici e il livello è completato.
// Eventi: WAVE_ANNOUNCED e WAVE_STARTED con { index, wave }, WAVE_ENDED, LEVEL_COMPLETED
export const WAVE_PHASES = {
  pending: 'pending',
  break: 'break',
  wave: 'wave',
  clearing: 'clearing',
  complete: 'complete',
};

export function createWaves(bus) {
  const first = Math.min(WAVES.length, Math.max(1, LEVEL.startWave)) - 1;
  return {
    index: first,
    count: WAVES.length,
    phase: WAVE_PHASES.pending,
    elapsedMs: 0,
    breakMs: secondsToMs(LEVEL.firstBreakSeconds),
    sinceAnnounceMs: 0,
    bus,
  };
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
    state.phase = WAVE_PHASES.wave;
    state.elapsedMs -= state.breakMs;
    bus.emit(EVENTS.WAVE_STARTED, { index: state.index, wave });
  } else if (state.phase === WAVE_PHASES.wave && state.elapsedMs >= waveMs) {
    state.elapsedMs -= waveMs;
    bus.emit(EVENTS.WAVE_ENDED, { index: state.index, wave });
    if (state.index === WAVES.length - 1) {
      state.phase = WAVE_PHASES.clearing;
    } else {
      state.index += 1;
      state.breakMs = secondsToMs(LEVEL.breakSeconds);
      announce(state, state.elapsedMs);
    }
  } else if (state.phase === WAVE_PHASES.clearing && enemiesLeft === 0) {
    state.phase = WAVE_PHASES.complete;
    bus.emit(EVENTS.LEVEL_COMPLETED, state);
  }
}

function announce(state, elapsedMs = 0) {
  state.phase = WAVE_PHASES.break;
  state.elapsedMs = elapsedMs;
  state.sinceAnnounceMs = elapsedMs;
  state.bus.emit(EVENTS.WAVE_ANNOUNCED, { index: state.index, wave: WAVES[state.index] });
}
