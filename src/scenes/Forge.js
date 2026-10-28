import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { MINUS, percentText } from '../core/format.js';
import { WEAPON_PATHS } from '../data/forge.js';
import { WEAPONS } from '../data/units.js';
import { VILLAGE } from '../data/village.js';
import { canChallengeForge, canForge, forgeCost, forgeLock, forgeTimeLeft } from '../meta/forge.js';
import { forgeCostText, levelText, stepText } from '../view/forgeWords.js';
import { amountText, durationText } from '../view/words.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

// La fucina (meta/forge.js), in grigio: in alto il titolo con il livello e fin dove arrivano le armi; poi una scheda
// per arma dei soldati con il livello, cosa danno i suoi livelli e il prossimo, con costo, minuti e Migliora; o cosa la
// tiene ferma (la fucina o la caserma), o che è al massimo. In fondo il lavoro in corso: quanto manca, una gemma che
// toglie i suoi minuti e la sfida, che apre lo schieramento della sfida della fucina. Mondo torna al mondo;
// l'ingranaggio apre le impostazioni. I cambi li fanno le azioni del meta-gioco (meta/actions.js); la schermata si
// ridisegna a ogni tocco e, mentre c'è un lavoro, ogni HUD.world.tickMs
export class ForgeScene extends Phaser.Scene {
  constructor() {
    super('Forge');
  }

  create() {
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    this.redraw();
    this.time.addEvent({ delay: HUD.world.tickMs, loop: true, callback: () => this.tick() });
  }

  // Mentre c'è un lavoro: il conto alla rovescia, e alla fine l'arma sale (le azioni portano tutto ad adesso)
  tick() {
    if (this.save.profile.forgeJob === null) return;
    this.actions.settle();
    this.redraw();
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, capY, titleStyle, textStyle, back, labels, top, cardHeight, gap } = HUD.forge;
    const x = this.scale.width / 2;
    const level = this.save.profile.village.levels.forge;
    this.add.text(x, titleY, `${labels.title} · ${labels.level} ${level}`, titleStyle).setOrigin(0.5);
    this.add.text(x, capY, `${labels.cap} ${level}`, textStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    const weapons = Object.keys(WEAPON_PATHS);
    weapons.forEach((weapon, index) => this.drawWeapon(weapon, top + index * (cardHeight + gap)));
    this.drawJob(top + weapons.length * (cardHeight + gap));
    const leave = () => this.scene.start('World');
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
  }

  // La scheda dell'arma weapon con il lato di sopra a top: nome e livello, cosa danno i suoi livelli, il prossimo
  // livello e, sotto, il costo con Migliora (acceso se si può adesso) o cosa la tiene ferma, o che è al massimo
  drawWeapon(weapon, top) {
    const { card, cardHeight, cardTitleStyle, textStyle, lockedStyle, labels } = HUD.forge;
    const { profile } = this.save;
    const level = profile.weaponLevels[weapon];
    const max = WEAPON_PATHS[weapon].length;
    const lock = forgeLock(profile, weapon);
    const box = this.drawCard(top, cardHeight, canForge(profile, weapon));
    const title = `${WEAPONS[weapon].label} · ${labels.level} ${level}/${max}`;
    this.add.text(box.left, top + card.titleY, title, cardTitleStyle).setOrigin(0, 0.5);
    const have = `${labels.now}: ${levelText(weapon, level)}`;
    this.add.text(box.left, top + card.nowTop, have, { ...textStyle, wordWrap: { width: box.width } });
    if (level === max) {
      this.add.text(box.left, top + card.nextY, labels.max, textStyle).setOrigin(0, 0.5);
      return;
    }
    const next = `${labels.levelLong} ${level + 1}: ${stepText(weapon, level + 1)}`;
    this.add.text(box.left, top + card.nextY, next, lock === null ? textStyle : lockedStyle).setOrigin(0, 0.5);
    if (lock !== null) {
      const why = lock.forge ? `${labels.needsForge} ${lock.forge}` : `${labels.needsBarracks} ${lock.barracks}`;
      this.add.text(box.left, top + card.costY, why, lockedStyle).setOrigin(0, 0.5);
      return;
    }
    this.add.text(box.left, top + card.costY, forgeCostText(forgeCost(profile, weapon)), textStyle).setOrigin(0, 0.5);
    this.drawUpgrade(weapon, box, top + card.costY);
  }

  // Migliora dell'arma weapon, a destra nella scheda box all'altezza y: acceso se si può portare al livello dopo
  // adesso (coda libera, scorte che bastano)
  drawUpgrade(weapon, box, y) {
    const { button, buttonStyle: style, labels } = HUD.forge;
    const enabled = canForge(this.save.profile, weapon);
    const start = () => {
      this.actions.startForge(weapon);
      this.redraw();
    };
    const color = enabled ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
    const spec = { x: box.right - button.width / 2, y, width: button.width, height: button.height, style };
    addButton(this, { ...spec, label: labels.upgrade, color, enabled, onTap: start });
  }

  // La scheda del lavoro con il lato di sopra a top: nessun lavoro; o l'arma, il livello a cui sale e quanto manca,
  // con la gemma (accesa se ce n'è una) e la sfida (accesa se si può: una per lavoro, con almeno minMinutes da fare)
  drawJob(top) {
    const { card, jobCard, cardTitleStyle, textStyle, labels } = HUD.forge;
    const { profile } = this.save;
    const job = profile.forgeJob;
    const box = this.drawCard(top, jobCard.height, job !== null);
    if (job === null) {
      this.add.text(box.left, top + card.titleY, labels.noJob, textStyle).setOrigin(0, 0.5);
      return;
    }
    const level = profile.weaponLevels[job.weapon] + 1;
    const title = `${labels.job} ${WEAPONS[job.weapon].label} → ${labels.level} ${level}`;
    this.add.text(box.left, top + card.titleY, title, cardTitleStyle).setOrigin(0, 0.5);
    const left = `${labels.left} ${durationText(forgeTimeLeft(profile, now()))}`;
    this.add.text(box.left, top + jobCard.lineY, left, textStyle).setOrigin(0, 0.5);
    const { button, buttonStyle: style } = jobCard;
    const spec = { y: top + jobCard.buttonY, width: button.width, height: button.height, style };
    const gems = profile.resources.gems > 0;
    const rush = () => {
      this.actions.rushForge();
      this.redraw();
    };
    const rushLabel = `${MINUS}${VILLAGE.gemMinutes} ${HUD.units.minute}${HUD.world.separator}${amountText('gems', 1)}`;
    const rushX = box.right - button.width / 2;
    const color = (enabled) => (enabled ? HUD.menu.buttonColor : HUD.menu.quietButtonColor);
    addButton(this, { ...spec, x: rushX, label: rushLabel, color: color(gems), enabled: gems, onTap: rush });
    const open = canChallengeForge(profile, now());
    const words = HUD.world.labels;
    let challenge = `${words.challenge} ${percentText(VILLAGE.challenge.timeShare, MINUS)}`;
    if (!open) challenge = job.challenged ? words.challengeUsed : words.challengeShort;
    const lineup = () => this.scene.start('Lineup', { mode: 'forge' });
    const challengeX = rushX - button.width - jobCard.gap;
    addButton(this, { ...spec, x: challengeX, label: challenge, color: color(open), enabled: open, onTap: lineup });
  }

  // Il fondo di una scheda alta height con il lato di sopra a top, con il bordo acceso se lit; restituisce dove
  // cominciano e finiscono le scritte (left, right) e quanto sono larghe (width)
  drawCard(top, height, lit) {
    const { width, card } = HUD.forge;
    const left = (this.scale.width - width) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color);
    graphics.fillRoundedRect(left, top, width, height, card.radius);
    graphics.lineStyle(card.borderWidth, lit ? card.litBorder : card.border);
    graphics.strokeRoundedRect(left, top, width, height, card.radius);
    return { left: left + card.padding, right: left + width - card.padding, width: width - card.padding * 2 };
  }
}
