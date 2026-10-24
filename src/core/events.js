// Nomi degli eventi con cui i sistemi comunicano
export const EVENTS = {
  STEER: 'steer',
  STEER_END: 'steerEnd',
  ENEMY_HIT: 'enemyHit',
  ENEMY_KILLED: 'enemyKilled',
  ENEMY_CLASHED: 'enemyClashed',
  ENEMY_ESCAPED: 'enemyEscaped',
  ENEMY_FIRED: 'enemyFired',
  BLAST: 'blast',
  SOLDIER_HIT: 'soldierHit',
  SOLDIER_KILLED: 'soldierKilled',
  HERO_HIT: 'heroHit',
  HERO_DAMAGED: 'heroDamaged',
  HERO_KILLED: 'heroKilled',
  ABILITY_USED: 'abilityUsed',
  SHIELD_RAISED: 'shieldRaised',
  RAPID_FIRE_STARTED: 'rapidFireStarted',
  SHOT_BLOCKED: 'shotBlocked',
  MISSION_FAILED: 'missionFailed',
  MISSION_COMPLETED: 'missionCompleted',
  WAVE_ANNOUNCED: 'waveAnnounced',
  WAVE_STARTED: 'waveStarted',
  WAVE_ENDED: 'waveEnded',
  BOSS_STARTED: 'bossStarted',
  BOSS_SPAWNED: 'bossSpawned',
  BOSS_LAYER_BROKEN: 'bossLayerBroken',
  BOSS_ESCORT: 'bossEscort',
  BOSS_SMASHED: 'bossSmashed',
  BOSS_ENDED: 'bossEnded',
  LEVEL_COMPLETED: 'levelCompleted',
  GATE_PASSED: 'gatePassed',
  CHEST_HIT: 'chestHit',
  CHEST_OPENED: 'chestOpened',
  CHEST_REMOVED: 'chestRemoved',
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
