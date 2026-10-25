import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
import { GAME_EVENTS } from './core/events.js';
import { loadSave, refreshSave, writeSave } from './core/save.js';
import { recordBattle } from './meta/profile.js';
import { grantRewards } from './meta/rewards.js';
import { loadSettings } from './core/settings.js';
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
  scene: [LineupScene, HeroesScene, BattleScene, BattleUIScene, PauseMenuScene, SummaryScene],
});
// Il salvataggio della partita, per tutte le scene. Ogni battaglia finita entra nelle statistiche e dà i suoi premi,
// sul salvataggio riletto prima di scrivere; poi il riepilogo si apre sopra la battaglia ferma
const save = loadSave();
game.registry.set('save', save);
game.events.on(GAME_EVENTS.BATTLE_ENDED, (result) => {
  refreshSave(save);
  recordBattle(save.profile, result);
  const rewards = grantRewards(save.profile, result);
  writeSave(save);
  game.scene.start('Summary', { result, rewards });
});

// Strumenti di sviluppo, anche nel link pubblico finché sviluppiamo: il pannello si apre dall'ingranaggio, il test
// delle partite di fila (DEBUG.playtest) parte da solo
import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
