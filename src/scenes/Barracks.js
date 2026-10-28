import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { decimalText } from '../core/format.js';
import { BASE_SOLDIER, ELITE, SOLDIER_TYPES, WEAPONS } from '../data/units.js';
import { armyCapacity, armyOf, trainableTypes } from '../meta/barracks.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

// La caserma (meta/barracks.js), in grigio: in alto il titolo con il livello e quanti soldati ha l'esercito; poi una
// scheda per tipo di soldati, con quanti ne ha e la sua arma con i suoi numeri. I fucilieri prendono i posti che
// restano; gli altri tipi hanno − (il soldato torna fuciliere) e + (un fuciliere diventa di quel tipo), o, finché la
// caserma non li addestra, da che livello arrivano. Mondo torna al mondo; l'ingranaggio apre le impostazioni. I cambi
// li fanno le azioni del meta-gioco (meta/actions.js changeArmy); la schermata si ridisegna a ogni tocco
export class BarracksScene extends Phaser.Scene {
  constructor() {
    super('Barracks');
  }

  create() {
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    this.redraw();
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, armyY, titleStyle, textStyle, back, labels, top, cardHeight, gap } = HUD.barracks;
    const x = this.scale.width / 2;
    const level = this.save.profile.village.levels.barracks;
    this.add.text(x, titleY, `${labels.title} · ${labels.level} ${level}`, titleStyle).setOrigin(0.5);
    const army = `${labels.army} ${armyCapacity(level)} ${labels.soldiers}`;
    this.add.text(x, armyY, army, textStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    const counts = armyOf(this.save.profile);
    const open = trainableTypes(level);
    Object.keys(SOLDIER_TYPES).forEach((type, index) => {
      this.drawType(type, counts, open.includes(type), top + index * (cardHeight + gap));
    });
    const leave = () => this.scene.start('World');
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
  }

  // La scheda del tipo type con il lato di sopra a top: il nome e quanti ne ha l'esercito (counts), l'arma, e i
  // pulsanti − e + (la base dice che prende i posti che restano; un tipo che la caserma non addestra, da che livello)
  drawType(type, counts, open, top) {
    const { card, cardTitleStyle, textStyle, lockedStyle, labels } = HUD.barracks;
    const { label, barracks } = SOLDIER_TYPES[type];
    const box = this.drawCard(top, open);
    const title = open ? `${label}: ${counts[type]}` : label;
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
    this.drawChanges(type, counts, box, top + card.buttonY);
  }

  // − e + del tipo type, in basso a destra nella scheda box, con il centro all'altezza y: accesi se c'è il soldato da
  // cambiare
  drawChanges(type, counts, box, y) {
    const { button, buttonStyle: style, labels } = HUD.barracks;
    const change = (delta) => () => {
      this.actions.changeArmy(type, delta);
      this.redraw();
    };
    const plusX = box.right - button.width / 2;
    const minusX = plusX - button.width - button.gap;
    const spec = { y, width: button.width, height: button.height, style };
    const color = (enabled) => (enabled ? HUD.menu.buttonColor : HUD.menu.quietButtonColor);
    const canMinus = counts[type] > 0;
    const canPlus = counts[BASE_SOLDIER] > 0;
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

  // Il fondo di una scheda con il lato di sopra a top, con il bordo acceso se il tipo si addestra; restituisce dove
  // cominciano e finiscono le scritte (left, right)
  drawCard(top, open) {
    const { width, cardHeight, card } = HUD.barracks;
    const left = (this.scale.width - width) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color);
    graphics.fillRoundedRect(left, top, width, cardHeight, card.radius);
    graphics.lineStyle(card.borderWidth, open ? card.litBorder : card.border);
    graphics.strokeRoundedRect(left, top, width, cardHeight, card.radius);
    return { left: left + card.padding, right: left + width - card.padding };
  }
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
