import { test } from 'node:test';
import { checker } from '../support/check.js';
import { SAVE, storage, stored } from '../support/suite.js';
import { CONTROLS, DISPLAY, FX, HUD, SETTINGS } from '../../src/config/balance.js';
import { META_EVENTS } from '../../src/core/events.js';
import { loadSave } from '../../src/core/save.js';
import { loadSettings, saveSettings } from '../../src/core/settings.js';
import { createMetaActions } from '../../src/meta/actions.js';

// Le impostazioni fuori dalla battaglia (B7): l'ingranaggio del mondo, degli eroi e dello schieramento e il salvataggio
// cancellato da lì

// Il rettangolo { left, right, top, bottom } di uno { x, y, width, height } intorno al centro
const box = ({ x, y, width, height }) => ({
  left: x - width / 2,
  right: x + width / 2,
  top: y - height / 2,
  bottom: y + height / 2,
});
const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;

// L'ingranaggio sta dentro lo schermo e nella fascia delle risorse del mondo, a sinistra (a destra si apre il pannello
// di sviluppo), e non tocca niente delle tre schermate: i pulsanti, l'obiettivo, le notizie, le schede del mondo, i
// posti e le schede degli eroi, il reclutamento, il titolo dello schieramento
test("L'ingranaggio delle impostazioni fuori dalla battaglia sta in un posto libero", (t) => {
  const check = checker(t);
  const { radius } = HUD.buttons;
  const gear = box({ ...HUD.settingsGear, width: radius * 2, height: radius * 2 });
  const { world, heroes, lineup } = HUD;
  const { grid } = heroes;
  const slots = heroes.slots.map(([x, y], slot) => [`posto ${slot} degli eroi`, box({ x, y, ...heroes.slotBox })]);
  const others = {
    'Eroi del mondo': box(world.heroesButton),
    Costruisci: box(world.buildButton),
    Esplora: box(world.exploreButton),
    obiettivo: box({ x: DISPLAY.width / 2, y: world.goal.y, width: world.goal.width, height: world.goal.height }),
    'cosa fare mettendo': box({ x: DISPLAY.width / 2, y: world.hint.y, width: DISPLAY.width, height: world.hint.height }),
    'notizie e avvisi': { left: 0, right: DISPLAY.width, top: world.news.y - world.news.padding, bottom: DISPLAY.height },
    'scheda del mondo': {
      left: 0,
      right: DISPLAY.width,
      top: world.panel.bottom - world.panel.height,
      bottom: world.panel.bottom,
    },
    ...Object.fromEntries(slots),
    'schede degli eroi': {
      left: grid.x0 - grid.width / 2,
      right: grid.x0 + (grid.columns - 1) * grid.dx + grid.width / 2,
      top: grid.y0 - grid.height / 2,
      bottom: DISPLAY.height,
    },
    Recluta: box(heroes.recruit.button),
    'Indietro degli eroi': box(heroes.back),
    'titolo dello schieramento': {
      left: 0,
      right: DISPLAY.width,
      top: lineup.titleY - parseInt(lineup.titleStyle.fontSize, 10) / 2,
      bottom: lineup.titleY,
    },
    Mondo: box(lineup.backButton),
    'Eroi dello schieramento': box(lineup.heroesButton),
    Parti: box(lineup.startButton),
  };
  const touched = Object.entries(others).filter(([, rect]) => !apart(gear, rect)).map(([name]) => name);
  const inScreen = gear.left >= 0 && gear.top >= 0 && gear.right <= DISPLAY.width && gear.bottom <= DISPLAY.height;
  const inBand = gear.bottom <= world.top.height;
  const left = gear.right < DISPLAY.width / 2;
  check(
    `ingranaggio da ${gear.left},${gear.top} a ${gear.right},${gear.bottom}: nello schermo ${inScreen}, nella fascia delle risorse (alta ${world.top.height}) ${inBand}, a sinistra ${left}; tocca ${touched.join(', ') || 'niente'} su ${Object.keys(others).length}`,
    inScreen && inBand && left && touched.length === 0,
  );
  check.done();
});

// Cancella salvataggio (le azioni del meta-gioco) riparte da zero ma lascia le impostazioni sul telefono: rilette,
// tornano quelle scelte
test('Cancellare il salvataggio lascia le impostazioni', (t) => {
  const check = checker(t);
  const start = { sensitivity: CONTROLS.sensitivity, damageNumbers: FX.showDamageNumbers };
  storage.items.clear();
  CONTROLS.sensitivity = 1.5;
  FX.showDamageNumbers = !start.damageNumbers;
  saveSettings();
  const settings = storage.items.get(SETTINGS.storageKey);
  const save = loadSave();
  const events = [];
  createMetaActions({ save, emit: (name) => events.push(name) }).clearSave();
  CONTROLS.sensitivity = start.sensitivity;
  FX.showDamageNumbers = start.damageNumbers;
  loadSettings();
  const back = { sensitivity: CONTROLS.sensitivity, damageNumbers: FX.showDamageNumbers };
  CONTROLS.sensitivity = start.sensitivity;
  FX.showDamageNumbers = start.damageNumbers;
  check(
    `cancellato (${events.join(', ')}, salvataggio scritto ${stored() !== undefined}): impostazioni sul telefono uguali ${storage.items.get(SETTINGS.storageKey) === settings}, rilette sensibilità ${back.sensitivity} e numeri del danno ${back.damageNumbers}`,
    events.includes(META_EVENTS.SAVE_CLEARED) &&
      JSON.parse(stored()).version === SAVE.version &&
      storage.items.get(SETTINGS.storageKey) === settings &&
      back.sensitivity === 1.5 &&
      back.damageNumbers === !start.damageNumbers,
  );
  check.done();
});
