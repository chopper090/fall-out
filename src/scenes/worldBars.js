import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { WORLD_EVENTS } from '../core/events.js';
import { MINUS, percentText } from '../core/format.js';
import { minutesToMs } from '../core/time.js';
import { RECRUIT } from '../data/growth.js';
import { VILLAGE } from '../data/village.js';
import { claimableMissions } from '../meta/daily.js';
import { starCost } from '../meta/heroes.js';
import { canChallenge, canUpgrade, freeSlots, nextGoal, siteOf, upgradeCost } from '../meta/village.js';
import { drawIcon } from '../view/icons.js';
import { BUILDING_ATLAS } from '../view/worldAtlas.js';
import { amountText, durationText } from '../view/words.js';
import { costText, effectText, lockText, timeLeftText } from '../view/worldWords.js';
import { drawSheet, drawSites } from './worldSheets.js';

// Le barre a icone dell'interfaccia del mondo (scenes/WorldUI.js), con le icone provvisorie (view/icons.js): in fondo
// la barra con Eroi, Costruisci, Strada, Missioni e Catalogo; sopra, quando servono, la striscia Costruisci, una scheda
// per edificio da mettere, e la barra dell'edificio toccato con al massimo quattro comandi, che lasciano visibile quasi
// tutto il mondo. ui è la scena dell'interfaccia (vedi scenes/worldSheets.js)

// La barra in basso: Eroi; Costruisci, che apre e chiude la striscia (accesa mentre è aperta); Strada, più grande, che
// chiude le schede, porta dal capo e accende la casella da toccare; Missioni (scenes/Daily.js); Catalogo. Il segno "!"
// su Eroi quando si può reclutare o dare una stella, su Costruisci quando un edificio può salire adesso, su Missioni
// quando una missione si può ritirare. Mentre si mette un edificio
// Costruisci e Strada sono spenti
export function drawBottomBar(ui) {
  const { bar } = HUD.world;
  const { width, height } = ui.scale;
  ui.add.rectangle(0, bar.top, width, height - bar.top, bar.color, bar.alpha).setOrigin(0);
  ui.board.block({ x: width / 2, y: (bar.top + height) / 2, width, height: height - bar.top });
  const { profile } = ui.save;
  const free = ui.placing === null;
  const building = ui.sheet?.kind === 'menu';
  const navigate = (scene, data) => () => ui.bus.emit(WORLD_EVENTS.NAVIGATE, { scene, data });
  const road = () => {
    ui.open(null);
    ui.bus.emit(WORLD_EVENTS.PAWN_FOCUS_REQUESTED);
  };
  const toggle = () => ui.open(building ? null : { kind: 'menu' });
  const items = [
    { id: 'heroes', badge: heroesBadge(profile), onTap: navigate('Heroes', { from: 'World' }) },
    { id: 'build', active: building, enabled: free, badge: buildBadge(profile), onTap: toggle },
    { id: 'road', big: true, active: true, enabled: free, onTap: road },
    { id: 'daily', badge: claimableMissions(profile) > 0, onTap: navigate('Daily', {}) },
    { id: 'catalog', onTap: navigate('Catalog', {}) },
  ];
  for (const item of items) drawBarItem(ui, item);
}

// La striscia Costruisci, sopra la barra: il titolo con i posti cantiere occupati e una scheda per edificio ancora
// da mettere (drawBuildCard); senza edifici da mettere, che si migliorano toccandoli nel mondo
export function drawBuildStrip(ui) {
  const { strip, labels, titleStyle, textStyle } = HUD.world;
  const { profile } = ui.save;
  const top = drawSheet(ui, strip, strip.height);
  const left = (ui.scale.width - strip.width) / 2 + strip.padding;
  ui.add.text(left, top + strip.titleY, labels.build, titleStyle).setOrigin(0, 0.5);
  drawSites(ui, strip, top);
  const ids = Object.keys(VILLAGE.buildings).filter((id) => profile.village.positions[id] === null);
  if (ids.length === 0) {
    const empty = ui.add.text(ui.scale.width / 2, top + strip.emptyY, labels.allPlaced, textStyle).setOrigin(0.5);
    empty.setWordWrapWidth(strip.width - strip.padding * 2).setAlign('center');
    return;
  }
  const { card } = strip;
  ids.forEach((id, index) => drawBuildCard(ui, id, left + index * (card.width + card.gap), top + strip.cardsY));
}

// La barra dell'edificio toccato, sopra la barra in basso: il nome e il livello (bordo acceso se è il prossimo
// obiettivo) con i posti cantiere; cosa dà ora, o quanto manca al suo cantiere; il prossimo livello con cosa dà; il
// costo, o cosa lo tiene fermo, o che i posti sono occupati (le righe troppo larghe si stringono). Sotto i comandi a
// icona: fermo Migliora, Raccogli (la
// fattoria) e Info; in cantiere Sfida, Accelera, Raccogli e Info. Si sposta tenendolo premuto, e la barra lo ricorda
export function drawBuildingBar(ui, id) {
  const { buildingBar: layout, labels, titleStyle, textStyle } = HUD.world;
  const { profile } = ui.save;
  const goal = nextGoal(profile)?.building === id;
  const top = drawSheet(ui, layout, layout.height, goal ? layout.goalBorder : layout.border);
  const left = (ui.scale.width - layout.width) / 2 + layout.padding;
  const level = profile.village.levels[id];
  const title = `${VILLAGE.buildings[id].name} · ${labels.level} ${level}`;
  ui.add.text(left, top + layout.titleY, title, titleStyle).setOrigin(0, 0.5);
  drawSites(ui, layout, top);
  const room = layout.width - layout.padding * 2;
  const line = (index, text) => {
    const label = ui.add.text(left, top + layout.lineY[index], text, textStyle).setOrigin(0, 0.5);
    return label.setScale(Math.min(1, room / label.width));
  };
  const site = siteOf(profile, id) !== null;
  const cost = upgradeCost(profile, id);
  const current = () => {
    if (site) return `${labels.inProgress} ${timeLeftText(ui.save.profile, id, now())}`;
    return `${labels.now}: ${effectText(id, level)}`;
  };
  const first = line(0, current());
  if (site) ui.timed.push({ text: first, make: current });
  line(1, cost === null ? labels.max : `${labels.levelLong} ${level + 1}: ${effectText(id, level + 1)}`);
  if (cost !== null && !site) {
    const busy = freeSlots(profile) === 0;
    line(2, lockText(profile, id) ?? (busy ? labels.allBusy : `${labels.cost}: ${costText(cost)}`));
  }
  const commands = site ? siteCommands(ui, id) : idleCommands(ui, id, cost);
  commands.forEach((command, index) => drawCommand(ui, command, layout.buttons.xs[index], top + layout.buttons.y));
  ui.add.text(ui.scale.width / 2, top + layout.hintY, labels.holdToMove, layout.hintStyle).setOrigin(0.5);
}

// Un'icona della barra in basso, al suo posto (HUD.world.bar.items): il cerchio (acceso se active), il disegno e la
// parola, il segno "!" se badge; spenta (enabled false) è più trasparente e non agisce
function drawBarItem(ui, { id, big = false, active = false, enabled = true, badge = false, onTap }) {
  const { bar, labels } = HUD.world;
  const x = bar.items[id];
  const radius = big ? bar.bigRadius : bar.radius;
  const alpha = enabled ? 1 : bar.disabledAlpha;
  const graphics = ui.add.graphics();
  graphics.fillStyle(active ? bar.activeColor : bar.itemColor, alpha);
  graphics.fillCircle(x, bar.y, radius);
  drawIcon(graphics, id, { x, y: bar.y, size: big ? bar.bigIcon : bar.icon, color: bar.iconColor, alpha });
  ui.add.text(x, bar.y + bar.labelY, labels[id], bar.labelStyle).setOrigin(0.5).setAlpha(alpha);
  if (badge) {
    const at = { x: x + radius * bar.badge.at, y: bar.y - radius * bar.badge.at };
    graphics.fillStyle(bar.badge.color);
    graphics.fillCircle(at.x, at.y, bar.badge.radius);
    ui.add.text(at.x, at.y, bar.badge.text, bar.badgeStyle).setOrigin(0.5);
  }
  ui.board.area({ x, y: bar.hitY, width: bar.hitWidth, height: bar.hitHeight, enabled, onTap });
}

// La scheda della striscia per l'edificio id, con l'angolo in alto a sinistra in (left, top): la sua immagine, il
// nome, il costo del primo livello (ogni scorta su una riga, quelle che non bastano in rosso) e i minuti; se il centro
// città lo tiene fermo, l'immagine spenta, il lucchetto e cosa serve. Si può costruire: bordo acceso, e toccandola si
// comincia a metterlo nel mondo
function drawBuildCard(ui, id, left, top) {
  const { card } = HUD.world.strip;
  const { profile } = ui.save;
  const ready = canUpgrade(profile, id);
  const lock = lockText(profile, id);
  const graphics = ui.add.graphics();
  graphics.fillStyle(card.color);
  graphics.fillRoundedRect(left, top, card.width, card.height, card.radius);
  graphics.lineStyle(card.borderWidth, ready ? card.ready : card.border);
  graphics.strokeRoundedRect(left, top, card.width, card.height, card.radius);
  const x = left + card.width / 2;
  const image = ui.add.image(x, top + card.imageY, BUILDING_ATLAS, id).setOrigin(0.5);
  image.setScale(Math.min(card.imageWidth / image.width, card.imageHeight / image.height));
  if (lock !== null) image.setAlpha(card.lockedAlpha);
  const wrap = card.width - card.padding * 2;
  ui.add.text(x, top + card.nameY, VILLAGE.buildings[id].name, card.nameStyle).setOrigin(0.5).setWordWrapWidth(wrap);
  if (lock !== null) {
    drawIcon(graphics, 'lock', { x, y: top + card.lockY, size: card.lockIcon, color: card.lockColor });
    ui.add.text(x, top + card.lockTextY, lock, card.textStyle).setOrigin(0.5, 0).setWordWrapWidth(wrap);
  } else {
    const cost = upgradeCost(profile, id);
    const rows = Object.entries(cost.resources).map(([kind, amount]) => ({
      text: amountText(kind, amount),
      missing: profile.resources[kind] < amount,
    }));
    rows.push({ text: durationText(minutesToMs(cost.minutes)), missing: false });
    rows.forEach((row, index) => {
      const text = ui.add.text(x, top + card.costY + index * card.lineGap, row.text, card.textStyle).setOrigin(0.5);
      if (row.missing) text.setColor(card.missingColor);
    });
  }
  const place = () => ui.bus.emit(WORLD_EVENTS.PLACE_REQUESTED, { id });
  const y = top + card.height / 2;
  ui.board.area({ x, y, width: card.width, height: card.height, enabled: ready, onTap: place });
}

// I comandi dell'edificio id senza cantiere (cost: il costo del prossimo livello, null al massimo): Migliora,
// Raccogli (la fattoria), Info
function idleCommands(ui, id, cost) {
  const { labels } = HUD.world;
  const commands = [];
  if (cost !== null) {
    const enabled = canUpgrade(ui.save.profile, id);
    const upgrade = () => ui.actions.startUpgrade(id);
    commands.push({ icon: 'upgrade', label: labels.upgrade, primary: true, enabled, onTap: upgrade });
  }
  if (id === 'farm') commands.push(collectCommand(ui));
  commands.push(infoCommand(ui, id));
  return commands;
}

// I comandi dell'edificio id con il cantiere aperto: la sua sfida (una per cantiere, solo se manca abbastanza),
// una gemma, Raccogli (la fattoria), Info
function siteCommands(ui, id) {
  const { labels } = HUD.world;
  const { profile } = ui.save;
  const open = canChallenge(profile, id, now());
  let label = `${labels.challenge} ${percentText(VILLAGE.challenge.timeShare, MINUS)}`;
  if (!open) label = siteOf(profile, id).challenged ? labels.challengeUsed : labels.challengeShort;
  const lineup = { scene: 'Lineup', data: { mode: 'challenge', building: id } };
  const challenge = () => ui.bus.emit(WORLD_EVENTS.NAVIGATE, lineup);
  const accelerate = () => ui.actions.useGem(id);
  const commands = [
    { icon: 'challenge', label, primary: true, enabled: open, onTap: challenge },
    {
      icon: 'accelerate',
      label: `${MINUS}${VILLAGE.gemMinutes} ${HUD.units.minute}${HUD.world.separator}${amountText('gems', 1)}`,
      enabled: profile.resources.gems > 0,
      onTap: accelerate,
    },
  ];
  if (id === 'farm') commands.push(collectCommand(ui));
  commands.push(infoCommand(ui, id));
  return commands;
}

// Raccogli le razioni pronte della fattoria, con quante sono
function collectCommand(ui) {
  const ready = Math.floor(ui.save.profile.village.farm.stored);
  const label = `${HUD.world.labels.collect} ${ready}`;
  return { icon: 'collect', label, enabled: ready > 0, onTap: () => ui.actions.collectRations() };
}

// Info: l'edificio id nel Catalogo, con la sua voce in evidenza
function infoCommand(ui, id) {
  const open = () => ui.bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'Catalog', data: { tab: 'buildings', focus: id } });
  return { icon: 'info', label: HUD.world.labels.info, onTap: open };
}

// Un comando a icona con il centro in (x, y): il riquadro (blu se primary), il disegno e la parola sotto; spento
// (enabled false) è più trasparente e non agisce
function drawCommand(ui, { icon, label, primary = false, enabled = true, onTap }, x, y) {
  const { buttons } = HUD.world.buildingBar;
  const alpha = enabled ? 1 : buttons.disabledAlpha;
  const graphics = ui.add.graphics();
  graphics.fillStyle(primary ? HUD.menu.buttonColor : HUD.menu.quietButtonColor, alpha);
  const { width, height, radius } = buttons;
  graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  drawIcon(graphics, icon, { x, y: y + buttons.iconY, size: buttons.icon, color: buttons.iconColor, alpha });
  const text = ui.add.text(x, y + buttons.labelY, label, buttons.labelStyle).setOrigin(0.5).setAlpha(alpha);
  text.setScale(Math.min(1, (width - buttons.labelPadding) / text.width));
  ui.board.area({ x, y, width, height, enabled, onTap });
}

// C'è da fare negli eroi: le piastrine bastano per un tiro, o un eroe posseduto ha i frammenti per una stella
function heroesBadge(profile) {
  const star = Object.values(profile.heroes).some((record) => {
    const need = starCost(record.stars);
    return record.owned && need !== null && record.fragments >= need;
  });
  return star || profile.resources.dogTags >= RECRUIT.cost;
}

// C'è da fare in Costruisci: un edificio può salire adesso (un posto libero, niente che lo tiene fermo, le scorte)
function buildBadge(profile) {
  return Object.keys(VILLAGE.buildings).some((id) => canUpgrade(profile, id));
}
