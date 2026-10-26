import { DEBUG } from '../config/balance.js';
import { now } from '../core/clock.js';
import { WORLD_EVENTS } from '../core/events.js';
import { refreshSave, writeSave } from '../core/save.js';
import { minutesToMs } from '../core/time.js';
import { GROWTH } from '../data/growth.js';
import { HEROES } from '../data/heroes.js';
import { VILLAGE } from '../data/village.js';
import { WORLD } from '../data/world.js';
import { ROAD_TILES } from '../meta/road.js';
import {
  addResources,
  finishBuild,
  jumpToArea,
  jumpToTile,
  setBuilders,
  setHeroLevel,
  setHeroStars,
  skipTime,
  unlockHeroes,
} from './cheats.js';
import { createSaveTransfer } from './saveTransfer.js';

// La cartella dei trucchi di prova sul meta-gioco (DEBUG.meta), la prima del pannello di sviluppo pane: i trucchi sul
// profilo (debug/cheats.js) con le loro caselle, i posti cantiere (quanti sono, uno in più o in meno), vincere o
// perdere la battaglia in corso, copiare e incollare il salvataggio (debug/saveTransfer.js). In cima l'esito
// dell'ultimo trucco
export function createMetaPanel(game, pane) {
  const { title, start, skipOptions, labels } = DEBUG.meta;
  const save = game.registry.get('save');
  const transfer = createSaveTransfer(save);
  const params = { ...start, skip: skipOptions[0].minutes, hero: Object.keys(HEROES)[0] };
  let last = '';
  // Con un salvataggio in sola lettura i trucchi sul profilo non fanno niente, e qui lo si dice
  const status = {
    get note() {
      return save.readOnly ? labels.readOnly : last;
    },
  };

  // Un trucco sul profilo, change(profile, time), che restituisce false se non c'era niente da fare (e l'esito è
  // idle). Come le azioni del meta-gioco si rilegge prima il salvataggio; poi lo si scrive e lo si rilegge, così il
  // profilo ripassa da profileFrom (gli edifici rientrano in un territorio più piccolo), e la scena aperta riparte
  const cheat = (change, idle = '') => () => {
    if (save.readOnly) return;
    if (!save.writeFailed) refreshSave(save);
    if (change(save.profile, now()) === false) {
      last = idle;
      return;
    }
    const written = writeSave(save);
    if (written) refreshSave(save);
    last = written ? labels.done : labels.writeFailed;
    reloadActive(game);
  };
  // La battaglia in corso finisce come finirebbe davvero, con i suoi eventi (systems/replay.js endBattle, dagli
  // strumenti della battaglia, che lo registrano per rigiocarla): vinta come al completamento del livello, persa come
  // alla morte del capo. Prima si chiude il menu sopra, se c'è: la battaglia ferma riparte e finisce subito
  const end = (won) => () => {
    const scene = game.scene.getScene('Battle');
    const battle = scene.sys.isActive() ? scene.battle : null;
    if (battle === null || battle.over) {
      last = labels.noBattle;
      return;
    }
    if (game.scene.isActive('PauseMenu')) game.scene.getScene('PauseMenu').resume();
    game.registry.get('battleTools').end(won);
    last = labels.done;
  };

  const folder = pane.addFolder({ title, expanded: false, index: 0 });
  const button = (label, onClick) => folder.addButton({ title: label }).on('click', onClick);
  const field = (key, options) => folder.addBinding(params, key, { label: labels[key], ...options });
  folder.addBinding(status, 'note', { label: labels.note, readonly: true });
  field('amount', { step: 1 });
  button(labels.addResources, cheat((profile) => addResources(profile, params.amount)));
  button(labels.finishBuild, cheat(finishBuild, labels.noBuild));
  folder.addBinding(VILLAGE, 'builders', { label: labels.builders, readonly: true, format: (value) => String(value) });
  const builders = (step) => cheat((profile) => setBuilders(profile, VILLAGE.builders + step), labels.buildersLimit);
  button(labels.addBuilder, builders(1));
  button(labels.removeBuilder, builders(-1));
  field('skip', { options: Object.fromEntries(skipOptions.map(({ label, minutes }) => [label, minutes])) });
  button(labels.skipTime, cheat((profile, time) => skipTime(profile, minutesToMs(params.skip), time)));
  field('tile', { min: 0, max: ROAD_TILES.length - 1, step: 1 });
  button(labels.jumpToTile, cheat((profile) => jumpToTile(profile, params.tile)));
  field('areas', { min: 0, max: WORLD.road.length, step: 1 });
  button(labels.jumpToArea, cheat((profile) => jumpToArea(profile, params.areas)));
  button(labels.unlockHeroes, cheat(unlockHeroes));
  field('hero', { options: Object.fromEntries(Object.values(HEROES).map(({ id, name }) => [name, id])) });
  field('level', { min: 1, max: GROWTH.maxLevel, step: 1 });
  field('stars', { min: 1, max: GROWTH.maxStars, step: 1 });
  const setHero = (profile) => {
    setHeroLevel(profile, params.hero, params.level);
    setHeroStars(profile, params.hero, params.stars);
  };
  button(labels.setHero, cheat(setHero));
  button(labels.win, end(true));
  button(labels.lose, end(false));
  button(labels.exportSave, () => transfer.showExport());
  button(labels.importSave, () => transfer.showImport());
}

// La scena aperta riparte con il profilo nuovo: il mondo come quando ci si torna, con la vista di adesso (e il
// terreno, che disegna solo aprendosi, con le aree conquistate di adesso), gli eroi e lo schieramento con i loro dati.
// La battaglia no: un trucco conta dalla prossima
function reloadActive(game) {
  const { scene } = game;
  if (scene.isActive('World')) scene.getScene('World').bus.emit(WORLD_EVENTS.NAVIGATE, { scene: 'World' });
  for (const key of ['Heroes', 'Lineup']) {
    const open = scene.getScene(key);
    if (scene.isActive(key)) open.scene.restart(open.sys.settings.data);
  }
}
