import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { fixedText, percentText } from '../core/format.js';
import { RECRUIT } from '../data/growth.js';
import { HEROES, RARITIES } from '../data/heroes.js';
import { heroData, levelCap, pullsToRare, starCost, trainBlock, trainCost } from '../meta/heroes.js';
import { loadoutFrom } from '../meta/loadout.js';
import { armyPower } from '../systems/power.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { amountText, starText } from '../view/words.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';

const TAP = Phaser.Input.Events.GAMEOBJECT_POINTER_UP;

// Schermata degli eroi, in grigio. Nel titolo la forza della squadra schierata (systems/power.js). In alto lo
// schieramento, i posti di HERO.slots (due davanti e tre dietro) con l'eroe che c'è; il capo resta nel suo. Si tocca un
// posto, poi un eroe per mettercelo (toccando quello che c'è già il posto si svuota). Sotto una scheda per eroe:
// pedina, nome del colore della rarità, livello (acceso se lo si può alzare) e stelle, frammenti per la prossima
// (accesi se bastano); quelli da reclutare scuri. Toccando una scheda senza un posto scelto si apre il dettaglio: i
// numeri in battaglia e i pulsanti per il livello e per la stella. In fondo il reclutamento, con le piastrine,
// l'esperienza da spendere e i tiri al raro garantito, e Indietro, che torna da dove si è venuti (from, con i suoi dati
// fromData); in alto a sinistra l'ingranaggio delle impostazioni. I cambi li fanno le azioni del meta-gioco
// (meta/actions.js), che salvano subito
export class HeroesScene extends Phaser.Scene {
  constructor() {
    super('Heroes');
  }

  init(data) {
    this.from = data?.from ?? 'Lineup';
    this.fromData = data?.fromData ?? {};
  }

  create() {
    createPawnAtlas(this.textures);
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    this.selected = null;
    this.detail = null;
    this.message = '';
    this.redraw();
  }

  // La schermata cambia solo a ogni tocco: si ridisegna tutta
  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, title, titleStyle, back, labels } = HUD.heroes;
    const power = `${labels.power} ${Math.round(armyPower(loadoutFrom(this.save.profile)))}`;
    this.add.text(this.scale.width / 2, titleY, `${title}${HUD.world.separator}${power}`, titleStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    this.drawLineup();
    Object.values(HEROES).forEach((hero, index) => this.drawCard(hero, index));
    this.drawRecruit();
    const leave = () => this.scene.start(this.from, this.fromData);
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
    if (this.detail !== null) this.drawDetail(this.detail);
  }

  // I posti dello schieramento, quello scelto con il bordo acceso; sotto cosa fare
  drawLineup() {
    const { slots, slotBox, slotScale, slotPawnY, slotNameY, hintY, smallStyle, hintStyle, labels } = HUD.heroes;
    const { lineup } = this.save.profile;
    const graphics = this.add.graphics();
    slots.forEach(([x, y], slot) => {
      const { width, height, radius } = slotBox;
      graphics.fillStyle(slotBox.color);
      graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
      graphics.lineStyle(slotBox.borderWidth, this.selected === slot ? slotBox.selected : slotBox.border);
      graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
      const id = lineup[slot];
      if (id === null) this.add.text(x, y, labels.empty, smallStyle).setOrigin(0.5);
      else {
        this.add.image(x, y + slotPawnY, PAWN_ATLAS, heroFrame(HEROES[id])).setScale(slotScale);
        this.add.text(x, y + slotNameY, HEROES[id].name, smallStyle).setOrigin(0.5);
      }
      if (slot === 0) return;
      const choose = () => {
        this.selected = this.selected === slot ? null : slot;
        this.redraw();
      };
      this.add.zone(x, y, width, height).setInteractive().on(TAP, choose);
    });
    const hint = this.selected === null ? labels.pickSlot : labels.pickHero;
    this.add.text(this.scale.width / 2, hintY, hint, hintStyle).setOrigin(0.5);
  }

  // Scheda dell'eroe al posto index della griglia
  drawCard(hero, index) {
    const { grid, card, labels } = HUD.heroes;
    const x = grid.x0 + (index % grid.columns) * grid.dx;
    const y = grid.y0 + Math.floor(index / grid.columns) * grid.dy;
    const record = this.save.profile.heroes[hero.id];
    const rarity = RARITIES[hero.rarity];
    const left = x - grid.width / 2;
    const top = y - grid.height / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color, record.owned ? 1 : card.lockedAlpha);
    graphics.fillRoundedRect(left, top, grid.width, grid.height, card.radius);
    const placed = this.save.profile.lineup.includes(hero.id);
    graphics.lineStyle(card.borderWidth, placed ? card.placedBorder : card.border);
    graphics.strokeRoundedRect(left, top, grid.width, grid.height, card.radius);
    const pawn = this.add.image(x, y + card.pawnY, PAWN_ATLAS, heroFrame(hero)).setScale(card.pawnScale);
    this.add
      .text(x, y + card.nameY, hero.name, card.nameStyle)
      .setOrigin(0.5)
      .setColor(rarity.color);
    if (!record.owned) {
      pawn.setAlpha(card.lockedAlpha);
      this.add.text(x, y + card.infoY, `${rarity.label} · ${labels.locked}`, card.infoStyle).setOrigin(0.5);
    } else {
      const trainable = trainBlock(this.save.profile, hero.id) === null;
      const info = `${labels.level} ${record.level} · ${starText(record.stars)}`;
      this.add.text(x, y + card.infoY, info, trainable ? card.readyStyle : card.infoStyle).setOrigin(0.5);
      const cost = starCost(record.stars);
      const ready = cost !== null && record.fragments >= cost;
      const pieces = cost === null ? labels.maxStars : `${labels.fragments} ${record.fragments}/${cost}`;
      this.add.text(x, y + card.fragmentsY, pieces, ready ? card.readyStyle : card.infoStyle).setOrigin(0.5);
    }
    this.add
      .zone(x, y, grid.width, grid.height)
      .setInteractive()
      .on(TAP, () => this.tapHero(hero.id));
  }

  // Con un posto scelto l'eroe va lì (o, se c'è già, il posto si svuota); altrimenti si apre il suo dettaglio
  tapHero(id) {
    const { profile } = this.save;
    if (this.selected === null) {
      this.detail = id;
    } else if (profile.heroes[id].owned && !HEROES[id].leader) {
      this.actions.placeHero(this.selected, profile.lineup[this.selected] === id ? null : id);
      this.selected = null;
    }
    this.redraw();
  }

  // Pulsante del reclutamento (spento senza piastrine), quante se ne hanno, l'esperienza da spendere, i tiri al raro
  // garantito e l'ultimo tiro
  drawRecruit() {
    const { recruit: layout, smallStyle, labels } = HUD.heroes;
    const { dogTags, xp } = this.save.profile.resources;
    const x = this.scale.width / 2;
    const label = `${labels.recruit} · ${RECRUIT.cost} ${labels.dogTags}`;
    const pull = () => this.pull();
    const enabled = dogTags >= RECRUIT.cost;
    addButton(this, { ...layout.button, label, color: HUD.menu.buttonColor, enabled, onTap: pull });
    const rare = `${labels.rareIn} ${pullsToRare(this.save.profile)}`;
    const info = `${labels.have} ${dogTags} ${labels.dogTags} · ${amountText('xp', xp)} · ${rare}`;
    this.add.text(x, layout.infoY, info, smallStyle).setOrigin(0.5);
    if (this.message !== '') this.add.text(x, layout.messageY, this.message, layout.messageStyle).setOrigin(0.5);
  }

  pull() {
    const { labels } = HUD.heroes;
    const result = this.actions.recruit();
    if (result === null) return;
    const { name } = HEROES[result.id];
    const rarity = RARITIES[result.rarity].label;
    this.message = result.isNew
      ? `${labels.newHero}: ${name} (${rarity})`
      : `${name} ${labels.already}: +${result.fragments} ${labels.fragments}`;
    this.redraw();
  }

  // Dettaglio sopra la schermata: nome, rarità e ruolo, livello con il tetto del centro città, stelle e frammenti, i
  // numeri in battaglia; il livello in più (con il suo costo, acceso se si può pagare; al tetto dice quale), la stella
  // in più (se ci sono i frammenti) e Chiudi
  drawDetail(id) {
    const { detail, labels } = HUD.heroes;
    const { width, height } = this.scale;
    const hero = HEROES[id];
    const { profile } = this.save;
    const record = profile.heroes[id];
    this.add.rectangle(0, 0, width, height, detail.overlay, detail.overlayAlpha).setOrigin(0).setInteractive();
    const graphics = this.add.graphics();
    const top = detail.y - detail.height / 2;
    graphics.fillStyle(detail.color);
    graphics.fillRoundedRect((width - detail.width) / 2, top, detail.width, detail.height, detail.radius);
    graphics.lineStyle(detail.borderWidth, detail.border);
    graphics.strokeRoundedRect((width - detail.width) / 2, top, detail.width, detail.height, detail.radius);
    const lines = [`${RARITIES[hero.rarity].label} · ${hero.role}`];
    if (record.owned) {
      const cost = starCost(record.stars);
      lines.push(`${labels.level} ${record.level} · ${labels.cap} ${levelCap(profile)}`);
      const pieces = cost === null ? labels.maxStars : `${labels.fragments} ${record.fragments}/${cost}`;
      lines.push(`${starText(record.stars)} · ${pieces}`);
      lines.push(...battleLines(heroData(id, record)));
    } else {
      lines.push(labels.locked);
    }
    const x = width / 2;
    const name = this.add.text(x, top + detail.titleY, hero.name, detail.titleStyle).setOrigin(0.5);
    name.setColor(RARITIES[hero.rarity].color);
    lines.forEach((line, index) => {
      this.add.text(x, top + detail.linesY + index * detail.lineGap, line, detail.textStyle).setOrigin(0.5);
    });
    const close = () => {
      this.detail = null;
      this.redraw();
    };
    const price = trainCost(record.level);
    if (record.owned && price !== null) {
      const train = () => {
        this.actions.trainHero(id);
        this.redraw();
      };
      const block = trainBlock(profile, id);
      const paid = Object.entries(price).map(([kind, amount]) => amountText(kind, amount));
      const label = block === 'cap' ? labels.capReached : `${labels.train} · ${paid.join(' · ')}`;
      const enabled = block === null;
      addButton(this, { ...detail.trainButton, label, color: HUD.menu.buttonColor, enabled, onTap: train });
    }
    const cost = starCost(record.stars);
    if (record.owned && cost !== null) {
      const raise = () => {
        this.actions.starUp(id);
        this.redraw();
      };
      const label = `${labels.starUp} · ${cost} ${labels.fragments}`;
      const enabled = record.fragments >= cost;
      addButton(this, { ...detail.starButton, label, color: HUD.menu.buttonColor, enabled, onTap: raise });
    }
    addButton(this, { ...detail.closeButton, label: labels.close, color: HUD.menu.quietButtonColor, onTap: close });
  }
}

// Vita, arma (con i colpi della raffica), abilità come le porta in battaglia, e il danno in più dei soldati attorno
function battleLines({ maxHp, weapon, ability, growth }) {
  const { labels, abilities } = HUD.heroes;
  const every = `${labels.every} ${decimal(ability.cooldownSeconds)} s`;
  let effect;
  if (ability.kind === 'shockwave') effect = `${decimal(ability.damage)} ${labels.around}`;
  else if (ability.kind === 'pierce') effect = `${decimal(ability.damage)} ${labels.column}`;
  else if (ability.kind === 'shield') effect = `${decimal(ability.seconds)} s`;
  else effect = `×${decimal(ability.fireRateScale)} ${labels.for} ${decimal(ability.seconds)} s`;
  const shots = weapon.pellets ? `${weapon.pellets} × ` : '';
  const weaponText = `${weapon.label} ${shots}${decimal(weapon.damage)} × ${decimal(weapon.fireRate)}/s`;
  const lines = [`${labels.life} ${decimal(maxHp)} · ${weaponText}`, `${abilities[ability.kind]}: ${effect}, ${every}`];
  if (growth > 1) lines.push(`${labels.troops} ${percentText(growth - 1, '+')}`);
  return lines;
}

// Un decimale con la virgola, ma senza ",0": "1,5", "2" (fixedText da solo scriverebbe "2,0")
function decimal(value) {
  return fixedText(value, 1).replace(',0', '');
}
