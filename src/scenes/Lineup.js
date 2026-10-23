import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { HEROES, LINEUP } from '../data/heroes.js';
import { LEVEL_INFO } from '../data/waves.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';

// Schermata prima della battaglia, in grigio: gli eroi schierati con nome e ruolo, la potenza dello schieramento
// e quella consigliata per il livello, un tocco per partire. Da rifare con la schermata degli eroi della Fase 4
export class LineupScene extends Phaser.Scene {
  constructor() {
    super('Lineup');
  }

  create() {
    createPawnAtlas(this.textures);
    const { width } = this.scale;
    const { title, titleY, heroY, heroScale, nameOffsetY, roleOffsetY } = HUD.lineup;
    const { powerY, powerLabel, recommendedLabel, hint, hintY } = HUD.lineup;
    const { titleStyle, nameStyle, roleStyle, powerStyle, hintStyle, rowWidth } = HUD.lineup;
    this.add.text(width / 2, titleY, title, titleStyle).setOrigin(0.5);

    const heroes = LINEUP.map(({ hero }) => HEROES[hero]);
    const columnWidth = Math.min(HUD.lineup.columnWidth, rowWidth / heroes.length);
    const scale = (heroScale * columnWidth) / HUD.lineup.columnWidth;
    const left = width / 2 - ((heroes.length - 1) * columnWidth) / 2;
    heroes.forEach((hero, index) => {
      const x = left + index * columnWidth;
      this.add.image(x, heroY, PAWN_ATLAS, heroFrame(hero)).setScale(scale);
      this.add.text(x, heroY + nameOffsetY, hero.name, nameStyle).setOrigin(0.5);
      this.add.text(x, heroY + roleOffsetY, hero.role, roleStyle).setOrigin(0.5);
    });

    const power = heroes.reduce((sum, hero) => sum + hero.power, 0);
    const line = `${powerLabel} ${power}   ${recommendedLabel} ${LEVEL_INFO.recommendedPower}`;
    this.add.text(width / 2, powerY, line, powerStyle).setOrigin(0.5);
    this.add.text(width / 2, hintY, hint, hintStyle).setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_UP, () => this.scene.start('Battle'));
  }
}
