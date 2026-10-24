import * as Phaser from 'phaser';
import { HUD, POWER } from '../config/balance.js';
import { HEROES, LINEUP } from '../data/heroes.js';
import { armyPower, difficulty, levelPower } from '../systems/power.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';

// Schermata prima della battaglia, in grigio: gli eroi schierati con nome e ruolo, la nostra potenza e quella del
// livello, la fascia di difficoltà del loro rapporto con la sua barra colorata, un tocco per partire. Da rifare con
// la schermata degli eroi della Fase 4
export class LineupScene extends Phaser.Scene {
  constructor() {
    super('Lineup');
  }

  create() {
    createPawnAtlas(this.textures);
    const { width } = this.scale;
    const { title, titleY, heroY, heroScale, nameOffsetY, roleOffsetY } = HUD.lineup;
    const { powerY, powerLabel, levelLabel, bandY, hint, hintY } = HUD.lineup;
    const { titleStyle, nameStyle, roleStyle, powerStyle, bandStyle, hintStyle, rowWidth } = HUD.lineup;
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

    const ours = armyPower();
    const theirs = levelPower();
    const ratio = ours / theirs;
    const band = difficulty(ratio);
    const line = `${powerLabel} ${Math.round(ours)}   ${levelLabel} ${Math.round(theirs)}`;
    this.add.text(width / 2, powerY, line, powerStyle).setOrigin(0.5);
    const bandColor = Phaser.Display.Color.IntegerToColor(band.color).rgba;
    this.add.text(width / 2, bandY, band.label, bandStyle).setOrigin(0.5).setColor(bandColor);
    this.drawGauge(ratio);
    this.add.text(width / 2, hintY, hint, hintStyle).setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_UP, () => this.scene.start('Battle'));
  }

  // Le fasce da proibitiva (a sinistra) a facile, ognuna dal suo rapporto from a quello della fascia subito più
  // facile (facile fino a gauge.max); sopra, il segno sul nostro rapporto. Fuori da gauge.min e gauge.max il segno
  // resta sul bordo
  drawGauge(ratio) {
    const { y, width, height, min, max, marker } = HUD.lineup.gauge;
    const left = this.scale.width / 2 - width / 2;
    const xOf = (value) => left + (width * (Math.min(max, Math.max(min, value)) - min)) / (max - min);
    const graphics = this.add.graphics();
    POWER.bands.forEach((band, index) => {
      const upper = index === 0 ? max : POWER.bands[index - 1].from;
      graphics.fillStyle(band.color);
      graphics.fillRect(xOf(band.from), y - height / 2, xOf(upper) - xOf(band.from), height);
    });
    graphics.fillStyle(marker.color);
    graphics.fillRect(xOf(ratio) - marker.width / 2, y - marker.height / 2, marker.width, marker.height);
  }
}
