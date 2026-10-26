import * as Phaser from 'phaser';
import { HUD, SETTINGS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { fixedText } from '../core/format.js';
import { saveSettings } from '../core/settings.js';
import { leaveBattle } from './leaveBattle.js';

const PAGES = { pause: 'pause', settings: 'settings', clearSave: 'clearSave' };

// Le impostazioni fuori dalla battaglia, sopra la scena scene, che intanto non riceve tocchi: sotto non c'è niente da
// fermare
export function openSettings(scene) {
  scene.scene.launch('PauseMenu', { page: PAGES.settings });
}

// Menu sopra la battaglia ferma, o le sole impostazioni sopra il mondo, gli eroi o lo schieramento (openSettings, dal
// loro ingranaggio). Pausa: riprendi, impostazioni, ricomincia (non nella sfida, che si tenta una volta sola) e lascia
// la battaglia (non conta: si torna dove si era partiti, battleContext.returnTo). Impostazioni: le voci per tutti i
// giocatori (SETTINGS), salvate a ogni modifica, Cancella salvataggio, che chiede conferma su una pagina sua (fuori
// dalla battaglia sotto il menu riparte il mondo da capo, main.js), e Sviluppo, che apre e chiude il pannello degli
// strumenti di sviluppo. Le impostazioni aperte dalla pausa tornano alla pausa; chiudendo il menu la battaglia, se
// c'è, riparte (GAME_RESUMED sul suo bus)
export class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super('PauseMenu');
  }

  // bus: quello della battaglia ferma sotto, che riparte chiudendo il menu; null fuori dalla battaglia
  init({ bus = null, page }) {
    this.bus = bus;
    this.startPage = page;
  }

  create() {
    const { width, height } = this.scale;
    const { overlayColor, overlayAlpha } = HUD.menu;
    // Lo sfondo prende tutti i tocchi: sotto il menu non arriva niente
    this.add.rectangle(0, 0, width, height, overlayColor, overlayAlpha).setOrigin(0).setInteractive();
    this.page = null;
    this.fromPause = this.startPage === PAGES.pause;
    this.saveCleared = false;
    this.show(this.startPage);
  }

  show(page) {
    this.page?.destroy();
    this.page = this.add.container(0, 0);
    if (page === PAGES.pause) this.buildPause();
    else if (page === PAGES.clearSave) this.buildClearSave();
    else this.buildSettings();
  }

  buildPause() {
    const { labels, buttonColor, quietButtonColor } = HUD.menu;
    const challenge = this.registry.get('battleContext').kind === 'challenge';
    const layout = this.openPanel(labels.pauseTitle, 0, challenge ? 3 : 4);
    this.addButton(layout.next(), labels.resume, buttonColor, () => this.resume());
    this.addButton(layout.next(), labels.settings, quietButtonColor, () => this.show(PAGES.settings));
    if (!challenge) this.addButton(layout.next(), labels.restart, quietButtonColor, () => this.restart());
    this.addButton(layout.next(), labels.leave, quietButtonColor, () => this.leave());
  }

  buildSettings() {
    const { labels, buttonColor, quietButtonColor } = HUD.menu;
    const devTools = this.registry.get('devTools');
    const layout = this.openPanel(labels.settingsTitle, SETTINGS.entries.length, devTools ? 3 : 2);
    for (const entry of SETTINGS.entries) {
      const y = layout.nextRow();
      if (entry.min === undefined) this.addToggle(y, entry);
      else this.addStepper(y, entry);
    }
    // Dopo la cancellazione il pulsante lo dice e non fa più niente
    if (this.saveCleared) this.addButton(layout.next(), labels.saveCleared, quietButtonColor, () => {});
    else this.addButton(layout.next(), labels.clearSave, quietButtonColor, () => this.show(PAGES.clearSave));
    if (devTools) this.addButton(layout.next(), labels.dev, quietButtonColor, () => devTools.toggle());
    const leave = this.fromPause ? () => this.show(PAGES.pause) : () => this.resume();
    this.addButton(layout.next(), this.fromPause ? labels.back : labels.close, buttonColor, leave);
  }

  // Conferma prima di cancellare il salvataggio: sì cancella e torna alle impostazioni, no ci torna e basta
  buildClearSave() {
    const { labels, quietButtonColor, dangerButtonColor, textStyle } = HUD.menu;
    const layout = this.openPanel(labels.clearTitle, 1, 2);
    const style = { ...textStyle, align: 'center', wordWrap: { width: this.inner.width } };
    this.page.add(this.add.text(this.scale.width / 2, layout.nextRow(), labels.clearText, style).setOrigin(0.5));
    const confirm = () => {
      this.registry.get('actions').clearSave();
      this.saveCleared = true;
      this.show(PAGES.settings);
    };
    this.addButton(layout.next(), labels.clearYes, dangerButtonColor, confirm);
    this.addButton(layout.next(), labels.clearNo, quietButtonColor, () => this.show(PAGES.settings));
  }

  // Pannello al centro con il titolo, alto quanto le sue righe e i suoi pulsanti.
  // Restituisce dove vanno, dall'alto: prima le righe, poi i pulsanti
  openPanel(title, rows, buttons) {
    const { panel, titleHeight, rowHeight, buttonHeight, buttonGap, titleStyle } = HUD.menu;
    const contentHeight = titleHeight + rows * rowHeight + buttons * (buttonHeight + buttonGap);
    const height = contentHeight + panel.padding * 2 - buttonGap;
    const left = (this.scale.width - panel.width) / 2;
    const y0 = (this.scale.height - height) / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(panel.color);
    graphics.fillRoundedRect(left, y0, panel.width, height, panel.radius);
    graphics.lineStyle(panel.borderWidth, panel.border);
    graphics.strokeRoundedRect(left, y0, panel.width, height, panel.radius);
    this.page.add(graphics);
    const titleY = y0 + panel.padding + titleHeight / 2;
    this.page.add(this.add.text(this.scale.width / 2, titleY, title, titleStyle).setOrigin(0.5));

    this.inner = { left: left + panel.padding, width: panel.width - panel.padding * 2 };
    let cursor = y0 + panel.padding + titleHeight;
    return {
      nextRow() {
        cursor += rowHeight;
        return cursor - rowHeight / 2;
      },
      next() {
        cursor += buttonHeight + buttonGap;
        return cursor - buttonGap - buttonHeight / 2;
      },
    };
  }

  // Pulsante largo quanto il pannello, centrato in y
  addButton(y, label, color, onTap) {
    const { buttonHeight, buttonRadius, buttonStyle } = HUD.menu;
    const { left, width } = this.inner;
    const graphics = this.add.graphics();
    graphics.fillStyle(color);
    graphics.fillRoundedRect(left, y - buttonHeight / 2, width, buttonHeight, buttonRadius);
    const text = this.add.text(left + width / 2, y, label, buttonStyle).setOrigin(0.5);
    this.page.add([graphics, text, this.addTapZone(left + width / 2, y, width, buttonHeight, onTap)]);
  }

  // Interruttore: tutta la riga si tocca per passare da sì a no
  addToggle(y, entry) {
    const { toggle, rowHeight, textStyle, buttonStyle } = HUD.menu;
    const { left, width } = this.inner;
    const pillX = left + width - toggle.width;
    const graphics = this.add.graphics();
    const state = this.add.text(pillX + toggle.width / 2, y, '', buttonStyle).setOrigin(0.5);
    const draw = () => {
      const on = entry.target[entry.key];
      graphics.clear();
      graphics.fillStyle(on ? toggle.onColor : toggle.offColor);
      graphics.fillRoundedRect(pillX, y - toggle.height / 2, toggle.width, toggle.height, toggle.height / 2);
      state.setText(on ? toggle.onLabel : toggle.offLabel);
    };
    draw();
    const flip = () => {
      entry.target[entry.key] = !entry.target[entry.key];
      saveSettings();
      draw();
    };
    const label = this.add.text(left, y, entry.label, textStyle).setOrigin(0, 0.5);
    this.page.add([label, graphics, state, this.addTapZone(left + width / 2, y, width, rowHeight, flip)]);
  }

  // Valore a passi: meno, valore, più. Ai limiti il valore non va oltre
  addStepper(y, entry) {
    const { stepper, quietButtonColor, buttonRadius, textStyle, buttonStyle } = HUD.menu;
    const { left, width } = this.inner;
    const { size, valueWidth, unit } = stepper;
    const plusX = left + width - size / 2;
    const valueX = plusX - size / 2 - valueWidth / 2;
    const minusX = valueX - valueWidth / 2 - size / 2;
    const value = this.add.text(valueX, y, '', buttonStyle).setOrigin(0.5);
    const draw = () => value.setText(`${fixedText(entry.target[entry.key], 2)}${unit}`);
    draw();
    const change = (direction) => () => {
      const next = entry.target[entry.key] + direction * entry.step;
      entry.target[entry.key] = Math.min(entry.max, Math.max(entry.min, next));
      saveSettings();
      draw();
    };
    const graphics = this.add.graphics();
    graphics.fillStyle(quietButtonColor);
    graphics.fillRoundedRect(minusX - size / 2, y - size / 2, size, size, buttonRadius);
    graphics.fillRoundedRect(plusX - size / 2, y - size / 2, size, size, buttonRadius);
    const label = this.add.text(left, y, entry.label, textStyle).setOrigin(0, 0.5);
    this.page.add([
      label,
      graphics,
      value,
      this.add.text(minusX, y, '−', buttonStyle).setOrigin(0.5),
      this.add.text(plusX, y, '+', buttonStyle).setOrigin(0.5),
      this.addTapZone(minusX, y, size, size, change(-1)),
      this.addTapZone(plusX, y, size, size, change(1)),
    ]);
  }

  // Agisce quando si alza il dito sopra la zona
  addTapZone(x, y, width, height, onTap) {
    const zone = this.add.zone(x, y, width, height).setInteractive();
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
    return zone;
  }

  // Il menu si chiude e la battaglia sotto, se c'è, riparte
  resume() {
    this.bus?.emit(EVENTS.GAME_RESUMED);
    this.scene.stop();
  }

  restart() {
    this.scene.stop();
    this.scene.get('Battle').scene.restart();
  }

  leave() {
    leaveBattle(this, this.registry.get('battleContext').returnTo);
  }
}
