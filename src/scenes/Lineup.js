import * as Phaser from 'phaser';
import { HUD, POWER, TEST_BATTLE } from '../config/balance.js';
import { now } from '../core/clock.js';
import { decimalText, MINUS, percentText } from '../core/format.js';
import { WORLD } from '../data/world.js';
import { VILLAGE } from '../data/village.js';
import { loadoutFrom } from '../meta/loadout.js';
import { DAILY } from '../data/daily.js';
import { canPlayDaily, dailyRules } from '../meta/daily.js';
import { ROAD_TILES, canFight, stepCost } from '../meta/road.js';
import { canChallenge } from '../meta/village.js';
import { armyPower, difficulty, levelPower } from '../systems/power.js';
import { battlePlan } from '../systems/waves.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { amountText } from '../view/words.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

// Schermata prima della battaglia, in grigio, per la battaglia di una casella della strada (mode road, tile: la
// casella, la prossima o quella dove si è), per la sfida di un cantiere del villaggio (mode challenge, building:
// l'edificio del cantiere; data/village.js) o per una sfida del giorno (mode daily, daily: la sfida; data/daily.js, da
// cui si torna alle missioni). In alto il titolo e le regole della battaglia (l'area della strada, quanto sono duri i
// nemici, quante razioni costa partire o che si riprova senza pagare; per la sfida cosa dà e a quale cantiere); gli
// eroi dello schieramento del profilo, in ordine di posto, con nome, livello e stelle; la nostra potenza (con livelli,
// stelle, gradi e villaggio) e quella del livello con quelle regole, la fascia di difficoltà del loro rapporto con la
// sua barra colorata, le statistiche del salvataggio; Mondo torna indietro senza pagare niente (dalla strada il mondo
// torna sul capo), Eroi apre la schermata degli eroi, Parti la battaglia (e sulla strada paga le razioni); in alto a
// sinistra l'ingranaggio delle impostazioni. Se intanto la battaglia non può più partire (cantiere finito, casella già
// vinta, razioni che non bastano) si torna al mondo
export class LineupScene extends Phaser.Scene {
  constructor() {
    super('Lineup');
  }

  init(data) {
    this.mode = data?.mode;
    this.tile = data?.tile ?? null;
    this.building = data?.building ?? null;
    this.daily = data?.daily ?? null;
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
    const title = this.add.text(width / 2, titleY, this.title(), HUD.lineup.titleStyle).setOrigin(0.5);
    title.setScale(Math.min(1, HUD.lineup.titleWidth / title.width));
    this.drawRules(rules, profile);

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
    this.add
      .text(width / 2, bandY, band.label, bandStyle)
      .setOrigin(0.5)
      .setColor(bandColor);
    this.drawGauge(ratio);
    this.drawStats(profile.stats);

    const { backButton, heroesButton, startButton } = HUD.lineup;
    const back = () => this.leave();
    const fromData = { mode: this.mode, tile: this.tile, building: this.building, daily: this.daily };
    const openHeroes = () => this.scene.start('Heroes', { from: 'Lineup', fromData });
    const start = () => this.start();
    const quiet = HUD.menu.quietButtonColor;
    const backLabel = this.mode === 'daily' ? labels.backDaily : labels.back;
    addButton(this, { ...backButton, label: backLabel, color: quiet, onTap: back });
    addButton(this, { ...heroesButton, label: labels.heroes, color: quiet, onTap: openHeroes });
    addButton(this, { ...startButton, label: labels.start, color: HUD.menu.buttonColor, onTap: start });
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
  }

  // Le regole della battaglia, o null se non può più partire: quella della casella (la prossima, con le razioni che
  // bastano, o quella dove si è, da vincere: meta/road.js canFight) o la sfida del cantiere del suo edificio
  rules(profile) {
    if (this.mode === 'challenge') return canChallenge(profile, this.building, now()) ? VILLAGE.challenge.rules : null;
    if (this.mode === 'daily') return canPlayDaily(profile, this.daily) ? dailyRules(profile, this.daily) : null;
    if (this.mode !== 'road') return null;
    return canFight(profile, this.tile) ? ROAD_TILES[this.tile].rules : null;
  }

  // Si torna al mondo (dalla sfida del giorno alle missioni), senza pagare niente; da una battaglia della strada il
  // mondo torna sul capo
  leave() {
    if (this.mode === 'road') this.registry.set('worldReturn', { conquest: null });
    this.scene.start(this.mode === 'daily' ? 'Daily' : 'World');
  }

  // Sfida, la sfida del giorno con il suo nome, o la battaglia con il suo numero dalla porta (il contatore delle
  // partite) e, se c'è, il boss
  title() {
    const { challengeTitle, dailyTitle, battleTitle, bossTitle } = HUD.lineup;
    if (this.mode === 'challenge') return challengeTitle;
    if (this.mode === 'daily') return `${dailyTitle}${HUD.world.separator}${DAILY.challenges[this.daily].name}`;
    const tile = ROAD_TILES[this.tile];
    const title = `${battleTitle} ${tile.rules.number}`;
    return tile.kind === 'boss' ? `${title}${HUD.world.separator}${bossTitle}` : title;
  }

  // La battaglia parte con questo schieramento, costruito a ogni partenza (ricominciando prende i numeri di adesso,
  // anche gli edifici finiti nel frattempo); il meta-gioco sa che battaglia è (battleContext: tipo, dove tornare, la
  // casella), e lasciandola a metà si torna al mondo sul capo. Le sfide si spendono qui, e sulla strada si entra qui
  // nella casella pagando le sue razioni (meta/actions.js prepareBattle): se intanto non si può più, si torna al mondo
  // (dalla sfida del giorno alle missioni)
  start() {
    const returnTo = this.mode === 'daily' ? 'Daily' : 'World';
    const context = { kind: this.mode, returnTo, tile: this.tile, building: this.building, daily: this.daily };
    const makeLoadout = this.registry.get('actions').prepareBattle(context);
    if (makeLoadout === null) {
      this.scene.start(returnTo);
      return;
    }
    this.registry.set('battleContext', context);
    if (this.mode === 'road') this.registry.set('worldReturn', { conquest: null });
    this.scene.start('Battle', { loadout: makeLoadout });
  }

  // Le regole della battaglia, una per riga: sulla strada l'area con quanto costa partire (niente se si riprova) e
  // quanto dura con quante ondate e quanti boss, come sono i nemici, se le porte sono tutte negative, nella sfida cosa
  // dà vincerla (e a quale cantiere) e, se nel pannello di sviluppo è cambiata, la difficoltà di prova. profile: il
  // profilo di adesso
  drawRules(rules, profile) {
    const { rulesY, rulesGap, rulesStyle, ruleLabels, of } = HUD.lineup;
    const { separator } = HUD.world;
    const lines = [enemiesText(rules)];
    if (rules.minusOnly) lines.push(ruleLabels.minusOnly);
    if (this.mode === 'road' || this.mode === 'daily') {
      const { waves, bosses, type } = battlePlan(rules);
      const ending = ruleLabels.endings[bosses.flat().length];
      lines.unshift(`${ruleLabels.types[type]}${separator}${waves} ${ruleLabels.waves}${ending}`);
    }
    if (this.mode === 'daily') {
      const { gems, text } = DAILY.challenges[this.daily];
      lines.unshift(`${text}${separator}${ruleLabels.dailyPrize} ${amountText('gems', gems, '+')}`);
    }
    if (this.mode === 'road') {
      const cost = `${ruleLabels.cost} ${amountText('rations', stepCost(ROAD_TILES[this.tile]))}`;
      const area = `${ruleLabels.area} ${ROAD_TILES[this.tile].area + 1} ${of} ${WORLD.road.length}`;
      lines.unshift(`${area}${separator}${this.tile === profile.road.at ? ruleLabels.retry : cost}`);
    }
    if (this.mode === 'challenge') {
      const prize = `${ruleLabels.prize} ${percentText(VILLAGE.challenge.timeShare, MINUS)}`;
      lines.push(`${prize}${separator}${VILLAGE.buildings[this.building].name}`);
    }
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
      const progress = `${labels.level} ${record.level} · ${HUD.heroes.stars.on.repeat(record.stars)}`;
      this.add.image(x, heroY, PAWN_ATLAS, heroFrame(hero)).setScale(scale);
      fit(this.add.text(x, heroY + nameOffsetY, hero.name, nameStyle).setOrigin(0.5));
      fit(this.add.text(x, heroY + roleOffsetY, progress, roleStyle).setOrigin(0.5));
    });
  }

  // Battaglie finite, vinte e com'è andata l'ultima; niente prima della prima battaglia finita
  drawStats({ played, won, last }) {
    if (played === 0) return;
    const { statsY, lastY, statsLabels: labels, statsStyle } = HUD.lineup;
    const x = this.scale.width / 2;
    this.add.text(x, statsY, `${labels.played} ${played} · ${labels.won} ${won}`, statsStyle).setOrigin(0.5);
    if (last === null) return;
    let outcome = labels.completed;
    if (!last.completed) outcome = last.boss ? labels.failedBoss : `${labels.failedAt} ${last.wave}`;
    this.add.text(x, lastY, `${labels.last} ${outcome}`, statsStyle).setOrigin(0.5);
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

// Come sono i nemici con le regole rules: la vita, gli arrivi e quanto più spesso arrivano i tipi speciali, quando non
// sono come nei dati; se è tutto come nei dati, come sempre
function enemiesText({ enemyHpScale = 1, enemyCountScale = 1, specialsScale = {} }) {
  const { ruleLabels } = HUD.lineup;
  const special = Math.max(1, ...Object.values(specialsScale));
  if (enemyHpScale === 1 && enemyCountScale === 1 && special === 1) return ruleLabels.normal;
  const parts = [`${ruleLabels.enemyHp} ×${decimalText(enemyHpScale)}`];
  if (enemyCountScale !== 1) parts.push(`${ruleLabels.enemyCount} ×${decimalText(enemyCountScale)}`);
  if (special !== 1) parts.push(`${ruleLabels.specials} ×${decimalText(special)}`);
  return parts.join(HUD.world.separator);
}
