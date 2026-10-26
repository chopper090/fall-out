import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { MINUS, percentText } from '../core/format.js';
import { WORLD_EVENTS } from '../core/events.js';
import { VILLAGE } from '../data/village.js';
import { WORLD } from '../data/world.js';
import { areaProgress, canStep, conquestReward, hereTile, nextTile, rationsShort } from '../meta/road.js';
import { canChallenge, canUpgrade, farmOutput, nextGoal, upgradeCost } from '../meta/village.js';
import {
  costText,
  effectText,
  rationsText,
  rewardText,
  tileText,
  timeLeftText,
  whereText,
} from '../view/worldWords.js';

// Le schede dell'interfaccia del mondo (scenes/WorldUI.js), in basso sopra il mondo: quella dell'edificio, quella
// della strada e il menu Costruisci. ui è la scena dell'interfaccia: ci si disegna, si mettono i pulsanti sul suo
// board, le scritte da rifare a ogni secondo in timed (che rileggono il profilo, rifatto a ogni azione), con open e il
// suo bus si parla con lei e con il mondo, con le sue actions (meta/actions.js) si cambia il profilo

// La scheda dell'edificio id: livello (bordo acceso se è il prossimo obiettivo), cosa dà ora e al prossimo livello,
// le razioni della fattoria, il cantiere o il costo con Migliora, poi Sposta e Chiudi
export function drawBuildingSheet(ui, id) {
  const { profile } = ui.save;
  const { panel, labels, titleStyle, textStyle } = HUD.world;
  const goal = nextGoal(profile)?.building === id;
  const top = drawSheet(ui, panel, panel.height, goal ? panel.goalBorder : panel.border);
  const left = (ui.scale.width - panel.width) / 2 + panel.padding;
  const level = profile.village.levels[id];
  const name = `${VILLAGE.buildings[id].name} · ${labels.level} ${level}`;
  ui.add.text(left, top + panel.titleY, name, titleStyle).setOrigin(0, 0.5);
  const effect = level === 0 ? labels.site : effectText(id, level);
  ui.add.text(left, top + panel.nowY, `${labels.now}: ${effect}`, textStyle).setOrigin(0, 0.5);
  const cost = upgradeCost(profile, id);
  const next = cost === null ? labels.max : `${labels.levelLong} ${level + 1}: ${effectText(id, level + 1)}`;
  ui.add.text(left, top + panel.nextY, next, textStyle).setOrigin(0, 0.5);
  if (id === 'farm' && level > 0) drawFarm(ui, top, left);
  if (profile.village.construction?.building === id) drawConstruction(ui, top, left);
  else if (cost !== null) drawUpgrade(ui, id, top, left, cost);
  const quiet = HUD.menu.quietButtonColor;
  const move = () => ui.bus.emit(WORLD_EVENTS.MOVE_REQUESTED, { id });
  ui.board.add({ ...panel.moveButton, y: top + panel.lowerY, label: labels.move, color: quiet, onTap: move });
  const close = () => ui.open(null);
  ui.board.add({ ...panel.closeButton, y: top + panel.lowerY, label: labels.close, color: quiet, onTap: close });
}

// La scheda della strada, nel posto di quella degli edifici: l'area da conquistare e dove si è; la battaglia da
// vincere dove si è o la prossima casella, con quanto costa; il premio della conquista; le razioni (e come averne
// altre, se non bastano). Sotto, Combatti (la battaglia da vincere, già pagata), Raccogli (le razioni della fattoria
// che servono per andare avanti) o Avanza, e Chiudi. Le righe troppo larghe si stringono
export function drawRoadSheet(ui) {
  const { profile } = ui.save;
  const { panel, roadSheet: rows, road: labels, titleStyle, textStyle, separator } = HUD.world;
  const top = drawSheet(ui, panel, panel.height);
  const left = (ui.scale.width - panel.width) / 2 + panel.padding;
  const room = panel.width - panel.padding * 2;
  const line = (y, text, style = textStyle) => {
    const label = ui.add.text(left, top + y, text, style).setOrigin(0, 0.5);
    return label.setScale(Math.min(1, room / label.width));
  };
  const close = () => ui.open(null);
  const closeButton = { ...panel.wideButton, y: top + panel.lowerY, label: HUD.world.labels.close };
  ui.board.add({ ...closeButton, color: HUD.menu.quietButtonColor, onTap: close });
  const progress = areaProgress(profile);
  if (progress === null) {
    line(rows.titleY, labels.title, titleStyle);
    line(rows.whereY, labels.done);
    return;
  }
  const area = `${labels.area} ${progress.area + 1} ${labels.of} ${WORLD.road.length}`;
  line(rows.titleY, `${labels.title}${separator}${area}`, titleStyle);
  line(rows.whereY, whereText(profile, progress));
  const here = hereTile(profile);
  const pending = !profile.road.done;
  line(rows.nextY, pending ? `${labels.here}: ${tileText(here)}` : `${labels.next}: ${tileText(nextTile(profile))}`);
  const conquest = [...rewardText(conquestReward(progress.area)), labels.ground].join(separator);
  line(rows.conquestY, `${labels.conquest}: ${conquest}`);
  const rations = line(rows.rationsY, rationsText(profile));
  ui.timed.push({ text: rations, make: () => rationsText(ui.save.profile) });
  const y = top + panel.buttonY;
  const color = HUD.menu.buttonColor;
  if (pending) {
    const data = { mode: 'road', tile: here.index };
    const fight = () => ui.bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'Lineup', data });
    ui.board.add({ ...panel.wideButton, y, label: labels.fight, color, onTap: fight });
    return;
  }
  if (rationsShort(profile) && profile.village.farm.stored >= 1) {
    const collect = () => ui.actions.collectRations();
    ui.board.add({ ...panel.wideButton, y, label: labels.collect, color, onTap: collect });
    return;
  }
  const walk = () => ui.bus.emit(WORLD_EVENTS.STEP_REQUESTED);
  ui.board.add({ ...panel.wideButton, y, label: labels.step, color, enabled: canStep(profile), onTap: walk });
}

// Il menu Costruisci: una riga per edificio ancora da mettere, con cosa dà al primo livello, il costo e Costruisci
// (spento se c'è un altro cantiere o non bastano le risorse); poi Chiudi
export function drawBuildMenu(ui) {
  const { profile } = ui.save;
  const { menu, labels, titleStyle, textStyle } = HUD.world;
  const ids = Object.keys(VILLAGE.buildings).filter((id) => profile.village.positions[id] === null);
  // La cima di Chiudi, dalla cima del menu, e l'altezza del menu
  const closeY = menu.rowsY + Math.max(1, ids.length) * menu.rowHeight + menu.closeGap;
  const height = closeY + menu.closeButton.height + menu.padding;
  const top = drawSheet(ui, menu, height);
  const left = (ui.scale.width - menu.width) / 2 + menu.padding;
  ui.add.text(left, top + menu.titleY, labels.menuTitle, titleStyle).setOrigin(0, 0.5);
  if (ids.length === 0) ui.add.text(left, top + menu.rowsY, labels.allPlaced, textStyle).setOrigin(0, 0);
  const busy = profile.village.construction !== null;
  ids.forEach((id, index) => {
    const y = top + menu.rowsY + index * menu.rowHeight;
    const building = VILLAGE.buildings[id];
    ui.add.text(left, y + menu.nameY, building.name, titleStyle).setOrigin(0, 0);
    ui.add.text(left, y + menu.effectY, `${labels.levelLong} 1: ${effectText(id, 1)}`, textStyle).setOrigin(0, 0);
    const status = busy ? labels.oneAtATime : `${labels.cost}: ${costText(upgradeCost(profile, id))}`;
    ui.add.text(left, y + menu.costY, status, textStyle).setOrigin(0, 0);
    const place = () => ui.bus.emit(WORLD_EVENTS.PLACE_REQUESTED, { id });
    const enabled = canUpgrade(profile, id);
    const button = { ...menu.buildButton, y: y + menu.buttonY, label: labels.build, enabled };
    ui.board.add({ ...button, color: HUD.menu.buttonColor, onTap: place });
  });
  const close = () => ui.open(null);
  const y = top + closeY + menu.closeButton.height / 2;
  ui.board.add({ ...menu.closeButton, y, label: labels.close, color: HUD.menu.quietButtonColor, onTap: close });
}

// Lo sfondo di una scheda alta height fino a bottom, che copre il mondo sotto; restituisce la sua cima
function drawSheet(ui, { width, bottom, radius, color, border, borderWidth }, height, borderColor = border) {
  const top = bottom - height;
  const left = (ui.scale.width - width) / 2;
  const graphics = ui.add.graphics();
  graphics.fillStyle(color);
  graphics.fillRoundedRect(left, top, width, height, radius);
  graphics.lineStyle(borderWidth, borderColor);
  graphics.strokeRoundedRect(left, top, width, height, radius);
  ui.board.block({ x: ui.scale.width / 2, y: top + height / 2, width, height });
  return top;
}

// Razioni pronte della fattoria e Raccogli
function drawFarm(ui, top, left) {
  const { profile } = ui.save;
  const { panel, labels, textStyle } = HUD.world;
  const { storage } = farmOutput(profile.village.levels.farm);
  const ready = Math.floor(profile.village.farm.stored);
  const text = `${labels.farmReady}: ${ready}/${storage} ${labels.rations}`;
  ui.add.text(left, top + panel.farmY, text, textStyle).setOrigin(0, 0.5);
  const collect = () => ui.actions.collectRations();
  const button = { ...panel.collectButton, y: top + panel.farmY, label: labels.collect, enabled: ready > 0 };
  ui.board.add({ ...button, color: HUD.menu.buttonColor, onTap: collect });
}

// Costo e durata del prossimo livello e Migliora (spento se c'è un altro cantiere o non bastano le risorse)
function drawUpgrade(ui, id, top, left, cost) {
  const { profile } = ui.save;
  const { panel, labels, textStyle } = HUD.world;
  const busy = profile.village.construction !== null;
  const status = busy ? labels.oneAtATime : `${labels.cost}: ${costText(cost)}`;
  ui.add.text(left, top + panel.statusY, status, textStyle).setOrigin(0, 0.5);
  const upgrade = () => ui.actions.startUpgrade(id);
  const label = `${labels.upgrade} ${profile.village.levels[id] + 1}`;
  const button = { ...panel.wideButton, y: top + panel.buttonY, label, enabled: canUpgrade(profile, id) };
  ui.board.add({ ...button, color: HUD.menu.buttonColor, onTap: upgrade });
}

// Il cantiere aperto: quanto manca, la sfida e l'acceleratore
function drawConstruction(ui, top, left) {
  const { profile } = ui.save;
  const { panel, labels, textStyle } = HUD.world;
  const status = () => `${labels.inProgress} ${timeLeftText(ui.save.profile, now())}`;
  const line = ui.add.text(left, top + panel.statusY, status(), textStyle).setOrigin(0, 0.5);
  ui.timed.push({ text: line, make: status });
  const y = top + panel.buttonY;
  const open = canChallenge(profile, now());
  let challengeLabel = `${labels.challenge} ${percentText(VILLAGE.challenge.timeShare, MINUS)}`;
  if (!open) challengeLabel = profile.village.construction.challenged ? labels.challengeUsed : labels.challengeShort;
  const challenge = () => ui.bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'Lineup', data: { mode: 'challenge' } });
  const color = HUD.menu.buttonColor;
  ui.board.add({ ...panel.challengeButton, y, label: challengeLabel, color, enabled: open, onTap: challenge });
  const accelerate = () => ui.actions.useAccelerator();
  const label = `${labels.accelerator} ${MINUS}${VILLAGE.acceleratorMinutes} ${HUD.units.minute}`;
  const enabled = profile.resources.accelerators > 0;
  const quiet = HUD.menu.quietButtonColor;
  ui.board.add({ ...panel.acceleratorButton, y, label, color: quiet, enabled, onTap: accelerate });
}
