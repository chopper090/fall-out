import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
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

// Strumenti di sviluppo, anche nel link pubblico finché sviluppiamo: si aprono dall'ingranaggio
import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
