import * as Phaser from 'phaser';
import { FX, HUD, LEVEL, MISSION } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { flashAlpha } from '../fx/armyFx.js';
import { layerPulseScale } from '../fx/enemyFx.js';
import { layerFill, layersLeft } from '../systems/boss.js';
import { createHudButtons } from './hudButtons.js';

// Interfaccia sopra la battaglia, ferma anche quando la telecamera trema: soldati in campo e riserve, nemici
// passati, danno in più degli scrigni e delle riserve e cadenza in più degli scrigni, ondata in corso e scritta
// grande per qualche secondo quando arriva un'ondata o il boss, barra a strati della vita del boss, bordo rosso
// quando un eroe è colpito o un nemico passa, pulsanti di pausa e impostazioni, schermata di fine missione.
// Il gioco va in pausa da solo anche quando si esce dall'app
export class BattleUIScene extends Phaser.Scene {
  constructor() {
    super('BattleUI');
  }

  init({ bus, army, mission, waves, scroll, boss, armyFx, enemyFx }) {
    this.bus = bus;
    this.army = army;
    this.mission = mission;
    this.waves = waves;
    this.scroll = scroll;
    this.boss = boss;
    this.armyFx = armyFx;
    this.enemyFx = enemyFx;
    this.gameOver = false;
    this.menuOpen = false;
  }

  create() {
    this.graphics = this.add.graphics();
    this.armySize = this.add.text(HUD.armySize.x, HUD.armySize.y, '', HUD.armySize.style);
    this.escaped = this.add.text(HUD.escaped.x, HUD.escaped.y, '', HUD.escaped.style);
    this.wave = this.add.text(HUD.wave.x, HUD.wave.y, '', HUD.wave.style).setOrigin(1, 0);
    this.power = this.add.text(HUD.power.x, HUD.power.y, '', HUD.power.style).setOrigin(1, 0);
    this.banner = this.add.text(this.scale.width / 2, HUD.waveBanner.y, '', HUD.waveBanner.style).setOrigin(0.5);
    const { x, y, width, height, count } = HUD.bossBar;
    this.bossCount = this.add.text(x + width - count.inset, y + height / 2, '', count.style).setOrigin(1, 0.5);
    this.bus.on(EVENTS.MISSION_FAILED, () => this.showGameOver(HUD.gameOver.failedTitle));
    this.bus.on(EVENTS.MISSION_COMPLETED, () => this.showGameOver(HUD.gameOver.completedTitle));

    this.buttons = createHudButtons(this, {
      onPause: () => this.openMenu('pause'),
      onSettings: () => this.openMenu('settings'),
    });
    this.bus.on(EVENTS.GAME_RESUMED, () => {
      this.menuOpen = false;
    });
    const pauseWhenHidden = () => this.openMenu('pause');
    this.game.events.on(Phaser.Core.Events.HIDDEN, pauseWhenHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.HIDDEN, pauseWhenHidden));
  }

  // La battaglia si ferma e sopra si apre il menu, sulla pagina di pausa o delle impostazioni
  openMenu(page) {
    if (this.gameOver || this.menuOpen) return;
    this.menuOpen = true;
    this.bus.emit(EVENTS.GAME_PAUSED);
    this.scene.launch('PauseMenu', { bus: this.bus, page });
  }

  update() {
    this.graphics.clear();
    this.drawBossBar();
    if (!this.gameOver && FX.enabled) this.drawDamageFlash();
    const { size, maxSize, reserves, reserveBonus, damageScale, fireRateScale } = this.army;
    const inField = `${HUD.armySize.label}: ${Math.min(size, maxSize)}/${maxSize}`;
    this.armySize.setText(reserves > 0 ? `${inField} · ${HUD.armySize.reservesLabel} ${reserves}` : inField);
    this.escaped.setText(`${HUD.escaped.label}: ${this.mission.escaped}/${MISSION.maxEscaped}`);
    const damage = Math.round((damageScale * (1 + reserveBonus) - 1) * 100);
    const rate = Math.round((fireRateScale - 1) * 100);
    const { label, fireRateLabel, separator } = HUD.power;
    const parts = [];
    if (damage > 0) parts.push(`${label} +${damage}%`);
    if (rate > 0) parts.push(`${fireRateLabel} +${rate}%`);
    this.power.setText(parts.join(separator)).setVisible(parts.length > 0);
    const { index, count, sinceAnnounceMs, bossNext } = this.waves;
    this.wave.setText(bossNext ? HUD.wave.bossLabel : `${HUD.wave.label} ${index + 1}/${count}`);
    const announcing = sinceAnnounceMs < secondsToMs(LEVEL.bannerSeconds);
    const banner = bossNext ? HUD.waveBanner.bossLabel : `${HUD.waveBanner.label} ${index + 1}`;
    this.banner.setText(banner).setVisible(announcing && !this.gameOver);
  }

  // Lo strato in cima, del suo colore, sopra il colore del prossimo (o sopra il fondo, se è l'ultimo)
  drawBossBar() {
    const { boss } = this;
    this.bossCount.setVisible(boss.enemy !== null);
    if (boss.enemy === null) return;
    const { x, y, width, height, back, colors, count } = HUD.bossBar;
    const left = layersLeft(boss);
    const colorOf = (layer) => colors[(layer - 1) % colors.length];
    this.graphics.fillStyle(left > 1 ? colorOf(left - 1) : back);
    this.graphics.fillRect(x, y, width, height);
    this.graphics.fillStyle(colorOf(left));
    this.graphics.fillRect(x, y, width * layerFill(boss), height);
    this.bossCount.setText(`${count.prefix}${left}`).setScale(layerPulseScale(this.enemyFx));
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
    this.buttons.setVisible(false);
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
