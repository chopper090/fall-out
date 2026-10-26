import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { percentText } from '../core/format.js';
import { HEROES } from '../data/heroes.js';
import { amountText, durationText } from '../view/words.js';
import { leaveBattle } from './leaveBattle.js';

// Riepilogo di fine battaglia, del meta-gioco: lo apre chi ha dato i premi (main.js), sopra la battaglia ferma, con il
// risultato della battaglia (result) e i premi (rewards, meta/rewards.js). Dall'alto: titolo; com'è andata (vinta:
// tutto il bottino e il premio; persa: quanto bottino si tiene); sulla strada il numero della battaglia; le risorse
// del bottino tenuto e, se vinta,
// il premio della vittoria (nella sfida, challenge, quanto tempo ha tolto al cantiere; nella sfida del giorno, daily,
// le gemme avute), se persa per la prima volta
// su quella casella la consolazione; le scorte e le piastrine
// che ci sono ora; una riga per ogni eroe schierato con danno fatto e subito, nemici
// abbattuti, esperienza e frammenti avuti e il segno del migliore. Se persa, il bottino tenuto si chiama Tieni, per
// non confonderlo con quello raccolto. Per continuare serve un tocco nuovo, che inizia dopo tapDelayMs: alzare il
// dito che stava già guidando l'eroe alla fine della missione non lascia il riepilogo. Si torna dove si era partiti
// (returnTo)
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
    const { textStyle, smallStyle, labels } = layout;
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
    // Esperienza e frammenti sono nelle righe degli eroi: qui le scorte, quelle di keptAlways sempre e il resto se c'è
    const { kept } = rewards;
    const shown = layout.keptKinds.filter((kind) => layout.keptAlways.includes(kind) || kept[kind] > 0);
    const keptText = shown.map((kind) => amountText(kind, kept[kind] ?? 0)).join(' · ');
    const keptLabel = completed ? labels.loot : labels.kept;
    this.add.text(x, layout.lootY, `${keptLabel}: ${keptText}`, smallStyle).setOrigin(0.5);
    if (this.challenge !== null) {
      this.add.text(x, layout.prizeY, this.challengeText(), smallStyle).setOrigin(0.5);
    } else if (this.daily !== null) {
      const daily = completed ? `${labels.dailyWon} ${amountText('gems', this.daily.gems, '+')}` : labels.dailyLost;
      this.add.text(x, layout.prizeY, daily, smallStyle).setOrigin(0.5);
    } else if (completed) {
      const prize = Object.entries(rewards.prize).map(([kind, amount]) => amountText(kind, amount, '+'));
      this.add.text(x, layout.prizeY, `${labels.prize}: ${prize.join(' · ')}`, smallStyle).setOrigin(0.5);
    } else if (rewards.consolation > 0) {
      const comfort = `${labels.consolation}: ${amountText('xp', rewards.consolation, '+')}`;
      this.add.text(x, layout.prizeY, comfort, smallStyle).setOrigin(0.5);
    }
    const now = layout.totalKinds.map((kind) => amountText(kind, rewards.resources[kind]));
    const total = `${labels.total}: ${now.join(' · ')}`;
    this.add.text(x, layout.totalY, total, smallStyle).setOrigin(0.5);
    rewards.heroes.forEach((hero, index) => this.showHero(hero, layout.heroesY + index * layout.heroGap));
    this.add.text(x, layout.hintY, labels.hint, textStyle).setOrigin(0.5);

    const leave = () => leaveBattle(this, this.returnTo);
    this.time.delayedCall(layout.tapDelayMs, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.input.once(Phaser.Input.Events.POINTER_UP, leave));
    });
  }

  // Com'è andata la sfida: vinta toglie tempo al cantiere (se nel frattempo non è già finito), persa no
  challengeText() {
    const { labels } = HUD.gameOver;
    if (!this.result.completed) return labels.challengeLost;
    if (this.challenge.saved <= 0) return labels.challengeLate;
    return `${labels.challengeWon} ${durationText(this.challenge.saved)}`;
  }

  // Nome dell'eroe (con il segno del migliore) e, allineato a destra, cosa ha avuto; sotto le sue statistiche della
  // battaglia
  showHero(hero, y) {
    const { heroX, statsOffsetY, heroStyle, smallStyle, labels } = HUD.gameOver;
    const name = hero.mvp ? `${HEROES[hero.id].name}  ${labels.mvp}` : HEROES[hero.id].name;
    this.add.text(heroX, y, name, heroStyle).setOrigin(0, 0.5);
    const got = [`+${hero.xp} ${labels.xp}`];
    if (hero.fragments > 0) got.push(`+${hero.fragments} ${labels.fragments}`);
    this.add.text(this.scale.width - heroX, y, got.join(' · '), smallStyle).setOrigin(1, 0.5);
    const stats = [
      `${labels.dealt} ${Math.round(hero.damageDealt)}`,
      `${labels.taken} ${Math.round(hero.damageTaken)}`,
      `${labels.kills} ${hero.kills}`,
    ];
    this.add.text(heroX, y + statsOffsetY, stats.join(' · '), smallStyle).setOrigin(0, 0.5);
  }
}
