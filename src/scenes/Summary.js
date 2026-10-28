import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { percentText } from '../core/format.js';
import { HEROES } from '../data/heroes.js';
import { amountText, durationText, fragmentsText } from '../view/words.js';
import { leaveBattle } from './leaveBattle.js';

// Riepilogo di fine battaglia, del meta-gioco: lo apre chi ha dato i premi (main.js), sopra la battaglia ferma, con il
// risultato della battaglia (result) e i premi (rewards, meta/rewards.js). Dall'alto: titolo; com'è andata (vinta:
// tutto il bottino e il premio; persa: quanto bottino si tiene); sulla strada il numero della battaglia; le scorte del
// bottino tenuto (legno, pietra ed esperienza sempre, le altre se ci sono); il premio (prizeText); le scorte che ci
// sono ora; una riga per ogni eroe schierato con danno fatto e subito, nemici abbattuti, i frammenti avuti e il segno
// del migliore. Le righe più larghe di HUD.gameOver.lineWidth si stringono. Se persa, il bottino tenuto si chiama
// Tieni, per non confonderlo con quello raccolto. Per continuare serve un tocco nuovo, che inizia dopo tapDelayMs:
// alzare il dito che stava già guidando l'eroe alla fine della missione non lascia il riepilogo. Si torna dove si era
// partiti (returnTo)
export class SummaryScene extends Phaser.Scene {
  constructor() {
    super('Summary');
  }

  init({ result, rewards, challenge, daily = null, returnTo }) {
    this.result = result;
    this.rewards = rewards;
    this.challenge = challenge;
    this.daily = daily;
    this.returnTo = returnTo;
  }

  create() {
    const layout = HUD.gameOver;
    const { textStyle, labels } = layout;
    const { width, height } = this.scale;
    const x = width / 2;
    const { completed, number } = this.result;
    const { rewards } = this;
    this.add.rectangle(0, 0, width, height, layout.overlayColor, layout.overlayAlpha).setOrigin(0);
    const title = completed ? layout.completedTitle : layout.failedTitle;
    this.add.text(x, layout.titleY, title, layout.titleStyle).setOrigin(0.5);
    const share = percentText(rewards.share);
    const outcome = completed ? labels.victory : `${labels.defeat} ${share} ${labels.defeatLoot}`;
    this.add.text(x, layout.outcomeY, outcome, textStyle).setOrigin(0.5);
    if (number !== null) this.add.text(x, layout.numberY, `${labels.battle} ${number}`, textStyle).setOrigin(0.5);
    // I frammenti sono nelle righe degli eroi: qui le scorte, quelle di keptAlways sempre e il resto se c'è
    const { kept } = rewards;
    const shown = layout.keptKinds.filter((kind) => layout.keptAlways.includes(kind) || kept[kind] > 0);
    const keptText = shown.map((kind) => amountText(kind, kept[kind] ?? 0)).join(' · ');
    const keptLabel = completed ? labels.loot : labels.kept;
    this.line(layout.lootY, `${keptLabel}: ${keptText}`);
    const prize = this.prizeText();
    if (prize !== null) this.line(layout.prizeY, prize);
    const now = layout.totalKinds.map((kind) => amountText(kind, rewards.resources[kind]));
    this.line(layout.totalY, `${labels.total}: ${now.join(' · ')}`);
    rewards.heroes.forEach((hero, index) => this.showHero(hero, layout.heroesY + index * layout.heroGap));
    this.add.text(x, layout.hintY, labels.hint, textStyle).setOrigin(0.5);

    const leave = () => leaveBattle(this, this.returnTo);
    this.time.delayedCall(layout.tapDelayMs, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.input.once(Phaser.Input.Events.POINTER_UP, leave));
    });
  }

  // Una riga piccola al centro, all'altezza y, stretta se è più larga di HUD.gameOver.lineWidth
  line(y, text) {
    const { smallStyle, lineWidth } = HUD.gameOver;
    const shown = this.add.text(this.scale.width / 2, y, text, smallStyle).setOrigin(0.5);
    shown.setScale(Math.min(1, lineWidth / shown.width));
  }

  // Il premio: nella sfida quanto tempo ha tolto al cantiere (challengeText); nella sfida del giorno, vinta, le gemme e
  // i frammenti del mitico del giorno; sulla strada, vinta, il premio della vittoria, persa per la prima volta su
  // quella casella la consolazione; null se non c'è niente da dire
  prizeText() {
    const { labels } = HUD.gameOver;
    const { completed } = this.result;
    const { prize, consolation } = this.rewards;
    if (this.challenge !== null) return this.challengeText();
    if (this.daily !== null && !completed) return labels.dailyLost;
    if (this.daily !== null) {
      return `${labels.dailyWon} ${amountText('gems', this.daily.gems, '+')} · ${fragmentsText(this.daily.fragments)}`;
    }
    if (completed) {
      const won = Object.entries(prize).map(([kind, amount]) => amountText(kind, amount, '+'));
      return `${labels.prize}: ${won.join(' · ')}`;
    }
    return consolation > 0 ? `${labels.consolation}: ${amountText('xp', consolation, '+')}` : null;
  }

  // Com'è andata la sfida: vinta toglie tempo al cantiere (se nel frattempo non è già finito), persa no
  challengeText() {
    const { labels } = HUD.gameOver;
    if (!this.result.completed) return labels.challengeLost;
    if (this.challenge.saved <= 0) return labels.challengeLate;
    return `${labels.challengeWon} ${durationText(this.challenge.saved)}`;
  }

  // Nome dell'eroe (con il segno del migliore) e, allineati a destra, i frammenti avuti; sotto le sue statistiche della
  // battaglia
  showHero(hero, y) {
    const { heroX, statsOffsetY, heroStyle, smallStyle, labels } = HUD.gameOver;
    const name = hero.mvp ? `${HEROES[hero.id].name}  ${labels.mvp}` : HEROES[hero.id].name;
    this.add.text(heroX, y, name, heroStyle).setOrigin(0, 0.5);
    if (hero.fragments > 0) {
      this.add
        .text(this.scale.width - heroX, y, `+${hero.fragments} ${labels.fragments}`, smallStyle)
        .setOrigin(1, 0.5);
    }
    const stats = [
      `${labels.dealt} ${Math.round(hero.damageDealt)}`,
      `${labels.taken} ${Math.round(hero.damageTaken)}`,
      `${labels.kills} ${hero.kills}`,
    ];
    this.add.text(heroX, y + statsOffsetY, stats.join(' · '), smallStyle).setOrigin(0, 0.5);
  }
}
