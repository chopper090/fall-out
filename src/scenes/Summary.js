import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { HEROES } from '../data/heroes.js';
import { amountText } from '../view/words.js';

// Riepilogo di fine battaglia, del meta-gioco: lo apre chi ha dato i premi (main.js), sopra la battaglia ferma, con il
// risultato della battaglia (result) e i premi (rewards, meta/rewards.js). Dall'alto: titolo; com'è andata (vinta:
// tutto il bottino e il premio; persa: quanto bottino si tiene); distanza; bottino tenuto e, se vinta, il premio della
// vittoria; materiali che ci sono ora; una riga per ogni eroe schierato con danno fatto e subito, nemici abbattuti,
// esperienza e frammenti avuti e il segno del migliore. Se persa, il bottino tenuto si chiama Tieni, per non
// confonderlo con quello raccolto. Per ricominciare serve un tocco nuovo, che inizia dopo tapDelayMs: alzare il dito
// che stava già guidando l'eroe alla fine della missione non riavvia la partita
export class SummaryScene extends Phaser.Scene {
  constructor() {
    super('Summary');
  }

  init({ result, rewards }) {
    this.result = result;
    this.rewards = rewards;
  }

  create() {
    const layout = HUD.gameOver;
    const { textStyle, smallStyle, labels } = layout;
    const { width, height } = this.scale;
    const x = width / 2;
    const { completed, distance } = this.result;
    const { rewards } = this;
    this.add.rectangle(0, 0, width, height, layout.overlayColor, layout.overlayAlpha).setOrigin(0);
    const title = completed ? layout.completedTitle : layout.failedTitle;
    this.add.text(x, layout.titleY, title, layout.titleStyle).setOrigin(0.5);
    const share = `${Math.round(rewards.share * 100)}%`;
    const outcome = completed ? labels.victory : `${labels.defeat} ${share} ${labels.defeatLoot}`;
    this.add.text(x, layout.outcomeY, outcome, textStyle).setOrigin(0.5);
    const meters = Math.floor(distance / layout.unitsPerMeter);
    this.add.text(x, layout.distanceY, `${labels.distance}: ${meters} m`, textStyle).setOrigin(0.5);
    const fragments = Object.values(rewards.kept.fragments).reduce((sum, count) => sum + count, 0);
    const { materials, xp } = rewards.kept;
    const kept = [amountText('materials', materials), amountText('xp', xp), amountText('fragments', fragments)];
    const keptLabel = completed ? labels.loot : labels.kept;
    this.add.text(x, layout.lootY, `${keptLabel}: ${kept.join(' · ')}`, smallStyle).setOrigin(0.5);
    if (completed) {
      const prize = [amountText('materials', rewards.prize.materials, '+'), amountText('xp', rewards.prize.xp, '+')];
      this.add.text(x, layout.prizeY, `${labels.prize}: ${prize.join(' · ')}`, smallStyle).setOrigin(0.5);
    }
    const total = `${labels.total}: ${amountText('materials', rewards.materials)}`;
    this.add.text(x, layout.totalY, total, smallStyle).setOrigin(0.5);
    rewards.heroes.forEach((hero, index) => this.showHero(hero, layout.heroesY + index * layout.heroGap));
    this.add.text(x, layout.hintY, labels.hint, textStyle).setOrigin(0.5);

    const restart = () => {
      this.scene.stop();
      this.scene.get('Battle').scene.restart();
    };
    this.time.delayedCall(layout.tapDelayMs, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.input.once(Phaser.Input.Events.POINTER_UP, restart));
    });
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
