import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
import { GAME_EVENTS, META_EVENTS } from './core/events.js';
import { loadSave } from './core/save.js';
import { createMetaActions } from './meta/actions.js';
import { loadSettings } from './core/settings.js';
import { WorldScene } from './scenes/World.js';
import { WorldUIScene } from './scenes/WorldUI.js';
import { LineupScene } from './scenes/Lineup.js';
import { HeroesScene } from './scenes/Heroes.js';
import { BattleScene } from './scenes/Battle.js';
import { BattleUIScene } from './scenes/BattleUI.js';
import { PauseMenuScene } from './scenes/PauseMenu.js';
import { SummaryScene } from './scenes/Summary.js';

loadSettings();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: DISPLAY.backgroundColor,
  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DISPLAY.width,
    height: DISPLAY.height,
  },
  // Due dita: nel mondo si zooma pizzicando
  input: { activePointers: 2 },
  scene: [
    WorldScene,
    WorldUIScene,
    LineupScene,
    HeroesScene,
    BattleScene,
    BattleUIScene,
    PauseMenuScene,
    SummaryScene,
  ],
});
// Il salvataggio della partita e le azioni del giocatore sul meta-gioco (meta/actions.js, con i loro eventi su
// game.events), per tutte le scene; e che battaglia si sta giocando (battleContext, lo scrive lo schieramento: kind
// road, la battaglia di una casella della strada (tile), o challenge, la sfida del cantiere; returnTo: la scena a cui
// tornare). Ogni battaglia finita passa al meta-gioco (finishBattle: statistiche, premi, sfida, casella vinta), poi il
// riepilogo si apre sopra la battaglia ferma; dopo una battaglia della strada il mondo riapre la strada, con la
// conquista se c'è stata (worldReturn)
const save = loadSave();
const actions = createMetaActions({ save, emit: (name, payload) => game.events.emit(name, payload) });
game.registry.set('save', save);
game.registry.set('actions', actions);
game.events.on(GAME_EVENTS.BATTLE_ENDED, (result) => {
  const context = game.registry.get('battleContext');
  const { rewards, challenge, conquest } = actions.finishBattle(context, result);
  if (context.kind === 'road') game.registry.set('worldReturn', { conquest });
  game.scene.start('Summary', { result, rewards, challenge, returnTo: context.returnTo });
});
// Cancellato il salvataggio (dalle impostazioni) fuori dalla battaglia si riparte dal mondo come la prima volta, sotto
// il menu ancora aperto: gli eroi o lo schieramento si chiudono, la vista e il ritorno dalla strada si dimenticano e
// il mondo riparte da capo (il terreno lo disegna solo aprendosi). In battaglia si va avanti come prima
game.events.on(META_EVENTS.SAVE_CLEARED, () => {
  if (game.scene.isActive('Battle')) return;
  game.registry.remove('worldView');
  game.registry.remove('worldReturn');
  for (const key of ['Heroes', 'Lineup']) if (game.scene.isActive(key)) game.scene.stop(key);
  game.scene.start('World');
});

// Strumenti di sviluppo, anche nel link pubblico finché sviluppiamo: il pannello si apre dall'ingranaggio, il test
// delle partite di fila (DEBUG.playtest) parte da solo
import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
