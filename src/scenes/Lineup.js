import * as Phaser from 'phaser';
import { HUD, POWER } from '../config/balance.js';
import { levelOf, loadoutFrom } from '../meta/heroes.js';
import { armyPower, difficulty, levelPower } from '../systems/power.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { addButton } from './buttons.js';

// Schermata prima della battaglia, in grigio: gli eroi dello schieramento del profilo, in ordine di posto, con nome,
// livello e stelle; la nostra potenza (con livelli e stelle) e quella del livello, la fascia di difficoltà del loro
// rapporto con la sua barra colorata, le statistiche del salvataggio; Eroi apre la schermata degli eroi, Parti la
// battaglia con questo schieramento
export class LineupScene extends Phaser.Scene {
  constructor() {
    super('Lineup');
  }

  create() {
    createPawnAtlas(this.textures);
    const { width } = this.scale;
    const { title, titleY, heroY, heroScale, nameOffsetY, roleOffsetY } = HUD.lineup;
    const { powerY, powerLabel, levelLabel, bandY, labels } = HUD.lineup;
    const { titleStyle, nameStyle, roleStyle, powerStyle, bandStyle, rowWidth } = HUD.lineup;
    this.add.text(width / 2, titleY, title, titleStyle).setOrigin(0.5);

    const { profile } = this.registry.get('save');
    const loadout = loadoutFrom(profile);
    const columnWidth = Math.min(HUD.lineup.columnWidth, rowWidth / loadout.length);
    const scale = (heroScale * columnWidth) / HUD.lineup.columnWidth;
    const left = width / 2 - ((loadout.length - 1) * columnWidth) / 2;
    // Le scritte più larghe della colonna si stringono
    const fit = (text) => text.setScale(Math.min(1, (columnWidth - HUD.lineup.textGap) / text.width));
    loadout.forEach(({ hero }, index) => {
      const x = left + index * columnWidth;
      const record = profile.heroes[hero.id];
      const progress = `${labels.level} ${levelOf(record.xp).level} · ${HUD.heroes.stars.on.repeat(record.stars)}`;
      this.add.image(x, heroY, PAWN_ATLAS, heroFrame(hero)).setScale(scale);
      fit(this.add.text(x, heroY + nameOffsetY, hero.name, nameStyle).setOrigin(0.5));
      fit(this.add.text(x, heroY + roleOffsetY, progress, roleStyle).setOrigin(0.5));
    });

    const ours = armyPower(loadout);
    const theirs = levelPower();
    const ratio = ours / theirs;
    const band = difficulty(ratio);
    const line = `${powerLabel} ${Math.round(ours)}   ${levelLabel} ${Math.round(theirs)}`;
    this.add.text(width / 2, powerY, line, powerStyle).setOrigin(0.5);
    const bandColor = Phaser.Display.Color.IntegerToColor(band.color).rgba;
    this.add.text(width / 2, bandY, band.label, bandStyle).setOrigin(0.5).setColor(bandColor);
    this.drawGauge(ratio);
    this.drawStats(profile.stats);
    const { heroesButton, startButton } = HUD.lineup;
    const openHeroes = () => this.scene.start('Heroes');
    const makeLoadout = () => loadoutFrom(this.registry.get('save').profile);
    const start = () => this.scene.start('Battle', { loadout: makeLoadout });
    addButton(this, { ...heroesButton, label: labels.heroes, color: HUD.menu.quietButtonColor, onTap: openHeroes });
    addButton(this, { ...startButton, label: labels.start, color: HUD.menu.buttonColor, onTap: start });
  }

  // Battaglie finite, vinte, distanza più lunga e com'è andata l'ultima; niente prima della prima battaglia finita
  drawStats({ played, won, bestDistance, last }) {
    if (played === 0) return;
    const { statsY, lastY, statsLabels: labels, statsStyle } = HUD.lineup;
    const meters = (distance) => `${Math.floor(distance / HUD.gameOver.unitsPerMeter)} m`;
    const x = this.scale.width / 2;
    const totals = `${labels.played} ${played} · ${labels.won} ${won} · ${labels.best} ${meters(bestDistance)}`;
    this.add.text(x, statsY, totals, statsStyle).setOrigin(0.5);
    if (last === null) return;
    let outcome = labels.completed;
    if (!last.completed) outcome = last.boss ? labels.failedBoss : `${labels.failedAt} ${last.wave}`;
    this.add.text(x, lastY, `${labels.last} ${outcome}, ${meters(last.distance)}`, statsStyle).setOrigin(0.5);
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
