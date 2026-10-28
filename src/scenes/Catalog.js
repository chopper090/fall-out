import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { HEROES, RARITIES } from '../data/heroes.js';
import { CATALOG_FILTERS, CATALOG_TABS, catalogEntries } from '../meta/catalog.js';
import { canUpgrade } from '../meta/village.js';
import { entryLines, entryNeeds, entryTitle } from '../view/catalogWords.js';
import { drawIcon } from '../view/icons.js';
import { addButton, addGearButton } from './buttons.js';
import { openSettings } from './PauseMenu.js';
import { createScrollArea } from './scrollArea.js';

// Il Catalogo, in grigio: edifici, armi, eroi e risorse in quattro schede, con lo stato di ogni voce (posseduto,
// potenziabile, ottenibile, bloccato: meta/catalog.js), cosa fa ora e dopo, e i requisiti spuntati
// (view/catalogWords.js). I filtri mostrano tutte le voci o solo quelle di uno stato; le voci stanno in una lista che
// scorre (scenes/scrollArea.js), che cambiando scheda o filtro torna all'inizio. Vai porta dove la voce si usa: un
// edificio nel mondo (con la sua barra aperta, o da mettere se non c'è ancora), un'arma nella fucina (senza la fucina,
// la fucina nel mondo), un eroe nella schermata degli eroi. Si arriva con la scheda tab (di partenza quella degli
// edifici) e, da Info di un edificio, la voce focus in evidenza; Mondo torna al mondo. L'ingranaggio apre le
// impostazioni. La schermata cambia solo a ogni tocco: si ridisegna tutta
export class CatalogScene extends Phaser.Scene {
  constructor() {
    super('Catalog');
  }

  init(data) {
    this.tab = CATALOG_TABS.includes(data?.tab) ? data.tab : CATALOG_TABS[0];
    this.filter = 'all';
    this.focus = data?.focus ?? null;
  }

  create() {
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    this.list = createScrollArea(this, HUD.catalog.list);
    this.redraw();
  }

  redraw() {
    for (const object of [...this.children.list]) object.destroy();
    const { titleY, title, titleStyle, back, labels } = HUD.catalog;
    this.add.text(this.scale.width / 2, titleY, title, titleStyle).setOrigin(0.5);
    addGearButton(this, { ...HUD.settingsGear, onTap: () => openSettings(this) });
    this.drawTabs();
    this.drawFilters();
    this.drawEntries();
    const leave = () => this.scene.start('World');
    addButton(this, { ...back, label: labels.back, color: HUD.menu.quietButtonColor, onTap: leave });
    this.list.finish();
  }

  // Le schede, quella aperta accesa
  drawTabs() {
    const { tabs, tabLabels, tabStyle: style } = HUD.catalog;
    CATALOG_TABS.forEach((tab, index) => {
      const color = tab === this.tab ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
      const open = () => {
        this.tab = tab;
        this.focus = null;
        this.list.rewind();
        this.redraw();
      };
      const spec = { x: tabs.xs[index], y: tabs.y, width: tabs.width, height: tabs.height, color, style };
      addButton(this, { ...spec, label: tabLabels[tab], onTap: open });
    });
  }

  // I filtri, quello scelto acceso
  drawFilters() {
    const { filters, filterLabels, filterStyle: style } = HUD.catalog;
    Object.keys(CATALOG_FILTERS).forEach((filter, index) => {
      const color = filter === this.filter ? HUD.menu.buttonColor : HUD.menu.quietButtonColor;
      const choose = () => {
        this.filter = filter;
        this.list.rewind();
        this.redraw();
      };
      const spec = { x: filters.xs[index], y: filters.y, width: filters.width, height: filters.height, color, style };
      addButton(this, { ...spec, label: filterLabels[filter], onTap: choose });
    });
  }

  // Le voci della scheda con il filtro, in colonne, una sotto l'altra nella lista che scorre; senza voci lo dice
  drawEntries() {
    const { list, gap, columns, cardHeight, labels, emptyStyle } = HUD.catalog;
    const { profile } = this.save;
    const entries = catalogEntries(profile, this.tab, this.filter);
    const count = columns[this.tab];
    const cardWidth = (list.width - gap * (count - 1)) / count;
    const height = cardHeight[this.tab];
    this.list.begin();
    if (entries.length === 0) {
      this.add.text(this.scale.width / 2, list.y + height, labels.empty, emptyStyle).setOrigin(0.5);
    }
    entries.forEach((entry, index) => {
      const x = list.x + (index % count) * (cardWidth + gap);
      const y = list.y + Math.floor(index / count) * (height + gap);
      this.drawCard(entry, { x, y, width: cardWidth, height });
    });
    this.list.end(Math.ceil(entries.length / count) * (height + gap) - gap);
  }

  // La scheda della voce entry nel rettangolo box (angolo in alto a sinistra in x, y): il titolo (gli eroi del colore
  // della rarità), lo stato a destra, le righe e i requisiti, Vai per edifici ed eroi
  drawCard(entry, box) {
    const { card, stateLabels, stateColors, lockColor, cardTitleStyle, stateStyle, lineStyle } = HUD.catalog;
    const { profile } = this.save;
    const graphics = this.add.graphics();
    graphics.fillStyle(card.color);
    graphics.fillRoundedRect(box.x, box.y, box.width, box.height, card.radius);
    graphics.lineStyle(card.borderWidth, entry.id === this.focus ? card.focusBorder : card.border);
    graphics.strokeRoundedRect(box.x, box.y, box.width, box.height, card.radius);
    const left = box.x + card.padding;
    const right = box.x + box.width - card.padding;
    const title = this.add.text(left, box.y + card.titleY, entryTitle(entry), cardTitleStyle).setOrigin(0, 0.5);
    if (entry.kind === 'hero') title.setColor(RARITIES[HEROES[entry.id].rarity].color);
    const state = this.add.text(right, box.y + card.titleY, stateLabels[entry.state], stateStyle).setOrigin(1, 0.5);
    state.setColor(stateColors[entry.state]);
    if (entry.state === 'locked') {
      const at = { x: state.x - state.width - card.lockIcon, y: box.y + card.titleY };
      drawIcon(graphics, 'lock', { ...at, size: card.lockIcon, color: lockColor });
    }
    // Le righe crescono verso il basso quando vanno a capo; Vai sta accanto alle righe (edifici e armi) o accanto ai
    // requisiti (eroi)
    const beside = entry.kind === 'building' || entry.kind === 'weapon';
    const wrap = box.width - card.padding * 2 - (beside ? this.goWidth(entry) : 0);
    let y = box.y + card.lineY - card.lineGap / 2;
    for (const line of entryLines(entry, profile)) {
      const text = this.add.text(left, y, line, lineStyle).setWordWrapWidth(wrap);
      y += Math.max(card.lineGap, text.height);
    }
    const needsRight = right - (beside ? 0 : this.goWidth(entry));
    this.drawNeeds(entryNeeds(entry, profile), left, y + card.lineGap / 2, needsRight);
    if (entry.kind !== 'resource') this.drawGo(entry, box, beside);
  }

  // I requisiti in fila da (left, y), ognuno con il suo segno e colore, a capo quando passano right
  drawNeeds(needs, left, y, right) {
    const { card, needMarks, needColors, needStyle } = HUD.catalog;
    let x = left;
    let row = y;
    for (const need of needs) {
      const text = this.add.text(x, row, `${need.ok ? needMarks.ok : needMarks.no} ${need.text}`, needStyle);
      text.setOrigin(0, 0.5).setColor(need.ok ? needColors.ok : needColors.no);
      if (x > left && x + text.width > right) {
        x = left;
        row += card.lineGap;
        text.setPosition(x, row);
      }
      x += text.width + card.needGap;
    }
  }

  // Quanto spazio prende Vai a destra nella scheda della voce entry (nessuno per le scorte)
  goWidth(entry) {
    const { goButton } = HUD.catalog;
    return entry.kind === 'resource' ? 0 : goButton.width + goButton.right;
  }

  // Vai, accanto alle righe (beside) o in basso a destra: l'edificio nel mondo, con la sua barra se c'è, da mettere se
  // non c'è ancora e si può costruire, altrimenti la striscia Costruisci, che dice cosa manca; l'arma nella fucina (o,
  // senza la fucina, la fucina nel mondo come un edificio); l'eroe tra gli eroi
  drawGo(entry, box, beside) {
    const { goButton, card, labels, tabStyle: style } = HUD.catalog;
    const x = box.x + box.width - goButton.right - goButton.width / 2;
    const bottom = box.y + box.height - goButton.bottom - goButton.height / 2;
    const y = beside ? box.y + card.lineY + card.lineGap / 2 : bottom;
    const go = () => {
      if (entry.kind === 'hero') {
        this.scene.start('Heroes', { from: 'Catalog', fromData: { tab: this.tab } });
        return;
      }
      const { profile } = this.save;
      if (entry.kind === 'weapon' && profile.village.levels.forge > 0) {
        this.scene.start('Forge');
        return;
      }
      const building = entry.kind === 'weapon' ? 'forge' : entry.id;
      const placed = profile.village.positions[building] !== null;
      let target = { building };
      if (!placed) target = canUpgrade(profile, building) ? { building, place: true } : { menu: true };
      this.registry.set('worldTarget', target);
      this.scene.start('World');
    };
    const spec = { x, y, width: goButton.width, height: goButton.height, color: HUD.menu.buttonColor, style };
    this.list.button({ ...spec, label: labels.go, onTap: go });
  }
}
