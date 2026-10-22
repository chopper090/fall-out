import * as Phaser from 'phaser';
import { DISPLAY, TITLE } from './config/balance.js';

// Scena provvisoria della Fase 0: solo il titolo al centro
class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, TITLE.text, TITLE.style).setOrigin(0.5);
  }
}

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
  scene: [TitleScene],
});

// Debug solo in sviluppo: con l'import dinamico resta fuori dalla build
if (import.meta.env.DEV) {
  import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
}
