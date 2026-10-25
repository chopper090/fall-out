import * as Phaser from 'phaser';
import { HUD, POWER } from '../config/balance.js';
import { writeSave } from '../core/save.js';
import { MAP } from '../data/map.js';
import { VILLAGE } from '../data/village.js';
import { levelOf } from '../meta/heroes.js';
import { loadoutFrom } from '../meta/loadout.js';
import { chapterOf } from '../meta/map.js';
import { canChallenge, settle, startChallenge } from '../meta/village.js';
import { armyPower, difficulty, levelPower } from '../systems/power.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { decimalText } from '../view/words.js';
import { addButton } from './buttons.js';

// Schermata prima della battaglia, in grigio, per la battaglia di una casella della mappa (mode map, tile: la
// casella) o per la sfida di un cantiere del villaggio (mode challenge, data/village.js). In alto il titolo e le regole
// della battaglia (quanto sono duri i nemici; per la sfida cosa dà); gli eroi dello schieramento del profilo, in
// ordine di posto, con nome, livello e stelle; la nostra potenza (con livelli, stelle e villaggio) e quella del
// livello con quelle regole, la fascia di difficoltà del loro rapporto con la sua barra colorata, le statistiche del
// salvataggio; Mappa o Villaggio tornano indietro, Eroi apre la schermata degli eroi, Parti la battaglia. Se intanto
// la battaglia non c'è più (cantiere finito, casella già vinta) si torna indietro
export class LineupScene extends Phaser.Scene {
  constructor() {
    super('Lineup');
  }

  init(data) {
    this.mode = data?.mode;
    this.tile = data?.tile ?? null;
  }

  create() {
    createPawnAtlas(this.textures);
    const save = this.registry.get('save');
    const { profile } = save;
    settle(profile, Date.now());
    const rules = this.rules(profile);
    if (rules === null) {
      this.scene.start(this.mode === 'map' ? 'Map' : 'Village');
      return;
    }
    const { width } = this.scale;
    const { titleY, labels } = HUD.lineup;
    this.add.text(width / 2, titleY, this.title(profile), HUD.lineup.titleStyle).setOrigin(0.5);
    this.drawRules(rules);

    const loadout = loadoutFrom(profile, rules);
    this.drawHeroes(loadout, profile);
    const ours = armyPower(loadout);
    const theirs = levelPower(rules);
    const ratio = ours / theirs;
    const band = difficulty(ratio);
    const { powerY, powerLabel, levelLabel, bandY, powerStyle, bandStyle } = HUD.lineup;
    const line = `${powerLabel} ${Math.round(ours)}   ${levelLabel} ${Math.round(theirs)}`;
    this.add.text(width / 2, powerY, line, powerStyle).setOrigin(0.5);
    const bandColor = Phaser.Display.Color.IntegerToColor(band.color).rgba;
    this.add.text(width / 2, bandY, band.label, bandStyle).setOrigin(0.5).setColor(bandColor);
    this.drawGauge(ratio);
    this.drawStats(profile.stats);

    const { backButton, heroesButton, startButton } = HUD.lineup;
    const map = this.mode === 'map';
    const back = () => this.scene.start(map ? 'Map' : 'Village');
    const fromData = { mode: this.mode, tile: this.tile };
    const openHeroes = () => this.scene.start('Heroes', { from: 'Lineup', fromData });
    const start = () => this.start(save, rules);
    const quiet = HUD.menu.quietButtonColor;
    addButton(this, { ...backButton, label: map ? labels.map : labels.village, color: quiet, onTap: back });
    addButton(this, { ...heroesButton, label: labels.heroes, color: quiet, onTap: openHeroes });
    addButton(this, { ...startButton, label: labels.start, color: HUD.menu.buttonColor, onTap: start });
  }

  // Le regole della battaglia, o null se non c'è più: la casella dove si è, da vincere, o la sfida del cantiere aperto
  rules(profile) {
    if (this.mode === 'challenge') return canChallenge(profile, Date.now()) ? VILLAGE.challenge.rules : null;
    if (this.mode !== 'map') return null;
    const { position, cleared } = profile.map;
    if (this.tile !== position || cleared.includes(position)) return null;
    return chapterOf(profile)[position].rules ?? null;
  }

  // Sfida, Boss, o la casella con la sua riga
  title(profile) {
    const { challengeTitle, tileTitle, of, bossTitle } = HUD.lineup;
    if (this.mode === 'challenge') return challengeTitle;
    const node = chapterOf(profile)[this.tile];
    return node.kind === 'boss' ? bossTitle : `${tileTitle} ${node.row} ${of} ${MAP.rows}`;
  }

  // La battaglia parte con questo schieramento, costruito a ogni partenza (ricominciando prende i numeri di adesso,
  // anche gli edifici finiti nel frattempo);
  // il meta-gioco sa che battaglia è (battleContext: tipo, dove tornare, la casella). La sfida si spende qui: se
  // intanto non si può più, si torna al villaggio
  start(save, rules) {
    if (this.mode === 'challenge') {
      settle(save.profile, Date.now());
      if (!startChallenge(save.profile, Date.now())) {
        this.scene.start('Village');
        return;
      }
      writeSave(save);
    }
    const map = this.mode === 'map';
    this.registry.set('battleContext', { kind: this.mode, returnTo: map ? 'Map' : 'Village', tile: this.tile });
    const makeLoadout = () => {
      const { profile } = this.registry.get('save');
      settle(profile, Date.now());
      return loadoutFrom(profile, rules);
    };
    this.scene.start('Battle', { loadout: makeLoadout });
  }

  // Le regole della battaglia, una per riga: la vita dei nemici e, nella sfida, cosa dà vincerla
  drawRules({ enemyHpScale }) {
    const { rulesY, rulesGap, rulesStyle, ruleLabels } = HUD.lineup;
    const lines = [enemyHpScale > 1 ? `${ruleLabels.enemyHp} ×${decimalText(enemyHpScale)}` : ruleLabels.normal];
    if (this.mode === 'challenge') lines.push(`${ruleLabels.prize} −${Math.round(VILLAGE.challenge.timeShare * 100)}%`);
    lines.forEach((text, index) => {
      this.add.text(this.scale.width / 2, rulesY + index * rulesGap, text, rulesStyle).setOrigin(0.5);
    });
  }

  // Gli eroi in campo, in ordine di posto, stretti in modo che stiano tutti in rowWidth
  drawHeroes(loadout, profile) {
    const { width } = this.scale;
    const { heroY, heroScale, nameOffsetY, roleOffsetY, nameStyle, roleStyle, rowWidth, labels } = HUD.lineup;
    const columnWidth = Math.min(HUD.lineup.columnWidth, rowWidth / loadout.heroes.length);
    const scale = (heroScale * columnWidth) / HUD.lineup.columnWidth;
    const left = width / 2 - ((loadout.heroes.length - 1) * columnWidth) / 2;
    // Le scritte più larghe della colonna si stringono
    const fit = (text) => text.setScale(Math.min(1, (columnWidth - HUD.lineup.textGap) / text.width));
    loadout.heroes.forEach(({ hero }, index) => {
      const x = left + index * columnWidth;
      const record = profile.heroes[hero.id];
      const progress = `${labels.level} ${levelOf(record.xp).level} · ${HUD.heroes.stars.on.repeat(record.stars)}`;
      this.add.image(x, heroY, PAWN_ATLAS, heroFrame(hero)).setScale(scale);
      fit(this.add.text(x, heroY + nameOffsetY, hero.name, nameStyle).setOrigin(0.5));
      fit(this.add.text(x, heroY + roleOffsetY, progress, roleStyle).setOrigin(0.5));
    });
  }

  // Battaglie finite, vinte, distanza più lunga e com'è andata l'ultima; niente prima della prima battaglia finita
  drawStats({ played, won, bestDistance, last }) {
    if (played === 0) return;
    const { statsY, lastY, statsLabels: labels, statsStyle } = HUD.lineup;
    const meters = (distance) => `${Math.floor(distance / HUD.gameOver.unitsPerMeter)} m`;
    const x = this.scale.width / 2;
    const totals = `${labels.played} ${played} · ${labels.won} ${won} · ${labels.best} ${meters(bestDistance)}`;
    this.add.text(x, statsY, totals, statsStyle).setOrigin(0.5);
    if (last === null) return;
    let outcome = labels.completed;
    if (!last.completed) outcome = last.boss ? labels.failedBoss : `${labels.failedAt} ${last.wave}`;
    this.add.text(x, lastY, `${labels.last} ${outcome}, ${meters(last.distance)}`, statsStyle).setOrigin(0.5);
  }

  // Le fasce da proibitiva (a sinistra) a facile, ognuna dal suo rapporto from a quello della fascia subito più
  // facile (facile fino a gauge.max); sopra, il segno sul nostro rapporto. Fuori da gauge.min e gauge.max il segno
  // resta sul bordo
  drawGauge(ratio) {
    const { y, width, height, min, max, marker } = HUD.lineup.gauge;
    const left = this.scale.width / 2 - width / 2;
    const xOf = (value) => left + (width * (Math.min(max, Math.max(min, value)) - min)) / (max - min);
    const graphics = this.add.graphics();
    POWER.bands.forEach((band, index) => {
      const upper = index === 0 ? max : POWER.bands[index - 1].from;
      graphics.fillStyle(band.color);
      graphics.fillRect(xOf(band.from), y - height / 2, xOf(upper) - xOf(band.from), height);
    });
    graphics.fillStyle(marker.color);
    graphics.fillRect(xOf(ratio) - marker.width / 2, y - marker.height / 2, marker.width, marker.height);
  }
}
