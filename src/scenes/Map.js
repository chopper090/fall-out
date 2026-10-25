import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { refreshSave, writeSave } from '../core/save.js';
import { HEROES } from '../data/heroes.js';
import { MAP } from '../data/map.js';
import { chapterDone, chapterOf, ensureChapter, nextChapter, reachable, step, visibility } from '../meta/map.js';
import { nextRationIn, settle } from '../meta/village.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { amountText, decimalText, durationText } from '../view/words.js';
import { addButton } from './buttons.js';

const TAP = Phaser.Input.Events.GAMEOBJECT_POINTER_UP;

// La mappa del capitolo, in grigio, dalla partenza in basso al boss in alto (meta/map.js). Si vedono le caselle già
// fatte, quelle a un passo con il loro tipo, quelle a due senza tipo (nebbia) e il boss, la meta; le altre sono
// puntini, senza tipo né strade; il capo sta sulla casella dove si è. Si tocca una casella a un passo per sceglierla
// (la riga in alto dice cosa c'è e quanto costa), poi Vai: il passo costa le razioni. Un premio si prende subito; una
// battaglia porta allo schieramento, e finché non è vinta si resta lì (Combatti la riprova, senza pagare). Senza
// razioni la riga dice quando la fattoria ne avrà. Battuto il boss, Capitolo nuovo. In fondo Villaggio ed Eroi. Ogni
// passo si salva subito
export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create() {
    createPawnAtlas(this.textures);
    this.save = this.registry.get('save');
    refreshSave(this.save);
    ensureChapter(this.save.profile, Date.now());
    writeSave(this.save);
    this.selected = null;
    this.message = '';
    this.redraw();
    this.time.addEvent({ delay: HUD.map.tickMs, loop: true, callback: () => this.tick() });
  }

  // Il tempo scorre anche qui: la fattoria produce e la riga delle razioni si aggiorna
  tick() {
    settle(this.save.profile, Date.now());
    this.rationsLine.setText(this.rationsText());
  }

  redraw() {
    const { profile } = this.save;
    settle(profile, Date.now());
    this.children.removeAll(true);
    const layout = HUD.map;
    const x = this.scale.width / 2;
    const title = `${layout.labels.chapter} ${profile.map.chapter}`;
    this.add.text(x, layout.titleY, title, layout.titleStyle).setOrigin(0.5);
    this.rationsLine = this.add.text(x, layout.rationsY, this.rationsText(), layout.textStyle).setOrigin(0.5);
    this.add.text(x, layout.infoY, this.infoText(), layout.infoStyle).setOrigin(0.5);
    this.drawMap();
    this.drawButtons();
  }

  // Razioni e costo del passo; senza razioni, dove trovarle
  rationsText() {
    const { profile } = this.save;
    const { labels } = HUD.map;
    const { rations } = profile.resources;
    const line = `${amountText('rations', rations)} · ${labels.step} ${amountText('rations', MAP.stepCost)}`;
    if (rations >= MAP.stepCost) return line;
    if (profile.village.levels.farm === 0) return `${line} · ${labels.buildFarm}`;
    if (profile.village.farm.stored >= 1) return `${line} · ${labels.collect}`;
    return `${line} · ${labels.nextRation} ${durationText(nextRationIn(profile))}`;
  }

  // Cosa fare adesso: capitolo finito, battaglia da vincere, il premio appena preso, la casella scelta o sceglierne una
  infoText() {
    const { profile } = this.save;
    const { labels } = HUD.map;
    if (chapterDone(profile)) return labels.chapterDone;
    const nodes = chapterOf(profile);
    const here = nodes[profile.map.position];
    if (!profile.map.cleared.includes(here.id)) return `${tileText(here)} · ${labels.winToGo}`;
    const cost = `${labels.step} ${amountText('rations', MAP.stepCost)}`;
    if (this.selected !== null) return `${tileText(nodes[this.selected])} · ${cost}`;
    return this.message !== '' ? this.message : labels.pick;
  }

  // Le strade e le caselle che si vedono; il capo sulla casella dove si è; le caselle a un passo si toccano
  drawMap() {
    const { profile } = this.save;
    const { node: style, path } = HUD.map;
    const nodes = chapterOf(profile);
    const seen = nodes.filter((node) => visibility(profile, node.id) !== 'hidden');
    const graphics = this.add.graphics();
    for (const node of seen) {
      for (const id of node.next) {
        if (visibility(profile, id) === 'hidden') continue;
        const walked = profile.map.visited.includes(node.id) && profile.map.visited.includes(id);
        graphics.lineStyle(path.width, walked ? path.walked : path.color, walked ? 1 : path.alpha);
        const [x0, y0] = this.place(node);
        const [x1, y1] = this.place(nodes[id]);
        graphics.lineBetween(x0, y0, x1, y1);
      }
    }
    const near = reachable(profile);
    const { hidden } = HUD.map;
    graphics.fillStyle(hidden.color, hidden.alpha);
    for (const node of nodes.filter((other) => visibility(profile, other.id) === 'hidden')) {
      const [x, y] = this.place(node);
      graphics.fillCircle(x, y, hidden.radius);
    }
    for (const node of seen) this.drawNode(graphics, node, near.includes(node.id));
    const [hx, hy] = this.place(nodes[profile.map.position]);
    this.add.image(hx, hy + style.pawnY, PAWN_ATLAS, heroFrame(HEROES.leader)).setScale(style.pawnScale);
  }

  // Una casella: forma e colore del suo tipo (nella nebbia un cerchio con il punto di domanda), il nome accanto se è
  // quella scelta (con l'anello) o il boss; quelle a un passo si toccano per sceglierle, in una zona tapWidth ×
  // tapHeight
  drawNode(graphics, node, near) {
    const { profile } = this.save;
    const { node: style, kinds, labels } = HUD.map;
    const [x, y] = this.place(node);
    const fog = visibility(profile, node.id) === 'fog';
    const kind = kinds[fog ? 'fog' : node.kind];
    const radius = node.kind === 'boss' && !fog ? style.bossRadius : style.radius;
    const done = profile.map.cleared.includes(node.id) && node.id !== profile.map.position;
    graphics.fillStyle(kind.color, done ? style.doneAlpha : 1);
    if (kind.shape === 'square') graphics.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    else if (kind.shape === 'diamond') graphics.fillPoints(diamond(x, y, radius), true);
    else if (kind.shape === 'triangle') {
      graphics.fillTriangle(x, y - radius, x + radius, y + radius, x - radius, y + radius);
    }
    else graphics.fillCircle(x, y, radius);
    if (kind.mark) this.add.text(x, y, kind.mark, style.markStyle).setOrigin(0.5);
    if (this.selected === node.id) {
      graphics.lineStyle(style.ringWidth, style.ring);
      graphics.strokeCircle(x, y, radius + style.ringGap);
    }
    if (!fog && (this.selected === node.id || node.kind === 'boss')) {
      this.add.text(x + radius + style.labelGap, y, labels.kinds[node.kind], style.labelStyle).setOrigin(0, 0.5);
    }
    if (!near) return;
    this.add.zone(x, y, style.tapWidth, style.tapHeight).setInteractive().on(TAP, () => this.choose(node.id));
  }

  // Villaggio, Eroi e il pulsante di quello che si può fare: Vai (con una casella scelta), Combatti (battaglia da
  // vincere), Capitolo nuovo (boss battuto)
  drawButtons() {
    const { profile } = this.save;
    const { villageButton, heroesButton, actionButton, labels } = HUD.map;
    const quiet = HUD.menu.quietButtonColor;
    const openVillage = () => this.scene.start('Village');
    addButton(this, { ...villageButton, label: labels.village, color: quiet, onTap: openVillage });
    const openHeroes = () => this.scene.start('Heroes', { from: 'Map' });
    addButton(this, { ...heroesButton, label: labels.heroes, color: quiet, onTap: openHeroes });
    const color = HUD.menu.buttonColor;
    const { position, cleared } = profile.map;
    if (chapterDone(profile)) {
      addButton(this, { ...actionButton, label: labels.newChapter, color, onTap: () => this.newChapter() });
    } else if (!cleared.includes(position)) {
      addButton(this, { ...actionButton, label: labels.fight, color, onTap: () => this.fight(position) });
    } else if (this.selected !== null) {
      const enabled = profile.resources.rations >= MAP.stepCost;
      addButton(this, { ...actionButton, label: labels.go, color, enabled, onTap: () => this.go() });
    }
  }

  choose(id) {
    this.selected = this.selected === id ? null : id;
    this.message = '';
    this.redraw();
  }

  // Il passo verso la casella scelta: un premio si prende e si resta sulla mappa, una battaglia si combatte subito
  go() {
    const result = step(this.save.profile, this.selected);
    if (result === null) return;
    writeSave(this.save);
    this.selected = null;
    if (result.battle) {
      this.fight(result.node.id);
      return;
    }
    this.message = `${HUD.map.labels.found}: ${gainText(result.gain)}`;
    this.redraw();
  }

  fight(id) {
    this.scene.start('Lineup', { mode: 'map', tile: id });
  }

  newChapter() {
    nextChapter(this.save.profile, Date.now());
    writeSave(this.save);
    this.message = '';
    this.redraw();
  }

  // Dove sta la casella sullo schermo: le righe dal basso (partenza) all'alto (boss)
  place(node) {
    const { left, width, bottomY, topY } = HUD.map.area;
    return [left + node.x * width, bottomY - ((bottomY - topY) * node.row) / MAP.rows];
  }
}

// Cosa c'è nella casella, da mostrare prima del passo: la battaglia con quanto sono duri i nemici, il premio con
// quanto vale (l'evento è una sorpresa)
function tileText(node) {
  const { labels } = HUD.map;
  const name = labels.kinds[node.kind];
  if (node.rules) return `${name} · ${labels.enemyHp} ×${decimalText(node.rules.enemyHpScale)}`;
  if (node.kind === 'event') return name;
  if (node.kind === 'fragments') return `${name} · +${node.amount} ${labels.forAHero}`;
  return `${name} · ${amountText(node.kind, node.amount, '+')}`;
}

function gainText({ kind, amount, hero }) {
  const { labels } = HUD.map;
  if (kind === 'fragments') return `${amountText(kind, amount, '+')} (${HEROES[hero].name})`;
  if (kind === 'xp') return `${amountText(kind, amount, '+')} ${labels.toHeroes}`;
  return amountText(kind, amount, '+');
}

function diamond(x, y, radius) {
  return [
    { x, y: y - radius },
    { x: x + radius, y },
    { x, y: y + radius },
    { x: x - radius, y },
  ];
}
