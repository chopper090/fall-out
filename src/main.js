import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
import { BattleScene } from './scenes/Battle.js';
import { BattleUIScene } from './scenes/BattleUI.js';

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
  scene: [BattleScene, BattleUIScene],
});

// Debug solo in sviluppo: con l'import dinamico resta fuori dalla build
if (import.meta.env.DEV) {
  import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
}
