import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { WORLD } from '../data/world.js';
import { areaProgress, conquestReward, hereTile, nextTile, rationsShort } from '../meta/road.js';
import { rationsText, rewardText, sitesText, tileText, whereText } from '../view/worldWords.js';

// La scheda della strada dell'interfaccia del mondo (scenes/WorldUI.js), in basso sopra il mondo, e le parti comuni
// a tutte le schede (anche le barre di scenes/worldBars.js): lo sfondo e i posti cantiere occupati. ui è la scena
// dell'interfaccia: ci si disegna, si mettono i pulsanti sul suo board, le scritte da rifare a ogni secondo in timed
// (che rileggono il profilo, rifatto a ogni azione), con open e il suo bus si parla con lei e con il mondo, con le sue
// actions (meta/actions.js) si cambia il profilo

// La scheda della strada, sopra la barra in basso: l'area da conquistare e dove si è; la battaglia da vincere
// dove si è (che si riprova senza pagare) o la prossima casella, con quanto costa; il premio della conquista; le
// razioni (e come averne altre, se non bastano). Sotto, Raccogli (le razioni della fattoria che servono per andare
// avanti) o cosa toccare per andare avanti (nessun pulsante: si va avanti toccando la casella, scenes/World.js), e
// Chiudi. Le righe troppo larghe si stringono
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
  const pending = !profile.road.done;
  const tile = pending ? hereTile(profile) : nextTile(profile);
  line(rows.nextY, `${pending ? labels.here : labels.next}: ${tileText(tile, { retry: pending })}`);
  const conquest = [...rewardText(conquestReward(progress.area)), labels.ground].join(separator);
  line(rows.conquestY, `${labels.conquest}: ${conquest}`);
  const rations = line(rows.rationsY, rationsText(profile, now()));
  ui.timed.push({ text: rations, make: () => rationsText(ui.save.profile, now()) });
  if (!rationsShort(profile)) {
    line(rows.hintY, labels.hint, HUD.world.hintStyle);
    return;
  }
  if (profile.village.farm.stored < 1) return;
  const collect = () => ui.actions.collectRations();
  const button = { ...panel.wideButton, y: top + panel.buttonY, label: labels.collect };
  ui.board.add({ ...button, color: HUD.menu.buttonColor, onTap: collect });
}

// Lo sfondo di una scheda alta height fino a bottom, che copre il mondo sotto; restituisce la sua cima
export function drawSheet(ui, { width, bottom, radius, color, border, borderWidth }, height, borderColor = border) {
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

// I posti cantiere occupati, a destra sulla riga del titolo della scheda sheet (con la cima a top)
export function drawSites(ui, { width, padding, titleY }, top) {
  const right = (ui.scale.width + width) / 2 - padding;
  ui.add.text(right, top + titleY, sitesText(ui.save.profile), HUD.world.textStyle).setOrigin(1, 0.5);
}
