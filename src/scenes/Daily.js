import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { nextMidnight } from '../core/time.js';
import { DAILY } from '../data/daily.js';
import { canPlayDaily, dailyRules } from '../meta/daily.js';
import { levelPower } from '../systems/power.js';
import { amountText, durationText } from '../view/words.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

// Missioni e sfide del giorno (meta/daily.js), in grigio. In alto quando si rinnovano (la prossima mezzanotte); poi
// una scheda per missione di oggi, con quanto manca (la barra e i numeri), le gemme e Ritira quando è finita; sotto il
// premio di tutte; poi una scheda per sfida del giorno, con cosa ha di diverso, la forza che chiede, le gemme e Gioca,
// che apre lo schieramento (una volta al giorno). Mondo torna al mondo; l'ingranaggio apre le impostazioni. Ritirare
// lo fanno le azioni del meta-gioco (meta/actions.js); la schermata si ridisegna a ogni tocco e al cambio del giorno, e
// ogni HUD.world.tickMs il conto alla rovescia va avanti
export class DailyScene extends Phaser.Scene {
  constructor() {
    super('Daily');
  }

  create() {
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    this.redraw();
    this.time.addEvent({ delay: HUD.world.tickMs, loop: true, callback: () => this.tick() });
  }

  // Il giorno è cambiato (le azioni lo portano ad adesso): tutto da capo; se no solo il conto alla rovescia
  tick() {
    this.actions.settle();
    if (this.save.profile.daily.day !== this.day) this.redraw();
    else this.renew.setText(this.renewText());
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, renewY, title, titleStyle, textStyle, back, labels } = HUD.daily;
    const x = this.scale.width / 2;
    this.day = this.save.profile.daily.day;
    this.add.text(x, titleY, title, titleStyle).setOrigin(0.5);
    this.renew = this.add.text(x, renewY, this.renewText(), textStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    this.drawMissions();
    this.drawChallenges();
    const leave = () => this.scene.start('World');
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
  }

  // Quanto manca alle missioni nuove: la prossima mezzanotte
  renewText() {
    return `${HUD.daily.labels.renew} ${durationText(nextMidnight(now()) - now())}`;
  }

  // Le missioni di oggi, una scheda per missione, e il premio di tutte
  drawMissions() {
    const { missionsTitleY, missionsTop, missionHeight, gap, bonusGap, sectionStyle, textStyle, labels } = HUD.daily;
    const x = this.scale.width / 2;
    this.add.text(x, missionsTitleY, labels.missions, sectionStyle).setOrigin(0.5);
    const { missions, bonus } = this.save.profile.daily;
    missions.forEach((mission, index) => this.drawMission(mission, index, missionsTop + index * (missionHeight + gap)));
    const bonusY = missionsTop + missions.length * (missionHeight + gap) + bonusGap;
    const prize = amountText('gems', DAILY.missions.allBonus, '+');
    this.add.text(x, bonusY, bonus ? labels.bonusTaken : `${labels.bonus}: ${prize}`, textStyle).setOrigin(0.5);
  }

  // La missione numero index, con la scheda in alto a top: cosa chiede, le gemme, la barra con i numeri, Ritira (o
  // ritirata)
  drawMission({ id, progress, claimed }, index, top) {
    const { missionHeight, card, cardTitleStyle, textStyle, labels } = HUD.daily;
    const { target, label } = DAILY.missions.pool[id];
    const done = progress >= target;
    const box = this.drawCard(top, missionHeight, done);
    this.add.text(box.left, top + card.titleY, label, cardTitleStyle).setOrigin(0, 0.5);
    const gems = amountText('gems', DAILY.missions.gems, '+');
    this.add.text(box.right, top + card.titleY, gems, textStyle).setOrigin(1, 0.5);
    const barY = top + card.barY;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.barBack);
    graphics.fillRect(box.left, barY, card.barWidth, card.barHeight);
    graphics.fillStyle(card.barFill);
    graphics.fillRect(box.left, barY, (card.barWidth * progress) / target, card.barHeight);
    const count = `${Math.floor(progress)}/${target}`;
    const countX = box.left + card.barWidth + card.padding;
    this.add.text(countX, barY + card.barHeight / 2, count, textStyle).setOrigin(0, 0.5);
    const claim = () => {
      this.actions.claimMission(index);
      this.redraw();
    };
    const spec = this.buttonSpec(box, top + card.buttonY);
    const color = done && !claimed ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
    const text = claimed ? labels.claimed : labels.claim;
    addButton(this, { ...spec, label: text, color, enabled: done && !claimed, onTap: claim });
  }

  // Le sfide del giorno, una scheda per sfida
  drawChallenges() {
    const { challengesTitleY, challengesTop, challengeHeight, gap, sectionStyle, labels } = HUD.daily;
    this.add.text(this.scale.width / 2, challengesTitleY, labels.challenges, sectionStyle).setOrigin(0.5);
    Object.keys(DAILY.challenges).forEach((id, index) => {
      this.drawChallenge(id, challengesTop + index * (challengeHeight + gap));
    });
  }

  // La sfida del giorno id, con la scheda in alto a top: il nome, le gemme, cosa ha di diverso e la forza che chiede,
  // Gioca (o giocata oggi)
  drawChallenge(id, top) {
    const { challengeHeight, card, cardTitleStyle, textStyle, labels } = HUD.daily;
    const { profile } = this.save;
    const { name, gems, text } = DAILY.challenges[id];
    const open = canPlayDaily(profile, id);
    const box = this.drawCard(top, challengeHeight, open);
    this.add.text(box.left, top + card.titleY, name, cardTitleStyle).setOrigin(0, 0.5);
    this.add.text(box.right, top + card.titleY, amountText('gems', gems, '+'), textStyle).setOrigin(1, 0.5);
    const required = `${labels.required} ${Math.round(levelPower(dailyRules(profile, id)))}`;
    this.add.text(box.left, top + card.lineY, `${text}${HUD.world.separator}${required}`, textStyle).setOrigin(0, 0.5);
    const play = () => this.scene.start('Lineup', { mode: 'daily', daily: id });
    const spec = this.buttonSpec(box, top + card.buttonY);
    const color = open ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
    addButton(this, { ...spec, label: open ? labels.play : labels.played, color, enabled: open, onTap: play });
  }

  // Il fondo di una scheda alta height con il lato di sopra a top, con il bordo acceso se lit; restituisce dove
  // cominciano e finiscono le scritte (left, right)
  drawCard(top, height, lit) {
    const { width, card } = HUD.daily;
    const left = (this.scale.width - width) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color);
    graphics.fillRoundedRect(left, top, width, height, card.radius);
    graphics.lineStyle(card.borderWidth, lit ? card.litBorder : card.border);
    graphics.strokeRoundedRect(left, top, width, height, card.radius);
    return { left: left + card.padding, right: left + width - card.padding };
  }

  // Il pulsante a destra della scheda box, con il centro all'altezza y
  buttonSpec(box, y) {
    const { button, buttonStyle: style } = HUD.daily;
    return { x: box.right - button.width / 2, y, width: button.width, height: button.height, style };
  }
}
