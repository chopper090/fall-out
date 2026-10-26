import * as Phaser from 'phaser';
import { CONTROLS, FX, HUD, LEVEL, MISSION } from '../config/balance.js';
import { percentPoints, percentText } from '../core/format.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { flashAlpha } from '../fx/armyFx.js';
import { gatePassProgress } from '../fx/gateFx.js';
import { layerPulseScale } from '../fx/enemyFx.js';
import { damageMultiplier } from '../systems/army.js';
import { layerFill, layersLeft } from '../systems/boss.js';
import { signedText } from '../view/words.js';
import { createHudButtons } from './hudButtons.js';
import { typingInPage } from './keyboard.js';

// Interfaccia sopra la battaglia, ferma anche quando la telecamera trema: soldati in campo, élite e riserve, nemici
// passati, bottino preso, danno in più degli scrigni e delle riserve e cadenza in più degli scrigni, ondata in corso e
// scritta grande per qualche secondo quando arriva un'ondata o il boss, numero del cancello appena passato al centro,
// barra a strati della vita del boss, bordo rosso quando un eroe è colpito o un nemico passa, pulsanti di pausa e
// impostazioni; a missione finita si ferma (il riepilogo lo apre il meta-gioco, scenes/Summary.js). Il gioco va in
// pausa da solo anche quando si esce dall'app o perde il fuoco; sul PC la pausa si apre anche con Esc
export class BattleUIScene extends Phaser.Scene {
  constructor() {
    super('BattleUI');
  }

  init({ bus, army, mission, waves, scroll, boss, loot, armyFx, enemyFx, gateFx }) {
    this.bus = bus;
    this.army = army;
    this.mission = mission;
    this.waves = waves;
    this.scroll = scroll;
    this.boss = boss;
    this.armyFx = armyFx;
    this.enemyFx = enemyFx;
    this.gateFx = gateFx;
    this.loot = loot;
    this.gameOver = false;
    this.menuOpen = false;
  }

  create() {
    this.graphics = this.add.graphics();
    this.armySize = this.add.text(HUD.armySize.x, HUD.armySize.y, '', HUD.armySize.style);
    this.escaped = this.add.text(HUD.escaped.x, HUD.escaped.y, '', HUD.escaped.style);
    this.lootLine = this.add.text(HUD.loot.x, HUD.loot.y, '', HUD.loot.style).setVisible(false);
    this.bus.on(EVENTS.LOOT_COLLECTED, () => this.showLoot());
    this.wave = this.add.text(HUD.wave.x, HUD.wave.y, '', HUD.wave.style).setOrigin(1, 0);
    this.bonus = this.add.text(HUD.bonus.x, HUD.bonus.y, '', HUD.bonus.style).setOrigin(1, 0);
    this.banner = this.add.text(this.scale.width / 2, HUD.waveBanner.y, '', HUD.waveBanner.style).setOrigin(0.5);
    const gateText = (style) => this.add.text(this.scale.width / 2, FX.gatePass.y, '', style).setOrigin(0.5);
    this.gatePlus = gateText(FX.gatePass.style).setVisible(false);
    this.gateMinus = gateText(FX.gatePass.malusStyle).setVisible(false);
    const { x, y, width, height, count } = HUD.bossBar;
    this.bossCount = this.add.text(x + width - count.inset, y + height / 2, '', count.style).setOrigin(1, 0.5);
    this.bus.on(EVENTS.MISSION_FAILED, () => this.missionOver());
    this.bus.on(EVENTS.MISSION_COMPLETED, () => this.missionOver());

    this.buttons = createHudButtons(this, {
      onPause: () => this.openMenu('pause'),
      onSettings: () => this.openMenu('settings'),
    });
    this.bus.on(EVENTS.GAME_RESUMED, () => {
      this.menuOpen = false;
    });
    // Pausa da sola quando il gioco si nasconde (si esce dall'app) o perde il fuoco (la tendina delle notifiche, una
    // chiamata, un'altra finestra sul PC)
    const pauseAlone = () => this.openMenu('pause');
    const { HIDDEN, BLUR } = Phaser.Core.Events;
    this.game.events.on(HIDDEN, pauseAlone);
    this.game.events.on(BLUR, pauseAlone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(HIDDEN, pauseAlone);
      this.game.events.off(BLUR, pauseAlone);
    });
    // Esc apre la pausa (a menu aperto chiude il menu: scenes/PauseMenu.js)
    this.input.keyboard.on(Phaser.Input.Keyboard.Events.KEY_DOWN + CONTROLS.keys.pause, () => {
      if (!typingInPage()) this.openMenu('pause');
    });
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
    const { size, maxSize, reserves, elites, fireRateScale } = this.army;
    const { eliteLabel, reservesLabel } = HUD.armySize;
    let armyText = `${HUD.armySize.label}: ${Math.min(size, maxSize)}/${maxSize}`;
    if (elites > 0) armyText += ` · ${eliteLabel} ${elites}`;
    if (reserves > 0) armyText += ` · ${reservesLabel} ${reserves}`;
    this.armySize.setText(armyText);
    this.escaped.setText(`${HUD.escaped.label}: ${this.mission.escaped}/${MISSION.maxEscaped}`);
    const damage = damageMultiplier(this.army) - 1;
    const rate = fireRateScale - 1;
    const { label, fireRateLabel, separator } = HUD.bonus;
    const parts = [];
    if (percentPoints(damage) > 0) parts.push(`${label} ${percentText(damage, '+')}`);
    if (percentPoints(rate) > 0) parts.push(`${fireRateLabel} ${percentText(rate, '+')}`);
    this.bonus.setText(parts.join(separator)).setVisible(parts.length > 0);
    const { index, count, sinceAnnounceMs, bossNext } = this.waves;
    this.wave.setText(bossNext ? HUD.wave.bossLabel : `${HUD.wave.label} ${index + 1}/${count}`);
    const announcing = sinceAnnounceMs < secondsToMs(LEVEL.bannerSeconds);
    const banner = bossNext ? HUD.waveBanner.bossLabel : `${HUD.waveBanner.label} ${index + 1}`;
    this.banner.setText(banner).setVisible(announcing && !this.gameOver);
    this.drawGatePass();
  }

  // Il numero del cancello appena passato, giallo o rosso, sale e sfuma
  drawGatePass() {
    const { value, malus } = this.gateFx;
    const progress = gatePassProgress(this.gateFx);
    const { y, rise, label, fadeCurve } = FX.gatePass;
    const text = malus ? this.gateMinus : this.gatePlus;
    (malus ? this.gatePlus : this.gateMinus).setVisible(false);
    text.setVisible(progress < 1 && !this.gameOver);
    if (progress >= 1) return;
    text.setText(`${signedText(value)} ${label}`).setY(y - rise * progress).setAlpha(1 - progress ** fadeCurve);
  }

  // Quanto bottino si è preso finora, aggiornato a ogni premio raccolto: i materiali sempre, il resto quando c'è
  showLoot() {
    const { collected } = this.loot;
    const pieces = Object.values(collected.fragments).reduce((sum, count) => sum + count, 0);
    const { label, words, one, separator } = HUD.loot;
    const amountOf = (kind) => (kind === 'fragments' ? pieces : collected[kind]);
    const kinds = Object.keys(words).filter((kind) => kind === 'materials' || amountOf(kind) > 0);
    const word = (kind) => (amountOf(kind) === 1 ? (one[kind] ?? words[kind]) : words[kind]);
    const parts = kinds.map((kind) => `${amountOf(kind)} ${word(kind)}`);
    this.lootLine.setText(`${label}: ${parts.join(separator)}`).setVisible(true);
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

  // A missione finita spariscono i pulsanti e il bottino (il riepilogo dice quanto se ne tiene) e niente si muove più:
  // sopra si apre il riepilogo
  missionOver() {
    this.gameOver = true;
    this.buttons.setVisible(false);
    this.lootLine.setVisible(false);
  }
}
