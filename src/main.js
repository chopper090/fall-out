import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
import { GAME_EVENTS } from './core/events.js';
import { loadSave, refreshSave, writeSave } from './core/save.js';
import { recordBattle } from './meta/profile.js';
import { loadSettings } from './core/settings.js';
import { LineupScene } from './scenes/Lineup.js';
import { BattleScene } from './scenes/Battle.js';
import { BattleUIScene } from './scenes/BattleUI.js';
import { PauseMenuScene } from './scenes/PauseMenu.js';

loadSettings();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: DISPLAY.backgroundColor,
  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DISPLAY.width,
    height: DISPLAY.height,
  },
  scene: [LineupScene, BattleScene, BattleUIScene, PauseMenuScene],
});
// Il salvataggio della partita, per tutte le scene. Ogni battaglia finita entra nelle statistiche, sul salvataggio
// riletto prima di scrivere
const save = loadSave();
game.registry.set('save', save);
game.events.on(GAME_EVENTS.BATTLE_ENDED, (result) => {
  refreshSave(save);
  recordBattle(save.profile, result);
  writeSave(save);
});

// Strumenti di sviluppo, anche nel link pubblico finché sviluppiamo: il pannello si apre dall'ingranaggio, il test
// delle partite di fila (DEBUG.playtest) parte da solo
import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
