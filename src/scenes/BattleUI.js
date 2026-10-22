import * as Phaser from 'phaser';
import { FX, HUD, MISSION } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { flashAlpha } from '../fx/armyFx.js';
import { WAVE_PHASES } from '../systems/waves.js';

// Interfaccia sopra la battaglia, ferma anche quando la telecamera trema: barra della vita dell'eroe,
// numero di soldati, nemici passati, ondata in corso e scritta grande nella pausa prima di ogni ondata,
// bordo rosso quando l'eroe è colpito o un nemico passa, schermata di fine missione
export class BattleUIScene extends Phaser.Scene {
  constructor() {
    super('BattleUI');
  }

  init({ bus, army, mission, waves, scroll, armyFx }) {
    this.bus = bus;
    this.army = army;
    this.mission = mission;
    this.waves = waves;
    this.scroll = scroll;
    this.armyFx = armyFx;
    this.gameOver = false;
  }

  create() {
    const { x, y, width, height, labelGap, labelStyle } = HUD.heroBar;
    this.graphics = this.add.graphics();
    this.label = this.add.text(x + width + labelGap, y + height / 2, '', labelStyle).setOrigin(0, 0.5);
    this.armySize = this.add.text(HUD.armySize.x, HUD.armySize.y, '', HUD.armySize.style);
    this.escaped = this.add.text(HUD.escaped.x, HUD.escaped.y, '', HUD.escaped.style);
    this.wave = this.add.text(HUD.wave.x, HUD.wave.y, '', HUD.wave.style).setOrigin(1, 0);
    this.banner = this.add.text(this.scale.width / 2, HUD.waveBanner.y, '', HUD.waveBanner.style).setOrigin(0.5);
    this.bus.on(EVENTS.MISSION_FAILED, () => this.showGameOver(HUD.gameOver.failedTitle));
    this.bus.on(EVENTS.MISSION_COMPLETED, () => this.showGameOver(HUD.gameOver.completedTitle));
  }

  update() {
    this.graphics.clear();
    if (!this.gameOver && FX.enabled) this.drawDamageFlash();
    this.drawHeroBar();
    this.armySize.setText(`${HUD.armySize.label}: ${this.army.size}/${this.army.maxSize}`);
    this.escaped.setText(`${HUD.escaped.label}: ${this.mission.escaped}/${MISSION.maxEscaped}`);
    const { index, count, phase } = this.waves;
    this.wave.setText(`${HUD.wave.label} ${index + 1}/${count}`);
    this.banner.setText(`${HUD.waveBanner.label} ${index + 1}`).setVisible(phase === WAVE_PHASES.break && !this.gameOver);
  }

  drawHeroBar() {
    const { x, y, width, height, colors, label } = HUD.heroBar;
    const { hp, maxHp } = this.army.hero;
    this.graphics.fillStyle(colors.back);
    this.graphics.fillRect(x, y, width, height);
    this.graphics.fillStyle(colors.fill);
    this.graphics.fillRect(x, y, (width * hp) / maxHp, height);
    this.label.setText(`${label} ${hp}/${maxHp}`);
  }

  // Cornice rossa lungo i quattro bordi dello schermo
  drawDamageFlash() {
    const alpha = flashAlpha(this.armyFx);
    if (alpha <= 0) return;
    const { width, height } = this.scale;
    const { edgeWidth, color } = FX.damage;
    this.graphics.fillStyle(color, alpha);
    this.graphics.fillRect(0, 0, width, edgeWidth);
    this.graphics.fillRect(0, height - edgeWidth, width, edgeWidth);
    this.graphics.fillRect(0, edgeWidth, edgeWidth, height - 2 * edgeWidth);
    this.graphics.fillRect(width - edgeWidth, edgeWidth, edgeWidth, height - 2 * edgeWidth);
  }

  // Per ricominciare serve un tocco nuovo, che inizia dopo tapDelayMs: alzare il dito
  // che stava già guidando l'eroe alla fine della missione non riavvia la partita
  showGameOver(title) {
    this.gameOver = true;
    const { width, height } = this.scale;
    const { overlayColor, overlayAlpha, distanceLabel, hint, unitsPerMeter, lineGap, titleStyle, textStyle, tapDelayMs } =
      HUD.gameOver;
    const meters = Math.floor(this.scroll.distance / unitsPerMeter);

    this.add.rectangle(0, 0, width, height, overlayColor, overlayAlpha).setOrigin(0);
    this.add.text(width / 2, height / 2 - lineGap, title, titleStyle).setOrigin(0.5);
    this.add.text(width / 2, height / 2, `${distanceLabel}: ${meters} m`, textStyle).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + lineGap, hint, textStyle).setOrigin(0.5);

    const restart = () => this.scene.get('Battle').scene.restart();
    this.time.delayedCall(tapDelayMs, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.input.once(Phaser.Input.Events.POINTER_UP, restart));
    });
  }
}
