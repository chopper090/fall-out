// Eventi del gioco intero, tra la battaglia e il meta-gioco (su game.events di Phaser): BATTLE_ENDED porta il
// risultato di una battaglia finita (systems/battle.js battleResult), l'unica cosa che la battaglia dà al meta
export const GAME_EVENTS = {
  BATTLE_ENDED: 'battleEnded',
};

// Eventi tra il mondo (scenes/World.js) e la sua interfaccia (scenes/WorldUI.js), sul bus del mondo. Dal mondo: TICK
// ogni HUD.world.tickMs (VILLAGE_CHANGED al suo posto se il tempo ha cambiato qualcosa che si vede), BUILDING_TAPPED
// (id) e GROUND_TAPPED quando si tocca un edificio o il terreno, PLACEMENT_STARTED (id, moving: spostarlo invece di
// metterlo) e PLACEMENT_ENDED. Dall'interfaccia: PLACE_REQUESTED e MOVE_REQUESTED (id) per mettere o spostare un
// edificio, FOCUS_REQUESTED (id) per andarci con la vista, NAVIGATE (scene, data) per lasciare il mondo. Da tutti e due
// VILLAGE_CHANGED, dopo ogni cambio del villaggio salvato: ognuno si ridisegna
export const WORLD_EVENTS = {
  TICK: 'worldTick',
  VILLAGE_CHANGED: 'villageChanged',
  BUILDING_TAPPED: 'buildingTapped',
  GROUND_TAPPED: 'groundTapped',
  PLACEMENT_STARTED: 'placementStarted',
  PLACEMENT_ENDED: 'placementEnded',
  PLACE_REQUESTED: 'placeRequested',
  MOVE_REQUESTED: 'moveRequested',
  FOCUS_REQUESTED: 'focusRequested',
  NAVIGATE: 'navigate',
};

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
  LOOT_COLLECTED: 'lootCollected',
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
