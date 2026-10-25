import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { refreshSave, writeSave } from '../core/save.js';
import { minutesToMs } from '../core/time.js';
import { VILLAGE } from '../data/village.js';
import {
  canChallenge,
  canUpgrade,
  collectRations,
  farmOutput,
  nextGoal,
  settle,
  startUpgrade,
  timeLeft,
  upgradeCost,
  useAccelerator,
  villageBonus,
} from '../meta/village.js';
import { amountText, durationText } from '../view/words.js';
import { addButton } from './buttons.js';

// Il villaggio, la schermata base, in grigio. In alto le risorse e il prossimo obiettivo; sotto una scheda per
// edificio (data/village.js): livello, cosa dà ora e al prossimo livello, il costo e il pulsante per costruire o
// migliorare; quella del prossimo obiettivo ha il bordo acceso. La fattoria costruita mostra le razioni pronte, da
// raccogliere. Il cantiere aperto mostra quanto manca, la sfida (una per cantiere: porta allo schieramento della
// sfida) e l'acceleratore. In fondo Eroi e Battaglia. Il tempo scorre anche qui: ogni secondo il villaggio si
// aggiorna. Ogni cambio si salva subito
export class VillageScene extends Phaser.Scene {
  constructor() {
    super('Village');
  }

  create() {
    this.save = this.registry.get('save');
    refreshSave(this.save);
    this.redraw();
    this.time.addEvent({ delay: HUD.village.tickMs, loop: true, callback: () => this.tick() });
  }

  // Il tempo scorre: con un cantiere finito o una razione in più pronta si ridisegna tutto, altrimenti cambiano solo
  // le scritte con il tempo che manca (ridisegnando a ogni secondo un tocco a metà andrebbe perso)
  tick() {
    settle(this.save.profile, Date.now());
    if (this.state() === this.shown) for (const { text, make } of this.timed) text.setText(make());
    else this.redraw();
  }

  // Quello che cambia i pulsanti e le schede: livelli, cantiere aperto, razioni pronte intere, risorse, sfida possibile
  state() {
    const { profile } = this.save;
    const { village, resources } = profile;
    const ready = Math.floor(village.farm.stored);
    const challenge = canChallenge(profile, Date.now());
    return JSON.stringify([village.levels, village.construction?.building ?? null, ready, resources, challenge]);
  }

  // Si ridisegna tutto, al tempo di adesso
  redraw() {
    const { profile } = this.save;
    settle(profile, Date.now());
    this.children.removeAll(true);
    // Quello che si sta disegnando, e le scritte da rifare a ogni secondo con come si rifanno
    this.shown = this.state();
    this.timed = [];
    const layout = HUD.village;
    const x = this.scale.width / 2;
    this.add.text(x, layout.titleY, layout.title, layout.titleStyle).setOrigin(0.5);
    const { rations, materials, scrap, dogTags, accelerators } = profile.resources;
    const first = [amountText('rations', rations), amountText('materials', materials), amountText('scrap', scrap)];
    const second = [amountText('dogTags', dogTags), amountText('accelerators', accelerators)];
    this.add.text(x, layout.resourcesY, first.join(layout.separator), layout.textStyle).setOrigin(0.5);
    const secondY = layout.resourcesY + layout.lineGap;
    this.add.text(x, secondY, second.join(layout.separator), layout.textStyle).setOrigin(0.5);
    const goal = nextGoal(profile);
    const goalLine = this.add.text(x, layout.goalY, this.goalText(goal), layout.goalStyle).setOrigin(0.5);
    this.timed.push({ text: goalLine, make: () => this.goalText(nextGoal(profile)) });
    Object.keys(VILLAGE.buildings).forEach((id, index) => this.drawCard(id, index, goal?.building === id));
    const { heroesButton, battleButton, labels } = layout;
    const openHeroes = () => this.scene.start('Heroes', { from: 'Village' });
    const openBattle = () => this.scene.start('Lineup', { challenge: false });
    addButton(this, { ...heroesButton, label: labels.heroes, color: HUD.menu.quietButtonColor, onTap: openHeroes });
    addButton(this, { ...battleButton, label: labels.battle, color: HUD.menu.buttonColor, onTap: openBattle });
  }

  // La riga in alto: il cantiere aperto e quanto manca, oppure il prossimo edificio e cosa serve ancora
  goalText(goal) {
    const { profile } = this.save;
    const { labels } = HUD.village;
    const job = profile.village.construction;
    if (job !== null) {
      const { name } = VILLAGE.buildings[job.building];
      const level = profile.village.levels[job.building] + 1;
      const left = durationText(timeLeft(profile, Date.now()));
      return `${labels.building}: ${name} ${labels.level} ${level}, ${labels.endsIn} ${left}`;
    }
    if (goal === null) return labels.complete;
    const target = `${labels.next}: ${VILLAGE.buildings[goal.building].name} ${labels.level} ${goal.level}`;
    const missing = Object.entries(goal.missing).filter(([, amount]) => amount > 0);
    if (missing.length === 0) return `${target} · ${labels.ready}`;
    return `${target} · ${labels.missing} ${missing.map(([kind, amount]) => amountText(kind, amount)).join(', ')}`;
  }

  // Scheda dell'edificio id, la index-esima dall'alto; goal: è il prossimo obiettivo
  drawCard(id, index, goal) {
    const { profile } = this.save;
    const { card, labels } = HUD.village;
    const top = card.y0 + index * (card.height + card.gap);
    const left = (this.scale.width - card.width) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color);
    graphics.fillRoundedRect(left, top, card.width, card.height, card.radius);
    graphics.lineStyle(card.borderWidth, goal ? card.goalBorder : card.border);
    graphics.strokeRoundedRect(left, top, card.width, card.height, card.radius);
    const level = profile.village.levels[id];
    const x = left + card.padding;
    const name = `${VILLAGE.buildings[id].name} · ${labels.level} ${level}`;
    this.add.text(x, top + card.titleY, name, card.titleStyle).setOrigin(0, 0.5);
    const right = left + card.width - card.padding;
    if (goal) this.add.text(right, top + card.titleY, labels.goal, card.goalStyle).setOrigin(1, 0.5);
    const now = level === 0 ? labels.notBuilt : effectText(id, level);
    this.add.text(x, top + card.nowY, `${labels.now}: ${now}`, card.textStyle).setOrigin(0, 0.5);
    const cost = upgradeCost(profile, id);
    const next = cost === null ? labels.max : `${labels.levelLong} ${level + 1}: ${effectText(id, level + 1)}`;
    this.add.text(x, top + card.nextY, next, card.textStyle).setOrigin(0, 0.5);
    if (id === 'farm' && level > 0) this.drawFarm(top);
    if (profile.village.construction?.building === id) this.drawConstruction(top);
    else if (cost !== null) this.drawUpgrade(id, top, level, cost);
  }

  // Razioni pronte della fattoria e Raccogli
  drawFarm(top) {
    const { profile } = this.save;
    const { card, labels } = HUD.village;
    const left = (this.scale.width - card.width) / 2;
    const { storage } = farmOutput(profile.village.levels.farm);
    const ready = Math.floor(profile.village.farm.stored);
    const text = `${labels.farmReady}: ${ready}/${storage} ${labels.rations}`;
    this.add.text(left + card.padding, top + card.farmY, text, card.textStyle).setOrigin(0, 0.5);
    const collect = () => {
      collectRations(profile);
      writeSave(this.save);
      this.redraw();
    };
    const button = { ...card.collectButton, y: top + card.farmY, label: labels.collect, enabled: ready > 0 };
    addButton(this, { ...button, color: HUD.menu.buttonColor, onTap: collect });
  }

  // Costo e durata del prossimo livello, e il pulsante (spento se c'è un altro cantiere o non bastano le risorse)
  drawUpgrade(id, top, level, cost) {
    const { profile } = this.save;
    const { card, labels } = HUD.village;
    const left = (this.scale.width - card.width) / 2;
    const parts = [amountText('materials', cost.materials)];
    if (cost.scrap > 0) parts.push(amountText('scrap', cost.scrap));
    parts.push(durationText(minutesToMs(cost.minutes)));
    const busy = profile.village.construction !== null;
    const status = busy ? labels.oneAtATime : `${labels.cost}: ${parts.join(HUD.village.separator)}`;
    this.add.text(left + card.padding, top + card.statusY, status, card.textStyle).setOrigin(0, 0.5);
    const upgrade = () => {
      startUpgrade(profile, id, Date.now());
      writeSave(this.save);
      this.redraw();
    };
    const label = level === 0 ? labels.build : `${labels.upgrade} ${level + 1}`;
    const button = { ...card.upgradeButton, y: top + card.buttonY, label, enabled: canUpgrade(profile, id) };
    addButton(this, { ...button, color: HUD.menu.buttonColor, onTap: upgrade });
  }

  // Il cantiere aperto: quanto manca, la sfida e l'acceleratore
  drawConstruction(top) {
    const { profile } = this.save;
    const { card, labels } = HUD.village;
    const left = (this.scale.width - card.width) / 2;
    const status = () => `${labels.inProgress} ${durationText(timeLeft(profile, Date.now()))}`;
    const statusLine = this.add.text(left + card.padding, top + card.statusY, status(), card.textStyle);
    statusLine.setOrigin(0, 0.5);
    this.timed.push({ text: statusLine, make: status });
    const challenge = () => this.scene.start('Lineup', { challenge: true });
    const share = Math.round(VILLAGE.challenge.timeShare * 100);
    const open = canChallenge(profile, Date.now());
    let challengeLabel = `${labels.challenge} −${share}%`;
    if (!open) challengeLabel = profile.village.construction.challenged ? labels.challengeUsed : labels.challengeShort;
    const y = top + card.buttonY;
    const color = HUD.menu.buttonColor;
    addButton(this, { ...card.challengeButton, y, label: challengeLabel, color, enabled: open, onTap: challenge });
    const accelerate = () => {
      useAccelerator(profile, Date.now());
      writeSave(this.save);
      this.redraw();
    };
    const { accelerators } = profile.resources;
    const acceleratorLabel = `${labels.accelerator} −${VILLAGE.acceleratorMinutes} ${HUD.village.units.minute}`;
    const quiet = HUD.menu.quietButtonColor;
    const enabled = accelerators > 0;
    const button = { ...card.acceleratorButton, y, label: acceleratorLabel, color: quiet, enabled };
    addButton(this, { ...button, onTap: accelerate });
  }
}

// Cosa dà l'edificio id al livello level (da 1)
function effectText(id, level) {
  const { labels } = HUD.village;
  if (id === 'farm') {
    const { perHour, storage } = farmOutput(level);
    return `${perHour} ${labels.perHour}, ${labels.upTo} ${storage}`;
  }
  const bonus = villageBonus({ barracks: level, forge: level });
  if (id === 'barracks') return `+${bonus.soldiers} ${labels.soldiers}`;
  const { damage, fireRate, autoAim } = bonus.weapons;
  const parts = [`${labels.damage} +${Math.round(damage * 100)}%`];
  if (fireRate > 0) parts.push(`${labels.fireRate} +${Math.round(fireRate * 100)}%`);
  if (autoAim) parts.push(labels.autoAim);
  return parts.join(HUD.village.separator);
}
