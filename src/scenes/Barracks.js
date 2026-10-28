import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { decimalText } from '../core/format.js';
import { BASE_SOLDIER, ELITE, SOLDIER_TYPES, WEAPONS } from '../data/units.js';
import { armyCapacity, armyOf, readyArmy, retrainCost, trainableTypes, trainingCount } from '../meta/barracks.js';
import { amountText, durationText } from '../view/words.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

// La caserma (meta/barracks.js), in grigio: in alto il titolo con il livello e quanti soldati ha l'esercito; poi una
// scheda per tipo di soldati, con quanti ne ha (e quanti sono caduti) e la sua arma con i suoi numeri. I fucilieri
// prendono i posti che restano; gli altri tipi hanno − (il soldato torna fuciliere) e + (un fuciliere diventa di quel
// tipo), o, finché la caserma non li addestra, da che livello arrivano. In fondo i caduti: quanto costa e quanto dura
// riaddestrarli, con Riaddestra; mentre si addestrano, quanto manca, con Finisci (una gemma), e quanti si addestrano se
// intanto ne sono caduti altri. Mondo torna al mondo;
// l'ingranaggio apre le impostazioni. I cambi li fanno le azioni del meta-gioco (meta/actions.js); la schermata si
// ridisegna a ogni tocco e, mentre i caduti si addestrano, ogni HUD.world.tickMs
export class BarracksScene extends Phaser.Scene {
  constructor() {
    super('Barracks');
  }

  create() {
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    this.redraw();
    this.time.addEvent({ delay: HUD.world.tickMs, loop: true, callback: () => this.tick() });
  }

  // Mentre i caduti si addestrano: il conto alla rovescia, e alla fine tornano (le azioni portano tutto ad adesso)
  tick() {
    if (this.save.profile.retrain === null) return;
    this.actions.settle();
    this.redraw();
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, armyY, titleStyle, textStyle, back, labels, top, cardHeight, gap } = HUD.barracks;
    const x = this.scale.width / 2;
    const { profile } = this.save;
    const level = profile.village.levels.barracks;
    this.add.text(x, titleY, `${labels.title} · ${labels.level} ${level}`, titleStyle).setOrigin(0.5);
    const army = `${labels.army} ${armyCapacity(level)} ${labels.soldiers}`;
    this.add.text(x, armyY, army, textStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    const open = trainableTypes(level);
    const types = Object.keys(SOLDIER_TYPES);
    types.forEach((type, index) => this.drawType(type, open.includes(type), top + index * (cardHeight + gap)));
    this.drawFallen(top + types.length * (cardHeight + gap));
    const leave = () => this.scene.start('World');
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
  }

  // La scheda del tipo type con il lato di sopra a top: il nome, quanti ne ha l'esercito e quanti sono caduti, l'arma,
  // e i pulsanti − e + (la base dice che prende i posti che restano; un tipo che la caserma non addestra, da che
  // livello)
  drawType(type, open, top) {
    const { card, cardHeight, cardTitleStyle, textStyle, lockedStyle, labels } = HUD.barracks;
    const { label, barracks } = SOLDIER_TYPES[type];
    const { profile } = this.save;
    const count = armyOf(profile)[type];
    const fallen = profile.fallen[type];
    const box = this.drawCard(top, cardHeight, open);
    const fell = `${fallen} ${fallen === 1 ? labels.fallenOne : labels.fallen}`;
    const counted = fallen > 0 ? `${label}: ${count} (${fell})` : `${label}: ${count}`;
    const title = open ? counted : label;
    this.add.text(box.left, top + card.titleY, title, open ? cardTitleStyle : lockedStyle).setOrigin(0, 0.5);
    this.add.text(box.left, top + card.lineY, weaponText(type), open ? textStyle : lockedStyle).setOrigin(0, 0.5);
    if (!open) {
      this.add.text(box.left, top + card.noteY, `${labels.locked} ${barracks}`, lockedStyle).setOrigin(0, 0.5);
      return;
    }
    if (type === BASE_SOLDIER) {
      this.add.text(box.left, top + card.noteY, labels.base, textStyle).setOrigin(0, 0.5);
      return;
    }
    this.drawChanges(type, box, top + card.buttonY);
  }

  // − e + del tipo type, in basso a destra nella scheda box, con il centro all'altezza y: accesi se c'è il soldato da
  // cambiare, non caduto
  drawChanges(type, box, y) {
    const { button, buttonStyle: style, labels } = HUD.barracks;
    const ready = readyArmy(this.save.profile);
    const change = (delta) => () => {
      this.actions.changeArmy(type, delta);
      this.redraw();
    };
    const plusX = box.right - button.width / 2;
    const minusX = plusX - button.width - button.gap;
    const spec = { y, width: button.width, height: button.height, style };
    const color = (enabled) => (enabled ? HUD.menu.buttonColor : HUD.menu.quietButtonColor);
    const canMinus = ready[type] > 0;
    const canPlus = ready[BASE_SOLDIER] > 0;
    addButton(this, {
      ...spec,
      x: minusX,
      label: labels.minus,
      color: color(canMinus),
      enabled: canMinus,
      onTap: change(-1),
    });
    addButton(this, {
      ...spec,
      x: plusX,
      label: labels.plus,
      color: color(canPlus),
      enabled: canPlus,
      onTap: change(1),
    });
  }

  // La scheda dei caduti con il lato di sopra a top: nessuno; o quanti, con quanto costa e quanto dura riaddestrarli e
  // Riaddestra (acceso se le razioni bastano); o, mentre si addestrano, quanto manca, con Finisci (acceso se c'è una
  // gemma)
  drawFallen(top) {
    const { card, fallenCard, cardTitleStyle, textStyle, labels } = HUD.barracks;
    const { profile } = this.save;
    const { count, rations, ms } = retrainCost(profile);
    const box = this.drawCard(top, fallenCard.height, count > 0);
    if (count === 0) {
      this.add.text(box.left, top + card.titleY, labels.noFallen, textStyle).setOrigin(0, 0.5);
      return;
    }
    const { retrain } = profile;
    const training = trainingCount(profile);
    const title =
      retrain !== null && training < count
        ? `${labels.fallenTitle}: ${count} (${training} ${labels.inTraining})`
        : `${labels.fallenTitle}: ${count}`;
    this.add.text(box.left, top + card.titleY, title, cardTitleStyle).setOrigin(0, 0.5);
    const line =
      retrain === null
        ? retrainLine(rations, ms)
        : `${labels.training} ${durationText(Math.max(0, retrain.endsAt - now()))}`;
    this.add.text(box.left, top + fallenCard.lineY, line, textStyle).setOrigin(0, 0.5);
    const { button, buttonStyle: style } = fallenCard;
    const enabled = retrain === null ? profile.resources.rations >= rations : profile.resources.gems > 0;
    const label = retrain === null ? labels.retrain : `${labels.rush} · ${amountText('gems', 1)}`;
    const act = () => {
      if (retrain === null) this.actions.startRetrain();
      else this.actions.rushRetrain();
      this.redraw();
    };
    const spec = { x: box.right - button.width / 2, y: top + fallenCard.buttonY, ...button, style };
    const color = enabled ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
    addButton(this, { ...spec, label, color, enabled, onTap: act });
  }

  // Il fondo di una scheda alta height con il lato di sopra a top, con il bordo acceso se lit; restituisce dove
  // cominciano e finiscono le scritte (left, right)
  drawCard(top, height, lit) {
    const { width, card } = HUD.barracks;
    const left = (this.scale.width - width) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color);
    graphics.fillRoundedRect(left, top, width, height, card.radius);
    graphics.lineStyle(card.borderWidth, lit ? card.litBorder : card.border);
    graphics.strokeRoundedRect(left, top, width, height, card.radius);
    return { left: left + card.padding, right: left + width - card.padding };
  }
}

// Quanto costa e quanto dura riaddestrare i caduti (rations razioni, ms millisecondi); se non costa razioni, quanto
// dura
function retrainLine(rations, ms) {
  const { labels } = HUD.barracks;
  if (rations === 0) return `${labels.takes} ${durationText(ms)}`;
  return `${labels.cost} ${amountText('rations', rations)} ${labels.and} ${durationText(ms)}`;
}

// L'arma del tipo type con i suoi numeri: danno, colpi al secondo e gittata; i pallini della raffica, il raggio del
// lanciatore, le vite dell'élite
function weaponText(type) {
  const { labels } = HUD.barracks;
  const weapon = WEAPONS[SOLDIER_TYPES[type].weapon];
  const parts = [
    weapon.label,
    `${labels.damage} ${decimalText(weapon.damage)}`,
    `${decimalText(weapon.fireRate)} ${labels.perSecond}`,
    `${labels.range} ${weapon.range}`,
  ];
  if (weapon.pellets) parts.push(`${weapon.pellets} ${labels.pellets}`);
  if (weapon.radius) parts.push(`${labels.radius} ${weapon.radius}`);
  if (weapon.name === ELITE.weapon) parts.push(`${ELITE.lives} ${labels.lives}`);
  return parts.join(HUD.world.separator);
}
