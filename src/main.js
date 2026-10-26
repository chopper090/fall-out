import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
import { startErrorLog } from './core/errorLog.js';
import { GAME_EVENTS, META_EVENTS } from './core/events.js';
import { loadSave } from './core/save.js';
import { createMetaActions } from './meta/actions.js';
import { loadSettings } from './core/settings.js';
// I valori di partenza dei ritocchi che cambiano una battaglia, per rigiocarla: si leggono caricando core/tweaks.js,
// prima che loadSettings li cambi con le impostazioni salvate
import './core/tweaks.js';
import { WorldScene } from './scenes/World.js';
import { WorldUIScene } from './scenes/WorldUI.js';
import { LineupScene } from './scenes/Lineup.js';
import { HeroesScene } from './scenes/Heroes.js';
import { BattleScene } from './scenes/Battle.js';
import { BattleUIScene } from './scenes/BattleUI.js';
import { PauseMenuScene } from './scenes/PauseMenu.js';
import { SummaryScene } from './scenes/Summary.js';
import { showErrorOverlay } from './view/errorOverlay.js';

// Gli errori che il gioco non prende vanno nel registro degli errori, con le scene attive, e al primo si apre la
// schermata dell'errore: senza, un errore in un frame ferma il gioco per sempre senza dire niente. Parte prima di
// tutto, così prende anche quelli dell'avvio (quando il gioco non c'è ancora non ci sono nemmeno le scene)
startErrorLog({
  scenes: () => game.scene.getScenes(true).map((scene) => scene.sys.settings.key),
  onError: showErrorOverlay,
});
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
// riepilogo si apre sopra la battaglia ferma; dopo una battaglia della strada il mondo torna sul capo, con la
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
// delle partite di fila (DEBUG.playtest) parte da solo. La build per l'uscita (npm run build:release) non li ha: la
// condizione è __BUILD__.release, che Vite scrive qui com'è (vite.config.js), e non BUILD.release di core/build.js,
// perché solo così la build lascia fuori il pannello invece di tenerlo in un file che non si apre mai
if (!__BUILD__.release) import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
