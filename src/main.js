import * as Phaser from 'phaser';
import { DISPLAY } from './config/balance.js';
import { GAME_EVENTS } from './core/events.js';
import { loadSave, refreshSave, writeSave } from './core/save.js';
import { recordBattle } from './meta/profile.js';
import { grantRewards } from './meta/rewards.js';
import { winChallenge } from './meta/village.js';
import { loadSettings } from './core/settings.js';
import { VillageScene } from './scenes/Village.js';
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
  scene: [VillageScene, LineupScene, HeroesScene, BattleScene, BattleUIScene, PauseMenuScene, SummaryScene],
});
// Il salvataggio della partita, per tutte le scene, e che battaglia si sta giocando (battleContext, lo scrive lo
// schieramento: kind battle o challenge, la sfida del cantiere; returnTo: la scena a cui tornare). Ogni battaglia
// finita entra nelle statistiche e dà i suoi premi, sul salvataggio riletto prima di scrivere; la sfida vinta, al
// posto del premio della vittoria, toglie tempo al cantiere. Poi il riepilogo si apre sopra la battaglia ferma
const save = loadSave();
game.registry.set('save', save);
game.registry.set('battleContext', { kind: 'battle', returnTo: 'Village' });
game.events.on(GAME_EVENTS.BATTLE_ENDED, (result) => {
  const { kind, returnTo } = game.registry.get('battleContext');
  const isChallenge = kind === 'challenge';
  refreshSave(save);
  recordBattle(save.profile, result);
  const rewards = grantRewards(save.profile, result, { prize: !isChallenge });
  const saved = isChallenge && result.completed ? winChallenge(save.profile, Date.now()) : 0;
  writeSave(save);
  const challenge = isChallenge ? { saved } : null;
  game.scene.start('Summary', { result, rewards, challenge, returnTo });
});

// Strumenti di sviluppo, anche nel link pubblico finché sviluppiamo: il pannello si apre dall'ingranaggio, il test
// delle partite di fila (DEBUG.playtest) parte da solo
import('./debug/index.js').then(({ setupDebug }) => setupDebug(game));
