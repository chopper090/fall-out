import * as Phaser from 'phaser';
import { HUD, POWER, TEST_BATTLE } from '../config/balance.js';
import { now } from '../core/clock.js';
import { decimalText, MINUS, percentText } from '../core/format.js';
import { WORLD } from '../data/world.js';
import { VILLAGE } from '../data/village.js';
import { levelOf } from '../meta/heroes.js';
import { loadoutFrom } from '../meta/loadout.js';
import { ROAD_TILES } from '../meta/road.js';
import { canChallenge } from '../meta/village.js';
import { armyPower, difficulty, levelPower } from '../systems/power.js';
import { battlePlan } from '../systems/waves.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

// Schermata prima della battaglia, in grigio, per la battaglia di una casella della strada (mode road, tile: la
// casella) o per la sfida di un cantiere del villaggio (mode challenge, data/village.js). In alto il titolo e le regole
// della battaglia (l'area della strada, quanto sono duri i nemici; per la sfida cosa dà); gli eroi dello schieramento
// del profilo, in ordine di posto, con nome, livello e stelle; la nostra potenza (con livelli, stelle e villaggio) e
// quella del livello con quelle regole, la fascia di difficoltà del loro rapporto con la sua barra colorata, le
// statistiche del salvataggio; Mondo torna indietro (dalla strada il mondo la riapre), Eroi apre la schermata degli
// eroi, Parti la battaglia; in alto a sinistra l'ingranaggio delle impostazioni. Se intanto la battaglia non c'è più
// (cantiere finito, casella già vinta) si torna al mondo
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
    this.registry.get('actions').settle();
    const { profile } = this.registry.get('save');
    const rules = this.rules(profile);
    if (rules === null) {
      this.leave();
      return;
    }
    const { width } = this.scale;
    const { titleY, labels } = HUD.lineup;
    this.add.text(width / 2, titleY, this.title(), HUD.lineup.titleStyle).setOrigin(0.5);
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
    const back = () => this.leave();
    const fromData = { mode: this.mode, tile: this.tile };
    const openHeroes = () => this.scene.start('Heroes', { from: 'Lineup', fromData });
    const start = () => this.start();
    const quiet = HUD.menu.quietButtonColor;
    addButton(this, { ...backButton, label: labels.back, color: quiet, onTap: back });
    addButton(this, { ...heroesButton, label: labels.heroes, color: quiet, onTap: openHeroes });
    addButton(this, { ...startButton, label: labels.start, color: HUD.menu.buttonColor, onTap: start });
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
  }

  // Le regole della battaglia, o null se non c'è più: la casella dove si è, da vincere, o la sfida del cantiere aperto
  rules(profile) {
    if (this.mode === 'challenge') return canChallenge(profile, now()) ? VILLAGE.challenge.rules : null;
    if (this.mode !== 'road') return null;
    const { at, done } = profile.road;
    if (this.tile !== at || done) return null;
    return ROAD_TILES[at].rules ?? null;
  }

  // Si torna al mondo; da una battaglia della strada il mondo riapre la strada
  leave() {
    if (this.mode === 'road') this.registry.set('worldReturn', { conquest: null });
    this.scene.start('World');
  }

  // Sfida, Boss, o la battaglia con il suo numero tra quelle della sua area
  title() {
    const { challengeTitle, battleTitle, of, bossTitle } = HUD.lineup;
    if (this.mode === 'challenge') return challengeTitle;
    const tile = ROAD_TILES[this.tile];
    if (tile.kind === 'boss') return bossTitle;
    const battles = ROAD_TILES.filter((other) => other.area === tile.area && other.kind === 'battle');
    return `${battleTitle} ${battles.indexOf(tile) + 1} ${of} ${battles.length}`;
  }

  // La battaglia parte con questo schieramento, costruito a ogni partenza (ricominciando prende i numeri di adesso,
  // anche gli edifici finiti nel frattempo); il meta-gioco sa che battaglia è (battleContext: tipo, dove tornare, la
  // casella), e lasciandola a metà si torna al mondo sulla strada. La sfida si spende qui (meta/actions.js
  // prepareBattle): se intanto non si può più, si torna al mondo
  start() {
    const context = { kind: this.mode, returnTo: 'World', tile: this.tile };
    const makeLoadout = this.registry.get('actions').prepareBattle(context);
    if (makeLoadout === null) {
      this.scene.start('World');
      return;
    }
    this.registry.set('battleContext', context);
    if (this.mode === 'road') this.registry.set('worldReturn', { conquest: null });
    this.scene.start('Battle', { loadout: makeLoadout });
  }

  // Le regole della battaglia, una per riga: sulla strada l'area e la durata, la vita dei nemici, nella sfida cosa dà
  // vincerla e, se nel pannello di sviluppo è cambiata, la difficoltà di prova
  drawRules(rules) {
    const { enemyHpScale, length } = rules;
    const { rulesY, rulesGap, rulesStyle, ruleLabels, of } = HUD.lineup;
    const { separator } = HUD.world;
    const lines = [enemyHpScale > 1 ? `${ruleLabels.enemyHp} ×${decimalText(enemyHpScale)}` : ruleLabels.normal];
    if (this.mode === 'road') {
      const { waves, boss } = battlePlan(rules);
      const ending = boss ? ` ${ruleLabels.withBoss}` : `, ${ruleLabels.noBoss}`;
      lines.unshift(`${ruleLabels.lengths[length]}${separator}${waves} ${ruleLabels.waves}${ending}`);
      lines.unshift(`${ruleLabels.area} ${ROAD_TILES[this.tile].area + 1} ${of} ${WORLD.road.length}`);
    }
    if (this.mode === 'challenge') lines.push(`${ruleLabels.prize} ${percentText(VILLAGE.challenge.timeShare, MINUS)}`);
    const { enemyHpScale: testHp, enemyCountScale: testCount } = TEST_BATTLE;
    if (testHp !== 1 || testCount !== 1) {
      const count = `${ruleLabels.testCount} ×${decimalText(testCount)}`;
      lines.push(`${ruleLabels.testHp} ×${decimalText(testHp)}${separator}${count}`);
    }
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
