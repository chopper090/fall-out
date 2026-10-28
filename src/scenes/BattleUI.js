import * as Phaser from 'phaser';
import { CONTROLS, FX, HUD, LEVEL, MISSION } from '../config/balance.js';
import { percentPoints, percentText } from '../core/format.js';
import { EVENTS } from '../core/events.js';
import { secondsToMs } from '../core/time.js';
import { flashAlpha } from '../fx/armyFx.js';
import { gatePassProgress } from '../fx/gateFx.js';
import { layerPulseScale } from '../fx/enemyFx.js';
import { SOLDIER_TYPES, WEAPONS } from '../data/units.js';
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

  init({ bus, army, mission, waves, scroll, bosses, loot, armyFx, enemyFx, gateFx, number = null }) {
    this.bus = bus;
    this.army = army;
    this.mission = mission;
    this.waves = waves;
    this.scroll = scroll;
    this.bosses = bosses;
    this.number = number;
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
    const mix = HUD.armyMix;
    this.mix = MIX_WEAPONS.map((weapon) => ({
      weapon,
      count: 0,
      text: this.add.text(0, mix.y, '', mix.style).setOrigin(0, 0.5),
    }));
    this.escaped = this.add.text(HUD.escaped.x, HUD.escaped.y, '', HUD.escaped.style);
    this.lootLine = this.add.text(HUD.loot.x, HUD.loot.y, '', HUD.loot.style).setVisible(false);
    this.bus.on(EVENTS.LOOT_COLLECTED, () => this.showLoot());
    this.wave = this.add.text(HUD.wave.x, HUD.wave.y, '', HUD.wave.style).setOrigin(1, 0);
    this.bonus = this.add.text(HUD.bonus.x, HUD.bonus.y, '', HUD.bonus.style).setOrigin(1, 0);
    this.banner = this.add.text(this.scale.width / 2, HUD.waveBanner.y, '', HUD.waveBanner.style).setOrigin(0.5);
    const gateText = (style) => this.add.text(this.scale.width / 2, FX.gatePass.y, '', style).setOrigin(0.5);
    this.gatePlus = gateText(FX.gatePass.style).setVisible(false);
    this.gateMinus = gateText(FX.gatePass.malusStyle).setVisible(false);
    const { y, height, count, most } = HUD.bossBar;
    this.bossCounts = Array.from({ length: most }, () =>
      this.add.text(0, y + height / 2, '', count.style).setOrigin(1, 0.5),
    );
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
    this.drawArmyMix();
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
    const wave = bossNext ? HUD.wave.bossLabel : `${HUD.wave.label} ${index + 1}/${count}`;
    this.wave.setText(
      this.number === null ? wave : `${HUD.wave.battleLabel} ${this.number}${HUD.wave.separator}${wave}`,
    );
    // Si stringe se arriva a meno di textGap dal numero dell'esercito
    const room = HUD.wave.x - (this.armySize.x + this.armySize.width) - HUD.wave.textGap;
    this.wave.setScale(Math.min(1, room / this.wave.width));
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
    text
      .setText(`${signedText(value)} ${label}`)
      .setY(y - rise * progress)
      .setAlpha(1 - progress ** fadeCurve);
  }

  // Quanto bottino si è preso finora, aggiornato a ogni premio raccolto: legno e pietra sempre, il resto quando c'è
  showLoot() {
    const { collected } = this.loot;
    const pieces = Object.values(collected.fragments).reduce((sum, count) => sum + count, 0);
    const { label, words, always, separator } = HUD.loot;
    const amountOf = (kind) => (kind === 'fragments' ? pieces : collected[kind]);
    const kinds = Object.keys(words).filter((kind) => always.includes(kind) || amountOf(kind) > 0);
    const parts = kinds.map((kind) => `${amountOf(kind)} ${words[kind]}`);
    this.lootLine.setText(`${label}: ${parts.join(separator)}`).setVisible(true);
  }

  // L'esercito in campo per arma: per ogni arma che c'è il quadrato del suo colore e quanti soldati la usano
  drawArmyMix() {
    const { x, y, square, gap, itemGap } = HUD.armyMix;
    for (const item of this.mix) item.count = 0;
    for (const soldier of this.army.soldiers) this.mix.find((item) => item.weapon === soldier.weapon).count += 1;
    let left = x;
    for (const { weapon, count, text } of this.mix) {
      text.setVisible(count > 0);
      if (count === 0) continue;
      this.graphics.fillStyle(WEAPONS[weapon].soldierColors.front);
      this.graphics.fillRect(left, y - square / 2, square, square);
      text.setText(String(count)).setPosition(left + square + gap, y);
      left = text.x + text.width + itemGap;
    }
  }

  // Una barra per boss in strada, affiancate: lo strato in cima, del suo colore, sopra il colore del prossimo (o sopra
  // il fondo, se è l'ultimo), e quanti strati restano
  drawBossBar() {
    const { list } = this.bosses;
    const { x, y, width, height, gap, back, colors, count } = HUD.bossBar;
    const each = (width - gap * (list.length - 1)) / list.length;
    this.bossCounts.forEach((text, index) => text.setVisible(index < list.length));
    list.forEach((boss, index) => {
      const left = layersLeft(boss);
      const from = x + index * (each + gap);
      const colorOf = (layer) => colors[(layer - 1) % colors.length];
      this.graphics.fillStyle(left > 1 ? colorOf(left - 1) : back);
      this.graphics.fillRect(from, y, each, height);
      this.graphics.fillStyle(colorOf(left));
      this.graphics.fillRect(from, y, each * layerFill(boss), height);
      const text = this.bossCounts[index].setText(`${count.prefix}${left}`).setX(from + each - count.inset);
      text.setScale(layerPulseScale(this.enemyFx, boss.enemy));
    });
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

// Le armi dell'esercito in campo, nell'ordine dei tipi della caserma (le élite per ultime)
const MIX_WEAPONS = Object.values(SOLDIER_TYPES).map(({ weapon }) => weapon);
