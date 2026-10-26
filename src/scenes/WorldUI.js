import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { WORLD_EVENTS } from '../core/events.js';
import { writeSave } from '../core/save.js';
import { canUpgrade, nextGoal } from '../meta/village.js';
import { amountText } from '../view/words.js';
import { goalText, rewardText } from '../view/worldWords.js';
import { createButtonBoard } from './buttons.js';
import { drawBuildMenu, drawBuildingSheet, drawRoadSheet } from './worldSheets.js';

// L'interfaccia del mondo, ferma sopra la vista (scenes/World.js), in grigio. In alto le risorse e, appena conquistata
// un'area, la notizia con il suo premio; in basso il prossimo obiettivo (toccandolo si va all'edificio o lo si comincia
// a mettere) ed Eroi, Costruisci (il menu degli edifici da mettere, con cosa danno e quanto costano) ed Esplora (la
// vista va dal capo e si apre la scheda della strada). Toccando un edificio nel mondo si apre la sua scheda: livello,
// cosa dà ora e al prossimo livello, il costo e Migliora, o il cantiere aperto con quanto manca, la sfida (una per
// cantiere) e l'acceleratore; la fattoria ha le razioni pronte e Raccogli; Sposta e Chiudi. Toccando la strada si apre
// la sua: l'area da conquistare e dove si è, la prossima casella, il premio della conquista, le razioni, Avanza (o
// Combatti, sulla battaglia da vincere) e Chiudi. Mentre si mette un edificio dice cosa fare. Parla con il mondo sul
// suo bus (WORLD_EVENTS); i suoi pulsanti non sono oggetti interattivi, così il mondo sotto riceve tutti i tocchi che
// cadono fuori (covers). Le schede sono in scenes/worldSheets.js, le scritte in view/worldWords.js
export class WorldUIScene extends Phaser.Scene {
  constructor() {
    super('WorldUI');
  }

  // road: si apre subito la scheda della strada (di ritorno da una sua battaglia); conquest: l'area appena conquistata
  init({ bus, road = false, conquest = null }) {
    this.bus = bus;
    this.sheet = road ? { kind: 'road' } : null;
    this.news = conquest;
  }

  create() {
    this.save = this.registry.get('save');
    this.board = createButtonBoard(this);
    this.placing = null;
    const on = (name, handler) => this.bus.on(name, handler);
    on(WORLD_EVENTS.WORLD_CHANGED, () => this.redraw());
    on(WORLD_EVENTS.TICK, () => this.refreshTimed());
    on(WORLD_EVENTS.BUILDING_TAPPED, ({ id }) => this.open({ kind: 'building', id }));
    on(WORLD_EVENTS.GROUND_TAPPED, () => this.open(null));
    on(WORLD_EVENTS.ROAD_TAPPED, () => this.open({ kind: 'road' }));
    on(WORLD_EVENTS.PLACEMENT_STARTED, ({ moving }) => {
      this.placing = moving ? 'move' : 'place';
      this.open(null);
    });
    on(WORLD_EVENTS.PLACEMENT_ENDED, () => {
      this.placing = null;
      this.redraw();
    });
    if (this.news !== null) this.time.delayedCall(HUD.world.newsMs, () => this.hideNews());
    this.redraw();
  }

  // Il punto dello schermo cade sull'interfaccia: il mondo lo lascia stare
  covers(x, y) {
    return this.board?.covers(x, y) ?? false;
  }

  // Apre una scheda (sheet: { kind: 'building', id }, { kind: 'menu' } o { kind: 'road' }), o nessuna (null)
  open(sheet) {
    this.sheet = sheet;
    this.redraw();
  }

  hideNews() {
    this.news = null;
    this.redraw();
  }

  // Dopo ogni cambio del salvataggio, il mondo e l'interfaccia si ridisegnano
  changed() {
    writeSave(this.save);
    this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    this.board.clear();
    // Le scritte da rifare a ogni secondo, con come si rifanno
    this.timed = [];
    this.drawTop();
    this.drawButtons();
    if (this.news !== null) this.drawNews();
    const kind = this.sheet?.kind ?? null;
    if (this.placing !== null) this.drawHint();
    else if (kind === 'building') drawBuildingSheet(this, this.sheet.id);
    else if (kind === 'menu') drawBuildMenu(this);
    else if (kind === 'road') drawRoadSheet(this);
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

  // Eroi, Costruisci ed Esplora, nella loro fascia; Costruisci apre e chiude il menu, Esplora porta dal capo con la
  // scheda della strada
  drawButtons() {
    const { heroesButton, buildButton, exploreButton, bottomBand, labels } = HUD.world;
    const { width, height } = this.scale;
    this.board.block({ x: width / 2, y: (bottomBand + height) / 2, width, height: height - bottomBand });
    const quiet = HUD.menu.quietButtonColor;
    const color = HUD.menu.buttonColor;
    const heroes = () => this.bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'Heroes', data: { from: 'World' } });
    this.board.add({ ...heroesButton, label: labels.heroes, color: quiet, onTap: heroes });
    const toggle = () => this.open(this.sheet?.kind === 'menu' ? null : { kind: 'menu' });
    const enabled = this.placing === null;
    this.board.add({ ...buildButton, label: labels.build, color: quiet, enabled, onTap: toggle });
    const explore = () => {
      this.bus.emit(WORLD_EVENTS.PAWN_FOCUS_REQUESTED);
      this.open({ kind: 'road' });
    };
    this.board.add({ ...exploreButton, label: labels.explore, color, enabled, onTap: explore });
  }

  // L'area appena conquistata, il suo premio e il terreno in più, su tre righe in un riquadro sotto le risorse;
  // toccandolo si chiude
  drawNews() {
    const { news: box, newsStyle, road: labels, separator } = HUD.world;
    const { width } = this.scale;
    const reward = rewardText(this.news.reward).join(separator);
    const lines = [`${labels.area} ${this.news.area + 1} ${labels.conquered}`, reward, labels.space].join('\n');
    const graphics = this.add.graphics();
    const text = this.add.text(width / 2, box.y, lines, newsStyle).setOrigin(0.5, 0);
    const height = text.height + box.padding * 2;
    const left = (width - box.width) / 2;
    graphics.fillStyle(box.color, box.alpha);
    graphics.fillRoundedRect(left, box.y - box.padding, box.width, height, box.radius);
    graphics.lineStyle(box.borderWidth, box.border);
    graphics.strokeRoundedRect(left, box.y - box.padding, box.width, height, box.radius);
    const area = { x: width / 2, y: box.y - box.padding + height / 2, width: box.width, height };
    this.board.area({ ...area, onTap: () => this.hideNews() });
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
    const goal = () => goalText(this.save.profile, Date.now());
    const line = this.add.text(left + box.padding, box.y, goal(), goalStyle).setOrigin(0, 0.5);
    this.timed.push({ text: line, make: goal });
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
      this.open({ kind: 'building', id });
    } else if (canUpgrade(profile, id)) {
      this.bus.emit(WORLD_EVENTS.PLACE_REQUESTED, { id });
    } else {
      this.open({ kind: 'menu' });
    }
  }
}
