import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { now } from '../core/clock.js';
import { WORLD_EVENTS } from '../core/events.js';
import { saveWarnings } from '../core/save.js';
import { canUpgrade, firstSite, nextGoal } from '../meta/village.js';
import { amountText } from '../view/words.js';
import { goalText, rewardText } from '../view/worldWords.js';
import { createButtonBoard } from './buttons.js';
import { drawBuildMenu, drawBuildingSheet, drawRoadSheet } from './worldSheets.js';

// L'interfaccia del mondo, ferma sopra la vista (scenes/World.js), in grigio. In alto le risorse, con l'ingranaggio che
// apre le impostazioni (le apre il mondo, SETTINGS_REQUESTED), e, appena conquistata un'area, la notizia con il suo
// premio, e sotto gli avvisi del salvataggio (rovinato, più nuovo, che non si scrive), uno alla volta, ognuno finché
// non lo si è visto chiudersi una volta per partita (la battaglia non li dà mai); in basso il prossimo obiettivo
// (toccandolo si va all'edificio o lo si comincia a mettere), Eroi, Costruisci (un menu, non un modo: i posti cantiere
// occupati e gli edifici da mettere, con cosa danno e quanto costano) e Strada (la vista va dal capo e la casella da
// toccare si accende, senza schede). Toccando un edificio nel mondo si apre la sua scheda: livello e posti cantiere
// occupati, cosa dà ora e al prossimo livello, il costo e Migliora, o il suo cantiere con quanto manca, la sfida (una
// per cantiere) e l'acceleratore; la fattoria ha le razioni pronte e Raccogli; Sposta e Chiudi. Toccando la strada
// fuori dalla casella da toccare (anche il capo, se non ci sta sopra) o l'area da conquistare si apre la sua: l'area e
// dove si è, la prossima casella, il premio della conquista, le razioni (con Raccogli se non bastano e la fattoria ne
// ha), cosa toccare per andare avanti e Chiudi. Mentre si mette un edificio dice cosa fare. Parla con il mondo sul suo
// bus (WORLD_EVENTS); i cambi li fanno le azioni del meta-gioco (meta/actions.js), e dopo ognuna il mondo dice a tutti
// di ridisegnarsi. I suoi pulsanti non sono oggetti interattivi, così il mondo sotto riceve tutti i tocchi che cadono
// fuori (covers). Le schede sono in scenes/worldSheets.js, le scritte in view/worldWords.js
export class WorldUIScene extends Phaser.Scene {
  constructor() {
    super('WorldUI');
  }

  // conquest: l'area appena conquistata (di ritorno dalla battaglia del suo boss), o null
  init({ bus, conquest = null }) {
    this.bus = bus;
    this.sheet = null;
    this.news = conquest;
  }

  create() {
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.board = createButtonBoard(this);
    this.placing = null;
    this.notice = null;
    const on = (name, handler) => this.bus.on(name, handler);
    on(WORLD_EVENTS.WORLD_CHANGED, () => {
      this.nextNotice();
      this.redraw();
    });
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
    this.nextNotice();
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

  // Se non se ne vede già uno, il primo avviso del salvataggio (core/save.js saveWarnings) non ancora dato in questa
  // partita (registry saveNoticesGiven); si chiude da solo o toccandolo, e allora viene il prossimo
  nextNotice() {
    if (this.notice !== null) return;
    const given = this.registry.get('saveNoticesGiven') ?? [];
    const notice = saveWarnings(this.save).find((id) => !given.includes(id));
    if (notice === undefined) return;
    this.notice = notice;
    this.noticeTimer = this.time.delayedCall(HUD.world.noticeMs, () => this.hideNotice());
  }

  // L'avviso è dato quando si chiude: lasciando il mondo prima, nel prossimo mondo torna
  hideNotice() {
    this.noticeTimer.remove();
    this.registry.set('saveNoticesGiven', [...(this.registry.get('saveNoticesGiven') ?? []), this.notice]);
    this.notice = null;
    this.nextNotice();
    this.redraw();
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    this.board.clear();
    // Le scritte da rifare a ogni secondo, con come si rifanno
    this.timed = [];
    this.drawTop();
    this.drawButtons();
    this.drawBanners();
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

  // Le risorse, in alto su due righe, e l'ingranaggio delle impostazioni a un lato: le righe, al centro, se troppo
  // larghe si stringono per non arrivarci
  drawTop() {
    const { top, resourcesY, lineGap, resourceLines, separator, resourcesStyle } = HUD.world;
    const { width } = this.scale;
    this.add.rectangle(0, 0, width, top.height, top.color, top.alpha).setOrigin(0);
    this.board.block({ x: width / 2, y: top.height / 2, width, height: top.height });
    const { resources } = this.save.profile;
    const gear = HUD.settingsGear;
    const room = width - 2 * (Math.min(gear.x, width - gear.x) + HUD.buttons.radius + gear.textGap);
    const line = (y, parts) => {
      const text = this.add.text(width / 2, y, parts.join(separator), resourcesStyle).setOrigin(0.5);
      text.setScale(Math.min(1, room / text.width));
    };
    resourceLines.forEach((kinds, index) => {
      line(resourcesY + index * lineGap, kinds.map((kind) => amountText(kind, resources[kind])));
    });
    this.board.gear({ x: gear.x, y: gear.y, onTap: () => this.bus.emit(WORLD_EVENTS.SETTINGS_REQUESTED) });
  }

  // Eroi, Costruisci e Strada, nella loro fascia; Costruisci apre e chiude il menu, Strada chiude le schede, porta dal
  // capo e accende la casella da toccare
  drawButtons() {
    const { heroesButton, buildButton, roadButton, bottomBand, labels } = HUD.world;
    const { width, height } = this.scale;
    this.board.block({ x: width / 2, y: (bottomBand + height) / 2, width, height: height - bottomBand });
    const quiet = HUD.menu.quietButtonColor;
    const color = HUD.menu.buttonColor;
    const heroes = () => this.bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'Heroes', data: { from: 'World' } });
    this.board.add({ ...heroesButton, label: labels.heroes, color: quiet, onTap: heroes });
    const toggle = () => this.open(this.sheet?.kind === 'menu' ? null : { kind: 'menu' });
    const enabled = this.placing === null;
    this.board.add({ ...buildButton, label: labels.build, color: quiet, enabled, onTap: toggle });
    const road = () => {
      this.open(null);
      this.bus.emit(WORLD_EVENTS.PAWN_FOCUS_REQUESTED);
    };
    this.board.add({ ...roadButton, label: labels.road, color, enabled, onTap: road });
  }

  // La notizia e, sotto, l'avviso del salvataggio, ognuno nel suo riquadro
  drawBanners() {
    const { news: box, saveNotices } = HUD.world;
    let top = box.y;
    if (this.news !== null) top = this.drawNews(top) + box.gap + box.padding;
    if (this.notice !== null) this.drawBanner(saveNotices[this.notice], top, () => this.hideNotice());
  }

  // L'area appena conquistata, il suo premio e il terreno in più, su tre righe nel riquadro delle notizie, la prima a
  // top; toccandolo si chiude. Restituisce dove finisce il riquadro
  drawNews(top) {
    const { road: labels, separator } = HUD.world;
    const reward = rewardText(this.news.reward).join(separator);
    const lines = [`${labels.area} ${this.news.area + 1} ${labels.conquered}`, reward, labels.space].join('\n');
    return this.drawBanner(lines, top, () => this.hideNews());
  }

  // Il riquadro delle notizie sotto le risorse (HUD.world.news) con le righe lines, la prima a top; toccandolo si fa
  // onTap. Restituisce dove finisce
  drawBanner(lines, top, onTap) {
    const { news: box, newsStyle } = HUD.world;
    const { width } = this.scale;
    const graphics = this.add.graphics();
    const text = this.add.text(width / 2, top, lines, newsStyle).setOrigin(0.5, 0);
    const height = text.height + box.padding * 2;
    const left = (width - box.width) / 2;
    graphics.fillStyle(box.color, box.alpha);
    graphics.fillRoundedRect(left, top - box.padding, box.width, height, box.radius);
    graphics.lineStyle(box.borderWidth, box.border);
    graphics.strokeRoundedRect(left, top - box.padding, box.width, height, box.radius);
    this.board.area({ x: width / 2, y: top - box.padding + height / 2, width: box.width, height, onTap });
    return top - box.padding + height;
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

  // Il prossimo obiettivo: toccandolo si va all'edificio da migliorare o al cantiere che finisce per primo (con la sua
  // scheda), o si comincia a mettere quello da costruire (se si può pagare; se no si apre il menu)
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
    const goal = () => goalText(this.save.profile, now());
    const line = this.add.text(left + box.padding, box.y, goal(), goalStyle).setOrigin(0, 0.5);
    this.timed.push({ text: line, make: goal });
    this.board.area({ x: width / 2, y: box.y, width: box.width, height: box.height, onTap: () => this.goToGoal() });
  }

  goToGoal() {
    const { profile } = this.save;
    const id = nextGoal(profile)?.building ?? firstSite(profile)?.building ?? null;
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
