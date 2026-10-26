// Eventi del gioco intero, tra la battaglia e il meta-gioco (su game.events di Phaser): BATTLE_ENDED porta il
// risultato di una battaglia finita (systems/battle.js battleResult), l'unica cosa che la battaglia dà al meta
export const GAME_EVENTS = {
  BATTLE_ENDED: 'battleEnded',
};

// Eventi del meta-gioco (meta/actions.js), su game.events di Phaser, dopo ogni azione del giocatore che ha cambiato il
// profilo, già salvato. Cosa è successo: STEPPED (la casella nuova, tile, e il premio di una raccolta, gain; anche
// entrando nella casella di una battaglia che parte), AREA_CONQUERED (area, reward), CONSTRUCTION_STARTED (building,
// endsAt), CONSTRUCTION_FINISHED (building, level: con il tempo o con l'acceleratore), CONSTRUCTION_SHORTENED
// (building, ms: il tempo tolto dall'acceleratore o dalla sfida vinta), RATIONS_COLLECTED (amount), HERO_RECRUITED (id,
// rarity, isNew, fragments), HERO_PLACED (slot, id), HERO_STARRED (id, stars), BATTLE_RECORDED (context, result,
// rewards), SAVE_CLEARED. Poi SAVE_FAILED se il salvataggio non si è potuto scrivere, e per ultimo, sempre,
// PROFILE_CHANGED (action: il nome dell'azione, settle se è cambiato solo il villaggio con il tempo)
export const META_EVENTS = {
  PROFILE_CHANGED: 'profileChanged',
  STEPPED: 'stepped',
  AREA_CONQUERED: 'areaConquered',
  CONSTRUCTION_STARTED: 'constructionStarted',
  CONSTRUCTION_FINISHED: 'constructionFinished',
  CONSTRUCTION_SHORTENED: 'constructionShortened',
  RATIONS_COLLECTED: 'rationsCollected',
  HERO_RECRUITED: 'heroRecruited',
  HERO_PLACED: 'heroPlaced',
  HERO_STARRED: 'heroStarred',
  BATTLE_RECORDED: 'battleRecorded',
  SAVE_FAILED: 'saveFailed',
  SAVE_CLEARED: 'saveCleared',
};

// Eventi tra il mondo (scenes/World.js) e la sua interfaccia (scenes/WorldUI.js), sul bus del mondo. Dal mondo: TICK
// ogni HUD.world.tickMs (WORLD_CHANGED al suo posto se il tempo ha cambiato qualcosa che si vede), BUILDING_TAPPED
// (id) e GROUND_TAPPED quando si tocca un edificio o il terreno, ROAD_TAPPED quando si apre la scheda della strada
// (toccando la strada fuori dalla casella da toccare, il capo o l'area da conquistare), PLACEMENT_STARTED (id, moving:
// spostarlo invece di metterlo) e PLACEMENT_ENDED, e WORLD_CHANGED dopo ogni cambio del profilo
// (META_EVENTS.PROFILE_CHANGED: villaggio, strada, risorse; un passo quando il capo arriva): ognuno si ridisegna.
// Dall'interfaccia: PLACE_REQUESTED e MOVE_REQUESTED (id) per mettere o spostare un edificio, FOCUS_REQUESTED (id) per
// andarci con la vista, PAWN_FOCUS_REQUESTED per andare dal capo, con la casella da toccare che si accende,
// SETTINGS_REQUESTED per aprire le impostazioni sopra il mondo, NAVIGATE (scene, data) per lasciarlo
export const WORLD_EVENTS = {
  TICK: 'worldTick',
  WORLD_CHANGED: 'worldChanged',
  BUILDING_TAPPED: 'buildingTapped',
  GROUND_TAPPED: 'groundTapped',
  ROAD_TAPPED: 'roadTapped',
  PLACEMENT_STARTED: 'placementStarted',
  PLACEMENT_ENDED: 'placementEnded',
  PLACE_REQUESTED: 'placeRequested',
  MOVE_REQUESTED: 'moveRequested',
  FOCUS_REQUESTED: 'focusRequested',
  PAWN_FOCUS_REQUESTED: 'pawnFocusRequested',
  SETTINGS_REQUESTED: 'settingsRequested',
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

// Bus di eventi: chi emette non conosce chi ascolta. tap(name, payload), se c'è, sente ogni evento prima di chi lo
// ascolta (il registro degli eventi degli strumenti di sviluppo, debug/eventLog.js); senza, emit consegna e basta, e
// non costa niente in più (il simulatore non ce l'ha)
export function createEventBus(tap) {
  const handlers = new Map();
  const deliver = (name, payload) => handlers.get(name)?.forEach((handler) => handler(payload));
  const tapped = (name, payload) => {
    tap(name, payload);
    deliver(name, payload);
  };
  return {
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(handler);
    },
    emit: tap === undefined ? deliver : tapped,
  };
}
