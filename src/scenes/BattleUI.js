import * as Phaser from 'phaser';
import { FX, HUD } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { flashAlpha } from '../fx/armyFx.js';

// Interfaccia sopra la battaglia, ferma anche quando la telecamera trema: barra dell'energia
// e numero di soldati dell'esercito, bordo rosso quando perde energia, schermata di fine partita
export class BattleUIScene extends Phaser.Scene {
  constructor() {
    super('BattleUI');
  }

  init({ bus, army, scroll, armyFx }) {
    this.bus = bus;
    this.army = army;
    this.scroll = scroll;
    this.armyFx = armyFx;
    this.gameOver = false;
  }

  create() {
    const { x, y, width, height, labelGap, labelStyle } = HUD.energyBar;
    this.graphics = this.add.graphics();
    this.label = this.add.text(x + width + labelGap, y + height / 2, '', labelStyle).setOrigin(0, 0.5);
    this.armySize = this.add.text(HUD.armySize.x, HUD.armySize.y, '', HUD.armySize.style);
    this.bus.on(EVENTS.ARMY_DEFEATED, () => this.showGameOver());
  }

  update() {
    this.graphics.clear();
    if (!this.gameOver && FX.enabled) this.drawDamageFlash();
    this.drawEnergyBar();
    this.armySize.setText(`${HUD.armySize.label}: ${this.army.size}`);
  }

  drawEnergyBar() {
    const { x, y, width, height, colors } = HUD.energyBar;
    const { hp, maxHp } = this.army;
    this.graphics.fillStyle(colors.back);
    this.graphics.fillRect(x, y, width, height);
    this.graphics.fillStyle(colors.fill);
    this.graphics.fillRect(x, y, (width * hp) / maxHp, height);
    this.label.setText(`${hp}/${maxHp}`);
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
  // che stava già guidando l'eroe al momento della sconfitta non riavvia la partita
  showGameOver() {
    this.gameOver = true;
    const { width, height } = this.scale;
    const { overlayColor, overlayAlpha, title, distanceLabel, hint, unitsPerMeter, lineGap, titleStyle, textStyle, tapDelayMs } =
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
