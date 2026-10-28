import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { fixedText, percentText } from '../core/format.js';
import { RECRUIT } from '../data/growth.js';
import { CATEGORIES, HEROES, RARITIES } from '../data/heroes.js';
import {
  cheapestStep,
  gradeCost,
  heroData,
  levelCap,
  pullsTo,
  starCost,
  trainBlock,
  trainCost,
} from '../meta/heroes.js';
import { loadoutFrom } from '../meta/loadout.js';
import { armyPower } from '../systems/power.js';
import { PAWN_ATLAS, createPawnAtlas, heroFrame } from '../view/pawns.js';
import { amountText, starText } from '../view/words.js';
import { addButton, addGearButton, addTapZone } from './buttons.js';
import { openSettings } from './PauseMenu.js';
import { createScrollArea } from './scrollArea.js';

// Chi mostra la collezione: tutti, i tuoi, quelli da trovare
const SHOWN = {
  all: () => true,
  owned: (record) => record.owned,
  missing: (record) => !record.owned,
};

// Schermata degli eroi, in grigio: la collezione. Nel titolo la forza della squadra schierata (systems/power.js). In
// alto lo schieramento, i posti di HERO.slots (due davanti e tre dietro) con l'eroe che c'è; il capo resta nel suo. Si
// tocca un posto, poi un eroe per mettercelo (toccando quello che c'è già il posto si svuota). Sotto i filtri (tutti, i
// tuoi, quelli da trovare; la categoria, che cambia a ogni tocco) e la lista che scorre, una scheda per eroe
// nell'ordine dei dati (ogni categoria dalla rarità più comune): pedina, nome del colore della rarità, livello e stelle
// (accesi se si può addestrare o pagare con i frammenti il passo più economico, stella o grado); quelli da trovare in
// ombra, con la rarità (i mitici con i loro frammenti). Toccando una scheda senza un posto scelto si apre il dettaglio:
// i numeri in battaglia e i pulsanti per il livello, la stella e il grado del potere, o, per chi manca, dove si trova
// (e il pulsante per ottenerlo con i frammenti). In fondo il reclutamento, con le piastrine, l'esperienza da spendere e
// i tiri alle garanzie, e Indietro, che torna da dove si è venuti (from, con i suoi dati fromData); in alto a sinistra
// l'ingranaggio delle impostazioni. I cambi li fanno le azioni del meta-gioco (meta/actions.js), che salvano subito
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
    this.shown = 'all';
    this.category = null;
    this.list = createScrollArea(this, HUD.heroes.list);
    this.redraw();
  }

  // La schermata cambia solo a ogni tocco: si ridisegna tutta, con la lista dov'era
  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, title, titleStyle, back, labels } = HUD.heroes;
    const power = `${labels.power} ${Math.round(armyPower(loadoutFrom(this.save.profile)))}`;
    this.add.text(this.scale.width / 2, titleY, `${title}${HUD.world.separator}${power}`, titleStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    this.drawLineup();
    this.drawFilters();
    this.drawCards();
    this.drawRecruit();
    const leave = () => this.scene.start(this.from, this.fromData);
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
    if (this.detail !== null) this.drawDetail(this.detail);
    this.list.show(this.detail === null);
    this.list.finish();
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
      addTapZone(this, { x, y, width, height, onTap: choose });
    });
    const hint = this.selected === null ? labels.pickSlot : labels.pickHero;
    this.add.text(this.scale.width / 2, hintY, hint, hintStyle).setOrigin(0.5);
  }

  // I filtri: chi mostrare (quello scelto acceso) e la categoria, che passa alla prossima a ogni tocco (dopo l'ultima
  // tutte); cambiando, la lista torna all'inizio
  drawFilters() {
    const { filters, showLabels, allCategories, filterStyle: style } = HUD.heroes;
    const change = (apply) => () => {
      apply();
      this.list.rewind();
      this.redraw();
    };
    Object.keys(SHOWN).forEach((shown, index) => {
      const color = shown === this.shown ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
      const spec = { x: filters.showXs[index], y: filters.y, width: filters.showWidth, height: filters.height };
      addButton(this, { ...spec, label: showLabels[shown], color, style, onTap: change(() => (this.shown = shown)) });
    });
    const names = [null, ...Object.keys(CATEGORIES)];
    const next = () => (this.category = names[(names.indexOf(this.category) + 1) % names.length]);
    const label = this.category === null ? allCategories : CATEGORIES[this.category].role;
    const color = this.category === null ? HUD.menu.quietButtonColor : HUD.menu.buttonColor;
    const spec = { ...filters.category, y: filters.y, height: filters.height, label, color, style };
    addButton(this, { ...spec, onTap: change(next) });
  }

  // Le schede degli eroi che passano i filtri, nella lista che scorre; senza nessuno lo dice
  drawCards() {
    const { list, grid, labels, smallStyle } = HUD.heroes;
    const { heroes } = this.save.profile;
    const shown = Object.values(HEROES).filter(
      (hero) => SHOWN[this.shown](heroes[hero.id]) && (this.category === null || hero.category === this.category),
    );
    const width = (list.width - grid.gap * (grid.columns - 1)) / grid.columns;
    this.list.begin();
    if (shown.length === 0) {
      this.add.text(list.x + list.width / 2, list.y + grid.height / 2, labels.none, smallStyle).setOrigin(0.5);
    }
    shown.forEach((hero, index) => {
      const x = list.x + (index % grid.columns) * (width + grid.gap) + width / 2;
      const y = list.y + Math.floor(index / grid.columns) * (grid.height + grid.gap) + grid.height / 2;
      this.drawCard(hero, { x, y, width, height: grid.height });
    });
    const rows = Math.ceil(shown.length / grid.columns);
    this.list.end(rows * (grid.height + grid.gap) - grid.gap);
  }

  // Scheda dell'eroe nel rettangolo intorno al centro (x, y)
  drawCard(hero, { x, y, width, height }) {
    const { card, labels } = HUD.heroes;
    const { profile } = this.save;
    const record = profile.heroes[hero.id];
    const rarity = RARITIES[hero.rarity];
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color, record.owned ? 1 : card.lockedAlpha);
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, card.radius);
    const placed = profile.lineup.includes(hero.id);
    graphics.lineStyle(card.borderWidth, placed ? card.placedBorder : card.border);
    graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, card.radius);
    const top = y - height / 2;
    const pawn = this.add.image(x, top + card.pawnY, PAWN_ATLAS, heroFrame(hero)).setScale(card.pawnScale);
    const name = this.add
      .text(x, top + card.nameY, hero.name, card.nameStyle)
      .setOrigin(0.5)
      .setColor(rarity.color);
    let info = `${labels.level} ${record.level} · ${starText(record.stars)}`;
    let ready = trainBlock(profile, hero.id) === null || record.fragments >= (cheapestStep(record) ?? Infinity);
    if (!record.owned) {
      pawn.setAlpha(card.lockedAlpha);
      name.setAlpha(card.lockedNameAlpha);
      const assembled = rarity.chance === 0;
      info = assembled ? `${labels.fragments} ${record.fragments}/${RECRUIT.assemble}` : rarity.label;
      ready = assembled && record.fragments >= RECRUIT.assemble;
    }
    this.add.text(x, top + card.infoY, info, ready ? card.readyStyle : card.infoStyle).setOrigin(0.5);
    this.list.tapZone({ x, y, width, height }, () => this.tapHero(hero.id));
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

  // Pulsante del reclutamento (spento senza piastrine); sotto le piastrine e l'esperienza da spendere, i tiri che
  // mancano a ogni garanzia e l'ultimo tiro
  drawRecruit() {
    const { recruit: layout, smallStyle, labels } = HUD.heroes;
    const { profile } = this.save;
    const { dogTags, xp } = profile.resources;
    const x = this.scale.width / 2;
    const label = `${labels.recruit} · ${RECRUIT.cost} ${labels.dogTags}`;
    const pull = () => this.pull();
    const enabled = dogTags >= RECRUIT.cost;
    addButton(this, { ...layout.button, label, color: HUD.menu.buttonColor, enabled, onTap: pull });
    const have = `${labels.have} ${dogTags} ${labels.dogTags} · ${amountText('xp', xp)}`;
    this.add.text(x, layout.infoY, have, smallStyle).setOrigin(0.5);
    const tiers = Object.entries(pullsTo(profile)).map(
      ([tier, pulls]) => `${RARITIES[tier].label.toLowerCase()} ${labels.within} ${pulls}`,
    );
    this.add.text(x, layout.guaranteeY, `${labels.guaranteed}: ${tiers.join(' · ')}`, smallStyle).setOrigin(0.5);
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

  // Dettaglio sopra la schermata: nome, rarità e ruolo; di un eroe tuo livello con il tetto del centro città, stelle,
  // grado e frammenti, i numeri in battaglia e i pulsanti del livello, della stella e del grado (drawGrowth); di uno da
  // trovare dove si trova (whereLines) e, se si ottiene con i frammenti, il pulsante per ottenerlo (drawAssemble). Poi
  // Chiudi
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
      lines.push(`${labels.level} ${record.level} · ${labels.cap} ${levelCap(profile)}`);
      const grade = `${labels.grade} ${record.grade}`;
      lines.push(`${starText(record.stars)} · ${grade} · ${labels.fragments} ${record.fragments}`);
      lines.push(...battleLines(heroData(id, record)));
    } else {
      lines.push(...whereLines(hero, record));
    }
    const x = width / 2;
    const name = this.add.text(x, top + detail.titleY, hero.name, detail.titleStyle).setOrigin(0.5);
    name.setColor(RARITIES[hero.rarity].color);
    lines.forEach((line, index) => {
      const text = this.add
        .text(x, top + detail.linesY + index * detail.lineGap, line, detail.textStyle)
        .setOrigin(0.5);
      text.setScale(Math.min(1, detail.lineWidth / text.width));
    });
    const close = () => {
      this.detail = null;
      this.redraw();
    };
    if (record.owned) this.drawGrowth(id);
    else if (RARITIES[hero.rarity].chance === 0) this.drawAssemble(id);
    addButton(this, { ...detail.closeButton, label: labels.close, color: HUD.menu.quietButtonColor, onTap: close });
  }

  // I pulsanti del livello (con il suo costo, acceso se si può pagare; al tetto del centro lo dice) della stella e del
  // grado del potere (finché non sono al massimo; accesi se ci sono i frammenti) di un eroe tuo
  drawGrowth(id) {
    const { detail, labels } = HUD.heroes;
    const { profile } = this.save;
    const record = profile.heroes[id];
    const act = (action) => () => {
      action(id);
      this.redraw();
    };
    const price = trainCost(record.level);
    if (price !== null) {
      const block = trainBlock(profile, id);
      const paid = Object.entries(price).map(([kind, amount]) => amountText(kind, amount));
      const label = block === 'cap' ? labels.capReached : `${labels.train} · ${paid.join(' · ')}`;
      const spec = { ...detail.trainButton, label, color: HUD.menu.buttonColor, enabled: block === null };
      addButton(this, { ...spec, onTap: act(this.actions.trainHero) });
    }
    const steps = [
      { cost: starCost(record.stars), spec: detail.starButton, label: labels.starUp, action: this.actions.starUp },
      { cost: gradeCost(record.grade), spec: detail.gradeButton, label: labels.gradeUp, action: this.actions.gradeUp },
    ];
    for (const { cost, spec, label, action } of steps) {
      if (cost === null) continue;
      const text = `${label} · ${cost} ${labels.fragments}`;
      const enabled = record.fragments >= cost;
      addButton(this, { ...spec, label: text, color: HUD.menu.buttonColor, enabled, onTap: act(action) });
    }
  }

  // Il pulsante per ottenere con i suoi frammenti un eroe che il reclutamento non dà
  drawAssemble(id) {
    const { detail, labels } = HUD.heroes;
    const record = this.save.profile.heroes[id];
    const label = `${labels.assemble} · ${RECRUIT.assemble} ${labels.fragments}`;
    const assemble = () => {
      this.actions.assembleHero(id);
      this.redraw();
    };
    const enabled = record.fragments >= RECRUIT.assemble;
    addButton(this, { ...detail.trainButton, label, color: HUD.menu.buttonColor, enabled, onTap: assemble });
  }
}

// Dove si trova un eroe che non hai: nel reclutamento (con la parte di tiri della sua rarità), o solo con i frammenti
// (quanti ne hai e da dove arrivano)
function whereLines(hero, record) {
  const { labels } = HUD.heroes;
  const { chance } = RARITIES[hero.rarity];
  if (chance > 0) return [`${labels.fromRecruit}: ${percentText(chance)} ${labels.ofPulls}`];
  return [`${labels.fromFragments}: ${record.fragments}/${RECRUIT.assemble}`, labels.fragmentSources];
}

// Vita, arma (con i colpi della raffica), abilità come le porta in battaglia (il nome con la ricarica e sotto cosa fa,
// effectText), e il danno in più dei soldati attorno
function battleLines({ maxHp, weapon, ability, growth }) {
  const { labels, abilities } = HUD.heroes;
  const every = `${labels.every} ${decimal(ability.cooldownSeconds)} s`;
  const effect = effectText(ability);
  const shots = weapon.pellets ? `${weapon.pellets} × ` : '';
  const weaponText = `${weapon.label} ${shots}${decimal(weapon.damage)} × ${decimal(weapon.fireRate)}/s`;
  const lines = [`${labels.life} ${decimal(maxHp)} · ${weaponText}`, `${abilities[ability.kind]} · ${every}`, effect];
  if (growth > 1) lines.push(`${labels.troops} ${percentText(growth - 1, '+')}`);
  return lines;
}

// Cosa fa l'abilità, in breve: "+40% danno a tutti per 5 s", "18% della vita intorno, ferma 0,8 s", "60% della vita
// ai 2 più duri, +50% danni presi per 5 s"...
function effectText(ability) {
  const { labels } = HUD.heroes;
  const seconds = (value) => `${decimal(value)} s`;
  const share = (text) => `${percentText(ability.share)} ${text}`;
  const lasting = `${labels.for} ${seconds(ability.seconds ?? 0)}`;
  const rate = `×${decimal(ability.fireRateScale ?? 1)} ${labels.fireRate}`;
  const plus = (value, text) => (value > 0 ? `, ${percentText(value, '+')} ${text}` : '');
  const parts = {
    rally: () => {
      const bonus = `${percentText(ability.damageBonus, '+')} ${labels.damageToAll}`;
      return `${bonus}${plus(ability.fireRateBonus, labels.fireRate)} ${lasting}`;
    },
    rapidFire: () => `${rate}${plus(ability.damageBonus, labels.damage)} ${lasting}`,
    fury: () => `${rate}, ${labels.armor} ${lasting}`,
    shield: () => `${labels.blocks} ${lasting}, ${labels.smash} ${percentText(-ability.smashCut)}`,
    shockwave: () => `${share(labels.around)}, ${labels.stops} ${seconds(ability.stunSeconds)}`,
    pierce: () => `${share(labels.column)}, +${ability.gateHits} ${labels.gateHits}`,
    bombard: () => `${share(labels.area)}, ${labels.radius} ${ability.radius}`,
    rescue: () => {
      const gates = `${labels.gates} ${percentText(-ability.gateShare)}`;
      return `${percentText(ability.healShare, '+')} ${labels.heal}, +${ability.soldiers} ${labels.soldiers}, ${gates}`;
    },
    mark: () => {
      const many = `${labels.toughestOf} ${ability.marks} ${labels.hardest}`;
      const targets = ability.marks > 1 ? many : labels.toughest;
      return `${share(targets)}, ${percentText(ability.markBonus, '+')} ${labels.marked} ${lasting}`;
    },
  };
  return parts[ability.kind]();
}

// Un decimale con la virgola, ma senza ",0": "1,5", "2" (fixedText da solo scriverebbe "2,0")
function decimal(value) {
  return fixedText(value, 1).replace(',0', '');
}
