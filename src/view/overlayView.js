import { CHESTS, DEPTH, FX, GATES, HERO, HUD, LOOT, PLATOONS } from '../config/balance.js';
import { percentText } from '../core/format.js';
import { WEAPONS } from '../data/units.js';
import { bumpScale } from '../fx/chestFx.js';
import { gateBumpScale } from '../fx/gateFx.js';
import { gainFade, lootPop } from '../fx/lootFx.js';
import { cooldownShare } from '../systems/heroes.js';
import { hex } from './canvas.js';
import { enemyFrame, heroFrame, pawnTop } from './pawns.js';
import { amountText, signedText } from './words.js';

// Davanti a tutto: barra della vita sui nemici colpiti e sempre sopra ogni eroe, con sopra la barra della
// ricarica della sua abilità, numeri del danno che salgono e sfumano, danno totale di un nemico quando muore, un po'
// trasparente, insegna sui cancelli, colpi che mancano e
// ricompensa sugli scrigni, ricompensa che sale quando uno scrigno si apre, valore dei premi in strada, numero dei
// soldati sopra l'esercito e sopra di lui i premi appena presi (dove li si prende resta solo l'anello a terra, in
// view/marksView.js: la scritta lì ripeteva quella sopra il numero, e scorrendo passava sulle barre degli eroi).
// Barre, numeri e contatore stanno sopra la testa delle pedine, nello stesso spazio in piedi delle pedine.
// Le scritte sono oggetti Text riusati: se ne crea una nuova solo quando ne servono di più
export function createOverlayView(scene, camera) {
  const graphics = scene.add.graphics().setDepth(DEPTH.overlay);
  const numberTexts = [];
  const totalTexts = [];
  const signTexts = [];
  const chestTexts = [];
  const rewardTexts = [];
  const openTexts = [];
  const lootTexts = [];
  const gainTexts = [];
  const nameTexts = [];
  // Il numero dei soldati e i premi presi sopra di lui stanno sopra tutte le altre scritte: le insegne dei cancelli
  // passano dietro
  const counterText = scene.add
    .text(0, 0, '', PLATOONS.counter.style)
    .setOrigin(0.5)
    .setDepth(DEPTH.overlay + 1);
  const left = { x: 0, y: 0 };
  const right = { x: 0, y: 0 };

  // Larghezza a schermo di un tratto lungo width, centrato in x, all'altezza y e alla distanza z
  function projectSpan(x, y, z, width) {
    camera.project(x - width / 2, y, z, left);
    camera.project(x + width / 2, y, z, right);
    return right.x - left.x;
  }

  function textAt(texts, index, style, depth = DEPTH.overlay) {
    return texts[index] ?? (texts[index] = scene.add.text(0, 0, '', style).setOrigin(0.5).setDepth(depth));
  }

  // Punto a above unità sopra il punto d'appoggio di una pedina in (x, z), scritto in left.
  // Restituisce la scala lì (pixel per unità del mondo)
  function aboveGround(x, z, above) {
    camera.project(x, 0, z, left);
    const scale = camera.scaleAt(0, z);
    left.y -= scale * above;
    return scale;
  }

  function hideFrom(texts, count) {
    for (let index = count; index < texts.length; index++) texts[index].setVisible(false);
  }

  // Barra larga quanto chi la porta, poco sopra la sua testa (top), piena in proporzione alla vita
  function drawHealthBar(x, z, size, top, hp, maxHp, { height, offsetY, colors }) {
    if (!camera.inFront(0, z)) return;
    const scale = aboveGround(x, z, top + offsetY);
    const screenWidth = size * scale;
    const screenHeight = height * scale;
    const barLeft = left.x - screenWidth / 2;
    const barTop = left.y - screenHeight / 2;
    graphics.fillStyle(colors.back);
    graphics.fillRect(barLeft, barTop, screenWidth, screenHeight);
    graphics.fillStyle(colors.fill);
    graphics.fillRect(barLeft, barTop, (screenWidth * Math.max(0, hp)) / maxHp, screenHeight);
  }

  function drawDamageNumbers(enemyFx) {
    const { durationMs, rise, minScale, style } = FX.damageNumber;
    enemyFx.damageNumbers.forEach((number, index) => {
      const text = textAt(numberTexts, index, style);
      const progress = number.elapsedMs / durationMs;
      if (!camera.inFront(0, number.z)) {
        text.setVisible(false);
        return;
      }
      const scale = aboveGround(number.x, number.z, pawnTop(enemyFrame(number.type)) + rise * progress);
      text
        .setText(`-${formatDamage(number.value)}`)
        .setPosition(left.x, left.y)
        .setScale(Math.max(minScale, scale))
        .setAlpha(1 - progress)
        .setVisible(true);
    });
    hideFrom(numberTexts, enemyFx.damageNumbers.length);
  }

  // Il nome del potere appena usato sopra il suo eroe (FX.powerName): offset sopra la testa più alta degli eroi, nella
  // sua riga (row, fx/heroFx.js: così due nomi non si accavallano mai), e sfuma
  function drawPowerNames(heroFx, army) {
    const { durationMs, offset, minScale, lineHeight, style } = FX.powerName;
    let top = Infinity;
    for (const hero of army.heroes) {
      aboveGround(hero.x, hero.z, pawnTop(heroFrame(hero)) + offset);
      top = Math.min(top, left.y);
    }
    heroFx.names.forEach((name, index) => {
      const text = textAt(nameTexts, index, style, DEPTH.overlay + 1);
      const progress = name.elapsedMs / durationMs;
      if (!camera.inFront(0, name.hero.z)) {
        text.setVisible(false);
        return;
      }
      const scale = aboveGround(name.hero.x, name.hero.z, pawnTop(heroFrame(name.hero)) + offset);
      const size = Math.max(minScale, scale);
      const y = Math.min(left.y, top) - lineHeight * size * name.row;
      text
        .setText(HUD.heroes.abilities[name.kind])
        .setPosition(left.x, y)
        .setScale(size)
        .setAlpha(1 - progress)
        .setVisible(true);
    });
    hideFrom(nameTexts, heroFx.names.length);
  }

  // Sopra il nemico appena morto: parte offset sopra la sua testa, sale di rise e sfuma da alpha a zero
  function drawDamageTotals(enemyFx) {
    const { durationMs, offset, rise, alpha, minScale, style } = FX.damageTotal;
    enemyFx.totals.forEach((total, index) => {
      const text = textAt(totalTexts, index, style);
      const progress = total.elapsedMs / durationMs;
      if (!camera.inFront(0, total.z)) {
        text.setVisible(false);
        return;
      }
      const scale = aboveGround(total.x, total.z, pawnTop(enemyFrame(total.type)) + offset + rise * progress);
      text
        .setText(`-${Math.round(total.value)}`)
        .setPosition(left.x, left.y)
        .setScale(Math.max(minScale, scale))
        .setAlpha(alpha * (1 - progress))
        .setVisible(true);
    });
    hideFrom(totalTexts, enemyFx.totals.length);
  }

  // Insegna al centro della faccia anteriore della trave, grande quanto la trave in prospettiva, con lo scatto a ogni
  // colpo; le scritte lunghe si rimpiccioliscono per starci dentro
  function drawGateSigns(gates, gateFx) {
    const { width, depth, postHeight, beamHeight, sign } = GATES;
    const y = postHeight + beamHeight / 2;
    gates.forEach((gate, index) => {
      const text = textAt(signTexts, index, sign.style);
      const z = gate.z - depth / 2;
      if (!camera.inFront(y, z)) {
        text.setVisible(false);
        return;
      }
      const span = projectSpan(gate.x, y, z, width);
      text.setText(signedText(gate.value));
      const fit = Math.min(1, (sign.maxWidthShare * width) / text.width);
      text
        .setPosition((left.x + right.x) / 2, left.y)
        .setScale(Math.max(sign.minScale, span / width) * fit * gateBumpScale(gateFx, gate))
        .setVisible(true);
    });
    hideFrom(signTexts, gates.length);
  }

  // Sul fronte della cassa i colpi che mancano, con lo scatto a ogni colpo; sopra il coperchio la ricompensa
  function drawChestSigns(chests, chestFx) {
    const { height, depth, lid, sign } = CHESTS;
    const rewardY = height + lid.height + sign.rewardOffsetY;
    chests.forEach((chest, index) => {
      const hits = textAt(chestTexts, index, sign.hitsStyle);
      const reward = textAt(rewardTexts, index, sign.rewardStyle);
      const z = chest.z - depth / 2 - lid.overhang;
      if (!camera.inFront(rewardY, z)) {
        hits.setVisible(false);
        reward.setVisible(false);
        return;
      }
      placeText(hits, String(chest.hits), chest.x, height / 2, z, bumpScale(chestFx, chest));
      placeText(reward, chestLabel(chest.kind), chest.x, rewardY, z);
    });
    hideFrom(chestTexts, chests.length);
    hideFrom(rewardTexts, chests.length);
  }

  // Scritta in (x, y, z), grande quanto vuole la distanza (almeno minScale) per grow
  function placeText(text, label, x, y, z, grow = 1, minScale = CHESTS.sign.minScale) {
    camera.project(x, y, z, left);
    const scale = Math.max(minScale, camera.scaleAt(y, z)) * grow;
    text.setText(label).setPosition(left.x, left.y).setScale(scale).setAlpha(1).setVisible(true);
  }

  // La ricompensa dello scrigno appena aperto sale e sfuma
  function drawChestOpens(chestFx) {
    const { height, lid, sign } = CHESTS;
    const { durationMs, rise } = FX.chestOpen;
    chestFx.opens.forEach((open, index) => {
      const text = textAt(openTexts, index, sign.rewardStyle);
      const progress = open.elapsedMs / durationMs;
      const y = height + lid.height + sign.rewardOffsetY + rise * progress;
      if (!camera.inFront(y, open.z)) {
        text.setVisible(false);
        return;
      }
      placeText(text, chestLabel(open.kind), open.x, y, open.z);
      text.setAlpha(1 - progress);
    });
    hideFrom(openTexts, chestFx.opens.length);
  }

  // Il colore della cassa del premio (la faccia davanti); la scritta si ridisegna solo se cambia
  function paintKind(text, kind) {
    const color = hex(LOOT.colors[kind].front);
    if (text.style.color !== color) text.setColor(color);
  }

  // Sopra ogni premio in strada quanto vale
  function drawLoot(loot) {
    const { height, depth, sign } = LOOT;
    const y = height + sign.offsetY;
    loot.forEach((item, index) => {
      const text = textAt(lootTexts, index, sign.style);
      const z = item.z - depth / 2;
      if (!camera.inFront(y, z)) text.setVisible(false);
      else placeText(text, lootLabel(item), item.x, y, z, 1, sign.minScale);
    });
    hideFrom(lootTexts, loot.length);
  }

  // Il numero segue l'esercito, sopra la testa del capo e le sue barre
  function drawArmyCounter(army) {
    const hero = army.leader;
    if (!camera.inFront(0, hero.z)) {
      counterText.setVisible(false);
      return;
    }
    aboveGround(hero.x, hero.z, pawnTop(heroFrame(hero)) + PLATOONS.counter.offsetY);
    counterText.setText(String(army.size)).setPosition(left.x, left.y).setVisible(true);
  }

  // Sopra il numero dei soldati (già al suo posto) i premi appena presi, ognuno nella sua riga e del colore della sua
  // cassa: fermi, poi salgono e sfumano. Restano dentro lo schermo anche con gli eroi su un lato
  function drawLootGains(lootFx) {
    const { offsetY, rowHeight, rise, edge, style } = FX.lootGain;
    const screenWidth = scene.scale.width;
    lootFx.gains.forEach((gain, index) => {
      const text = textAt(gainTexts, index, style, DEPTH.overlay + 1);
      if (!counterText.visible) {
        text.setVisible(false);
        return;
      }
      const fade = gainFade(gain);
      paintKind(text, gain.kind);
      text.setText(lootLabel(gain)).setScale(lootPop(gain.elapsedMs, FX.lootGain));
      const half = text.displayWidth / 2;
      const x = Math.min(screenWidth - edge - half, Math.max(edge + half, counterText.x));
      const y = counterText.y - offsetY - gain.row * rowHeight - rise * fade;
      text
        .setPosition(x, y)
        .setAlpha(1 - fade)
        .setVisible(true);
    });
    hideFrom(gainTexts, lootFx.gains.length);
  }

  return {
    draw({ enemies, gates, chests, loot, enemyFx, chestFx, gateFx, lootFx, heroFx, army, abilities }) {
      graphics.clear();
      for (const enemy of enemies) {
        if (!enemyFx.healthBars.has(enemy)) continue;
        const top = pawnTop(enemyFrame(enemy.type));
        drawHealthBar(enemy.x, enemy.z, enemy.size, top, enemy.hp, enemy.maxHp, FX.healthBar);
      }
      // La barra della ricarica sta sopra quella della vita: piena quando l'abilità è pronta
      const { healthBar, cooldownBar, barShare } = HERO;
      const cooldownTop = healthBar.offsetY + healthBar.height / 2 + cooldownBar.height / 2;
      for (const hero of army.heroes) {
        const top = pawnTop(heroFrame(hero));
        const width = hero.size * barShare;
        drawHealthBar(hero.x, hero.z, width, top, hero.hp, hero.maxHp, healthBar);
        drawHealthBar(hero.x, hero.z, width, top + cooldownTop, 1 - cooldownShare(abilities, hero), 1, cooldownBar);
      }
      drawGateSigns(gates, gateFx);
      drawChestSigns(chests, chestFx);
      drawChestOpens(chestFx);
      drawLoot(loot);
      drawArmyCounter(army);
      drawLootGains(lootFx);
      drawDamageNumbers(enemyFx);
      drawDamageTotals(enemyFx);
      drawPowerNames(heroFx, army);
    },
  };
}

// Sotto 1 (colpi sui corazzati) si mostra un decimale, così il numero non scrive mai zero
function formatDamage(value) {
  return value < 1 ? value.toFixed(1) : String(Math.round(value));
}

// "+3 legno", "+20 esperienza", "+1 frammento"
function lootLabel({ kind, amount }) {
  return amountText(kind, amount, '+');
}

// "+10% danno", "+10% cadenza", "+20% vita", "+5 élite" o il nome dell'arma
function chestLabel(kind) {
  const { words } = CHESTS.sign;
  if (kind.effect === 'weapon') return WEAPONS[kind.weapon].label;
  if (kind.effect === 'elite') return `+${kind.count} ${words.elite}`;
  return `${percentText(kind.amount, '+')} ${words[kind.effect]}`;
}
