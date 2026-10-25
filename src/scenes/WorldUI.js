import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { WORLD_EVENTS } from '../core/events.js';
import { writeSave } from '../core/save.js';
import { minutesToMs } from '../core/time.js';
import { VILLAGE } from '../data/village.js';
import {
  canChallenge,
  canUpgrade,
  collectRations,
  farmOutput,
  nextGoal,
  startUpgrade,
  timeLeft,
  upgradeCost,
  useAccelerator,
  villageBonus,
} from '../meta/village.js';
import { amountText, durationText } from '../view/words.js';
import { createButtonBoard } from './buttons.js';

// L'interfaccia del mondo, ferma sopra la vista (scenes/World.js), in grigio. In alto le risorse; in basso il prossimo
// obiettivo (toccandolo si va all'edificio o lo si comincia a mettere) ed Eroi, Costruisci (il menu degli edifici da
// mettere, con cosa danno e quanto costano) ed Esplora (la mappa). Toccando un edificio nel mondo si apre la sua
// scheda: livello, cosa dà ora e al prossimo livello, il costo e Migliora, o il cantiere aperto con quanto manca, la
// sfida (una per cantiere) e l'acceleratore; la fattoria ha le razioni pronte e Raccogli; Sposta e Chiudi. Mentre si
// mette un edificio dice cosa fare. Parla con il mondo sul suo bus (WORLD_EVENTS); i suoi pulsanti non sono oggetti
// interattivi, così il mondo sotto riceve tutti i tocchi che cadono fuori (covers)
export class WorldUIScene extends Phaser.Scene {
  constructor() {
    super('WorldUI');
  }

  init({ bus }) {
    this.bus = bus;
  }

  create() {
    this.save = this.registry.get('save');
    this.board = createButtonBoard(this);
    this.selected = null;
    this.menuOpen = false;
    this.placing = null;
    const on = (name, handler) => this.bus.on(name, handler);
    on(WORLD_EVENTS.VILLAGE_CHANGED, () => this.redraw());
    on(WORLD_EVENTS.TICK, () => this.refreshTimed());
    on(WORLD_EVENTS.BUILDING_TAPPED, ({ id }) => this.show(id, false));
    on(WORLD_EVENTS.GROUND_TAPPED, () => this.show(null, false));
    on(WORLD_EVENTS.PLACEMENT_STARTED, ({ moving }) => {
      this.placing = moving ? 'move' : 'place';
      this.show(null, false);
    });
    on(WORLD_EVENTS.PLACEMENT_ENDED, () => {
      this.placing = null;
      this.redraw();
    });
    this.redraw();
  }

  // Il punto dello schermo cade sull'interfaccia: il mondo lo lascia stare
  covers(x, y) {
    return this.board?.covers(x, y) ?? false;
  }

  // Apre la scheda dell'edificio id, o il menu Costruisci (menu), o niente
  show(id, menu) {
    this.selected = id;
    this.menuOpen = menu;
    this.redraw();
  }

  // Dopo ogni cambio del villaggio, salvato, il mondo e l'interfaccia si ridisegnano
  changed() {
    writeSave(this.save);
    this.bus.emit(WORLD_EVENTS.VILLAGE_CHANGED);
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    this.board.clear();
    // Le scritte da rifare a ogni secondo, con come si rifanno
    this.timed = [];
    this.drawTop();
    this.drawButtons();
    if (this.placing !== null) this.drawHint();
    else if (this.selected !== null) this.drawPanel(this.selected);
    else if (this.menuOpen) this.drawMenu();
    else this.drawGoal();
  }

  refreshTimed() {
    for (const { text, make } of this.timed) text.setText(make());
  }

  // Le risorse, in alto su due righe
  drawTop() {
    const { top, resourcesY, lineGap, separator, resourcesStyle } = HUD.world;
    const { width } = this.scale;
    this.add.rectangle(0, 0, width, top.height, top.color, top.alpha).setOrigin(0);
    this.board.block({ x: width / 2, y: top.height / 2, width, height: top.height });
    const { rations, materials, scrap, dogTags, accelerators } = this.save.profile.resources;
    const first = [amountText('rations', rations), amountText('materials', materials), amountText('scrap', scrap)];
    const second = [amountText('dogTags', dogTags), amountText('accelerators', accelerators)];
    this.add.text(width / 2, resourcesY, first.join(separator), resourcesStyle).setOrigin(0.5);
    this.add.text(width / 2, resourcesY + lineGap, second.join(separator), resourcesStyle).setOrigin(0.5);
  }

  // Eroi, Costruisci ed Esplora, nella loro fascia; Costruisci apre e chiude il menu
  drawButtons() {
    const { heroesButton, buildButton, exploreButton, bottomBand, labels } = HUD.world;
    const { width, height } = this.scale;
    this.board.block({ x: width / 2, y: (bottomBand + height) / 2, width, height: height - bottomBand });
    const quiet = HUD.menu.quietButtonColor;
    const color = HUD.menu.buttonColor;
    const navigate = (scene, data) => () => this.bus.emit(WORLD_EVENTS.NAVIGATE, { scene, data });
    const heroes = navigate('Heroes', { from: 'World' });
    this.board.add({ ...heroesButton, label: labels.heroes, color: quiet, onTap: heroes });
    const toggle = () => this.show(null, !this.menuOpen);
    const enabled = this.placing === null;
    this.board.add({ ...buildButton, label: labels.build, color: quiet, enabled, onTap: toggle });
    this.board.add({ ...exploreButton, label: labels.explore, color, onTap: navigate('Map') });
  }

  // Mentre si mette un edificio: cosa fare, su un fondo scuro che si legge sopra la nebbia
  drawHint() {
    const { hint, hintStyle, labels } = HUD.world;
    const x = this.scale.width / 2;
    const graphics = this.add.graphics();
    const text = this.add.text(x, hint.y, this.placing === 'move' ? labels.moveHint : labels.placeHint, hintStyle);
    text.setOrigin(0.5);
    const width = text.width + hint.padding * 2;
    graphics.fillStyle(hint.color, hint.alpha);
    graphics.fillRoundedRect(x - width / 2, hint.y - hint.height / 2, width, hint.height, hint.radius);
  }

  // Il prossimo obiettivo: toccandolo si va al cantiere o all'edificio da migliorare (con la sua scheda), o si comincia
  // a mettere quello da costruire (se si può pagare; se no si apre il menu)
  drawGoal() {
    const { goal: box, goalStyle } = HUD.world;
    const { width } = this.scale;
    const left = (width - box.width) / 2;
    const top = box.y - box.height / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(box.color, box.alpha);
    graphics.fillRoundedRect(left, top, box.width, box.height, box.radius);
    graphics.lineStyle(box.borderWidth, box.border);
    graphics.strokeRoundedRect(left, top, box.width, box.height, box.radius);
    const line = this.add.text(left + box.padding, box.y, this.goalText(), goalStyle).setOrigin(0, 0.5);
    this.timed.push({ text: line, make: () => this.goalText() });
    this.board.area({ x: width / 2, y: box.y, width: box.width, height: box.height, onTap: () => this.goToGoal() });
  }

  goToGoal() {
    const { profile } = this.save;
    const job = profile.village.construction;
    const goal = nextGoal(profile);
    const id = job?.building ?? goal?.building ?? null;
    if (id === null) return;
    if (profile.village.positions[id] !== null) {
      this.bus.emit(WORLD_EVENTS.FOCUS_REQUESTED, { id });
      this.show(id, false);
    } else if (canUpgrade(profile, id)) {
      this.bus.emit(WORLD_EVENTS.PLACE_REQUESTED, { id });
    } else {
      this.show(null, true);
    }
  }

  // La riga del prossimo obiettivo: il cantiere aperto e quanto manca, oppure il prossimo edificio e cosa serve ancora
  goalText() {
    const { profile } = this.save;
    const { labels } = HUD.world;
    const job = profile.village.construction;
    if (job !== null) {
      const { name } = VILLAGE.buildings[job.building];
      const level = profile.village.levels[job.building] + 1;
      const left = durationText(timeLeft(profile, Date.now()));
      return `${labels.building}: ${name} ${labels.level} ${level}, ${labels.endsIn} ${left}`;
    }
    const goal = nextGoal(profile);
    if (goal === null) return labels.complete;
    const target = `${labels.next}: ${VILLAGE.buildings[goal.building].name} ${labels.level} ${goal.level}`;
    const missing = Object.entries(goal.missing).filter(([, amount]) => amount > 0);
    if (missing.length === 0) return `${target} · ${labels.ready}`;
    return `${target} · ${labels.missing} ${missing.map(([kind, amount]) => amountText(kind, amount)).join(', ')}`;
  }

  // Lo sfondo di una scheda alta height fino a bottom, che copre il mondo sotto; restituisce la sua cima
  drawSheet({ width, bottom, radius, color, border, borderWidth }, height, borderColor = border) {
    const top = bottom - height;
    const left = (this.scale.width - width) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(color);
    graphics.fillRoundedRect(left, top, width, height, radius);
    graphics.lineStyle(borderWidth, borderColor);
    graphics.strokeRoundedRect(left, top, width, height, radius);
    this.board.block({ x: this.scale.width / 2, y: top + height / 2, width, height });
    return top;
  }

  // La scheda dell'edificio id: livello (bordo acceso se è il prossimo obiettivo), cosa dà ora e al prossimo livello,
  // le razioni della fattoria, il cantiere o il costo con Migliora, poi Sposta e Chiudi
  drawPanel(id) {
    const { profile } = this.save;
    const { panel, labels, titleStyle, textStyle } = HUD.world;
    const goal = nextGoal(profile)?.building === id;
    const top = this.drawSheet(panel, panel.height, goal ? panel.goalBorder : panel.border);
    const left = (this.scale.width - panel.width) / 2 + panel.padding;
    const level = profile.village.levels[id];
    const name = `${VILLAGE.buildings[id].name} · ${labels.level} ${level}`;
    this.add.text(left, top + panel.titleY, name, titleStyle).setOrigin(0, 0.5);
    const now = level === 0 ? labels.site : effectText(id, level);
    this.add.text(left, top + panel.nowY, `${labels.now}: ${now}`, textStyle).setOrigin(0, 0.5);
    const cost = upgradeCost(profile, id);
    const next = cost === null ? labels.max : `${labels.levelLong} ${level + 1}: ${effectText(id, level + 1)}`;
    this.add.text(left, top + panel.nextY, next, textStyle).setOrigin(0, 0.5);
    if (id === 'farm' && level > 0) this.drawFarm(top, left);
    if (profile.village.construction?.building === id) this.drawConstruction(top, left);
    else if (cost !== null) this.drawUpgrade(id, top, left, cost);
    const quiet = HUD.menu.quietButtonColor;
    const move = () => this.bus.emit(WORLD_EVENTS.MOVE_REQUESTED, { id });
    this.board.add({ ...panel.moveButton, y: top + panel.lowerY, label: labels.move, color: quiet, onTap: move });
    const close = () => this.show(null, false);
    this.board.add({ ...panel.closeButton, y: top + panel.lowerY, label: labels.close, color: quiet, onTap: close });
  }

  // Razioni pronte della fattoria e Raccogli
  drawFarm(top, left) {
    const { profile } = this.save;
    const { panel, labels, textStyle } = HUD.world;
    const { storage } = farmOutput(profile.village.levels.farm);
    const ready = Math.floor(profile.village.farm.stored);
    const text = `${labels.farmReady}: ${ready}/${storage} ${labels.rations}`;
    this.add.text(left, top + panel.farmY, text, textStyle).setOrigin(0, 0.5);
    const collect = () => {
      collectRations(profile);
      this.changed();
    };
    const button = { ...panel.collectButton, y: top + panel.farmY, label: labels.collect, enabled: ready > 0 };
    this.board.add({ ...button, color: HUD.menu.buttonColor, onTap: collect });
  }

  // Costo e durata del prossimo livello e Migliora (spento se c'è un altro cantiere o non bastano le risorse)
  drawUpgrade(id, top, left, cost) {
    const { profile } = this.save;
    const { panel, labels, textStyle } = HUD.world;
    const busy = profile.village.construction !== null;
    const status = busy ? labels.oneAtATime : `${labels.cost}: ${costText(cost)}`;
    this.add.text(left, top + panel.statusY, status, textStyle).setOrigin(0, 0.5);
    const upgrade = () => {
      startUpgrade(profile, id, Date.now());
      this.changed();
    };
    const label = `${labels.upgrade} ${profile.village.levels[id] + 1}`;
    const button = { ...panel.upgradeButton, y: top + panel.buttonY, label, enabled: canUpgrade(profile, id) };
    this.board.add({ ...button, color: HUD.menu.buttonColor, onTap: upgrade });
  }

  // Il cantiere aperto: quanto manca, la sfida e l'acceleratore
  drawConstruction(top, left) {
    const { profile } = this.save;
    const { panel, labels, textStyle } = HUD.world;
    const status = () => `${labels.inProgress} ${durationText(timeLeft(profile, Date.now()))}`;
    const line = this.add.text(left, top + panel.statusY, status(), textStyle).setOrigin(0, 0.5);
    this.timed.push({ text: line, make: status });
    const y = top + panel.buttonY;
    const open = canChallenge(profile, Date.now());
    const share = Math.round(VILLAGE.challenge.timeShare * 100);
    let challengeLabel = `${labels.challenge} −${share}%`;
    if (!open) challengeLabel = profile.village.construction.challenged ? labels.challengeUsed : labels.challengeShort;
    const challenge = () => this.bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'Lineup', data: { mode: 'challenge' } });
    const color = HUD.menu.buttonColor;
    this.board.add({ ...panel.challengeButton, y, label: challengeLabel, color, enabled: open, onTap: challenge });
    const accelerate = () => {
      useAccelerator(profile, Date.now());
      this.changed();
    };
    const label = `${labels.accelerator} −${VILLAGE.acceleratorMinutes} ${HUD.units.minute}`;
    const enabled = profile.resources.accelerators > 0;
    const quiet = HUD.menu.quietButtonColor;
    this.board.add({ ...panel.acceleratorButton, y, label, color: quiet, enabled, onTap: accelerate });
  }

  // Il menu Costruisci: una riga per edificio ancora da mettere, con cosa dà al primo livello, il costo e Costruisci
  // (spento se c'è un altro cantiere o non bastano le risorse); poi Chiudi
  drawMenu() {
    const { profile } = this.save;
    const { menu, labels, titleStyle, textStyle } = HUD.world;
    const ids = Object.keys(VILLAGE.buildings).filter((id) => profile.village.positions[id] === null);
    // La cima di Chiudi, dalla cima del menu, e l'altezza del menu
    const closeY = menu.rowsY + Math.max(1, ids.length) * menu.rowHeight + menu.closeGap;
    const height = closeY + menu.closeButton.height + menu.padding;
    const top = this.drawSheet(menu, height);
    const left = (this.scale.width - menu.width) / 2 + menu.padding;
    this.add.text(left, top + menu.titleY, labels.menuTitle, titleStyle).setOrigin(0, 0.5);
    if (ids.length === 0) this.add.text(left, top + menu.rowsY, labels.allPlaced, textStyle).setOrigin(0, 0);
    const busy = profile.village.construction !== null;
    ids.forEach((id, index) => {
      const y = top + menu.rowsY + index * menu.rowHeight;
      const building = VILLAGE.buildings[id];
      this.add.text(left, y + menu.nameY, building.name, titleStyle).setOrigin(0, 0);
      this.add.text(left, y + menu.effectY, `${labels.levelLong} 1: ${effectText(id, 1)}`, textStyle).setOrigin(0, 0);
      const status = busy ? labels.oneAtATime : `${labels.cost}: ${costText(upgradeCost(profile, id))}`;
      this.add.text(left, y + menu.costY, status, textStyle).setOrigin(0, 0);
      const place = () => this.bus.emit(WORLD_EVENTS.PLACE_REQUESTED, { id });
      const enabled = canUpgrade(profile, id);
      const button = { ...menu.buildButton, y: y + menu.buttonY, label: labels.build, enabled };
      this.board.add({ ...button, color: HUD.menu.buttonColor, onTap: place });
    });
    const close = () => this.show(null, false);
    const y = top + closeY + menu.closeButton.height / 2;
    this.board.add({ ...menu.closeButton, y, label: labels.close, color: HUD.menu.quietButtonColor, onTap: close });
  }
}

// Costo e durata di un livello: "25 materiali · 2 rottami · 5 min"
function costText(cost) {
  const parts = [amountText('materials', cost.materials)];
  if (cost.scrap > 0) parts.push(amountText('scrap', cost.scrap));
  parts.push(durationText(minutesToMs(cost.minutes)));
  return parts.join(HUD.world.separator);
}

// Cosa dà l'edificio id al livello level (da 1)
function effectText(id, level) {
  const { labels, separator } = HUD.world;
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
  return parts.join(separator);
}
