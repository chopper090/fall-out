// Nomi degli eventi con cui i sistemi comunicano
export const EVENTS = {
  STEER: 'steer',
  STEER_END: 'steerEnd',
  ENEMY_HIT: 'enemyHit',
  ENEMY_KILLED: 'enemyKilled',
  ENEMY_CLASHED: 'enemyClashed',
  ENEMY_ESCAPED: 'enemyEscaped',
  SOLDIER_KILLED: 'soldierKilled',
  HERO_HIT: 'heroHit',
  HERO_DAMAGED: 'heroDamaged',
  HERO_KILLED: 'heroKilled',
  MISSION_FAILED: 'missionFailed',
  MISSION_COMPLETED: 'missionCompleted',
  WAVE_ANNOUNCED: 'waveAnnounced',
  WAVE_STARTED: 'waveStarted',
  WAVE_ENDED: 'waveEnded',
  LEVEL_COMPLETED: 'levelCompleted',
  GATE_HIT: 'gateHit',
  GATE_PASSED: 'gatePassed',
  GATE_REMOVED: 'gateRemoved',
  GAME_PAUSED: 'gamePaused',
  GAME_RESUMED: 'gameResumed',
};

// Bus di eventi: chi emette non conosce chi ascolta
export function createEventBus() {
  const handlers = new Map();
  return {
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(handler);
    },
    emit(name, payload) {
      handlers.get(name)?.forEach((handler) => handler(payload));
    },
  };
}
