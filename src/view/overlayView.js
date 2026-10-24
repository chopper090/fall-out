import { CAMERA, CHESTS, DEPTH, FX, GATES, HERO, PLATOONS } from '../config/balance.js';
import { WEAPONS } from '../data/units.js';
import { bumpScale } from '../fx/gateFx.js';
import { soldiersFrom } from '../systems/gates.js';
import { cooldownShare } from '../systems/heroes.js';
import { enemyFrame, heroFrame, pawnTop } from './pawns.js';

// Davanti a tutto: barra della vita sui nemici colpiti e sempre sopra ogni eroe, con sopra la barra della
// ricarica della sua abilità, numeri del danno che salgono e sfumano, insegna sui cancelli (con la barra fino al
// massimo per quelli con il numero), colpi che mancano e ricompensa sugli scrigni, ricompensa che sale quando uno
// scrigno si apre, numero dei soldati sopra l'esercito.
// Barre, numeri e contatore stanno sopra la testa delle pedine, nello stesso spazio in piedi delle pedine.
// Le scritte sono oggetti Text riusati: se ne crea una nuova solo quando ne servono di più
export function createOverlayView(scene, camera) {
  const graphics = scene.add.graphics().setDepth(DEPTH.overlay);
  const numberTexts = [];
  const signTexts = [];
  const chestTexts = [];
  const rewardTexts = [];
  const openTexts = [];
  // Il numero dei soldati sta sopra tutte le altre scritte: le insegne dei cancelli passano dietro
  const counterText = scene.add.text(0, 0, '', PLATOONS.counter.style).setOrigin(0.5).setDepth(DEPTH.overlay + 1);
  const left = { x: 0, y: 0 };
  const right = { x: 0, y: 0 };

  // Larghezza a schermo di un tratto lungo width, centrato in x, all'altezza y e alla distanza z
  function projectSpan(x, y, z, width) {
    camera.project(x - width / 2, y, z, left);
    camera.project(x + width / 2, y, z, right);
    return right.x - left.x;
  }

  function inFront(y, z) {
    return camera.depthOf(y, z) > CAMERA.nearDepth;
  }

  function textAt(texts, index, style) {
    return texts[index] ?? (texts[index] = scene.add.text(0, 0, '', style).setOrigin(0.5).setDepth(DEPTH.overlay));
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
    if (!inFront(0, z)) return;
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
      if (!inFront(0, number.z)) {
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

  // Insegna al centro della faccia anteriore della trave, grande quanto la trave in prospettiva; le scritte
  // lunghe si rimpiccioliscono per starci dentro. Quando il numero cambia l'insegna fa uno scatto (gateFx)
  function drawGateSigns(gates, gateFx, army) {
    const { width, depth, postHeight, beamHeight, sign } = GATES;
    const y = postHeight + beamHeight / 2;
    gates.forEach((gate, index) => {
      const text = textAt(signTexts, index, sign.style);
      const z = gate.z - depth / 2;
      if (!inFront(y, z)) {
        text.setVisible(false);
        return;
      }
      const span = projectSpan(gate.x, y, z, width);
      text.setText(gateLabel(gate, army.size));
      const fit = Math.min(1, (sign.maxWidthShare * width) / text.width);
      text
        .setPosition((left.x + right.x) / 2, left.y)
        .setScale(Math.max(sign.minScale, span / width) * fit * bumpScale(gateFx, gate))
        .setVisible(true);
      if (gate.kind.charged) drawGateBar(gate, z);
    });
    hideFrom(signTexts, gates.length);
  }

  // Barra in fondo alla trave: si riempie dal numero di partenza al massimo
  function drawGateBar(gate, z) {
    const { width, postHeight, sign } = GATES;
    const { height, offsetY, widthShare, back, fill } = sign.bar;
    const y = postHeight + offsetY;
    const barWidth = width * widthShare;
    const span = projectSpan(gate.x, y, z, barWidth);
    const screenHeight = height * camera.scaleAt(y, z);
    const share = gate.max > gate.start ? (gate.value - gate.start) / (gate.max - gate.start) : 1;
    graphics.fillStyle(back.color, back.alpha);
    graphics.fillRect(left.x, left.y - screenHeight / 2, span, screenHeight);
    graphics.fillStyle(fill);
    graphics.fillRect(left.x, left.y - screenHeight / 2, span * share, screenHeight);
  }

  // Sul fronte della cassa i colpi che mancano, con lo scatto a ogni colpo; sopra il coperchio la ricompensa
  function drawChestSigns(chests, gateFx) {
    const { height, depth, lid, sign } = CHESTS;
    const rewardY = height + lid.height + sign.rewardOffsetY;
    chests.forEach((chest, index) => {
      const hits = textAt(chestTexts, index, sign.hitsStyle);
      const reward = textAt(rewardTexts, index, sign.rewardStyle);
      const z = chest.z - depth / 2 - lid.overhang;
      if (!inFront(rewardY, z)) {
        hits.setVisible(false);
        reward.setVisible(false);
        return;
      }
      placeText(hits, String(chest.hits), chest.x, height / 2, z, bumpScale(gateFx, chest));
      placeText(reward, chestLabel(chest.kind), chest.x, rewardY, z);
    });
    hideFrom(chestTexts, chests.length);
    hideFrom(rewardTexts, chests.length);
  }

  // Scritta di uno scrigno in (x, y, z), grande quanto vuole la distanza (almeno CHESTS.sign.minScale) per grow
  function placeText(text, label, x, y, z, grow = 1) {
    camera.project(x, y, z, left);
    const scale = Math.max(CHESTS.sign.minScale, camera.scaleAt(y, z)) * grow;
    text.setText(label).setPosition(left.x, left.y).setScale(scale).setAlpha(1).setVisible(true);
  }

  // La ricompensa dello scrigno appena aperto sale e sfuma
  function drawChestOpens(gateFx) {
    const { height, lid, sign } = CHESTS;
    const { durationMs, rise } = FX.chestOpen;
    gateFx.opens.forEach((open, index) => {
      const text = textAt(openTexts, index, sign.rewardStyle);
      const progress = open.elapsedMs / durationMs;
      const y = height + lid.height + sign.rewardOffsetY + rise * progress;
      if (!inFront(y, open.z)) {
        text.setVisible(false);
        return;
      }
      placeText(text, chestLabel(open.kind), open.x, y, open.z);
      text.setAlpha(1 - progress);
    });
    hideFrom(openTexts, gateFx.opens.length);
  }

  // Il numero segue l'esercito, sopra la testa del capo e le sue barre
  function drawArmyCounter(army) {
    const hero = army.leader;
    if (!inFront(0, hero.z)) {
      counterText.setVisible(false);
      return;
    }
    aboveGround(hero.x, hero.z, pawnTop(heroFrame(hero)) + PLATOONS.counter.offsetY);
    counterText.setText(String(army.size)).setPosition(left.x, left.y).setVisible(true);
  }

  return {
    draw(enemies, gates, chests, enemyFx, gateFx, army, abilities) {
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
      drawGateSigns(gates, gateFx, army);
      drawChestSigns(chests, gateFx);
      drawChestOpens(gateFx);
      drawArmyCounter(army);
      drawDamageNumbers(enemyFx);
    },
  };
}

// Sotto 1 (colpi sui corazzati) si mostra un decimale, così il numero non scrive mai zero
function formatDamage(value) {
  return value < 1 ? value.toFixed(1) : String(Math.round(value));
}

// "+N", "0" o "−N" per i cancelli con il numero (con "MAX" quando è al massimo), "×2" ("+N" quando a un
// esercito grande size darebbe meno del doppio), "÷2" o "+2 vita" per gli altri
function gateLabel(gate, size) {
  const { kind, value, max } = gate;
  const { words } = GATES.sign;
  if (kind.effect === 'multiply') {
    const gain = soldiersFrom(gate, size);
    return gain < size * (kind.factor - 1) ? `+${gain}` : `×${kind.factor}`;
  }
  if (kind.effect === 'divide') return `÷${kind.factor}`;
  if (kind.effect === 'heal') return `+${kind.amount} ${words.heal}`;
  if (value === 0) return '0';
  if (value < 0) return `−${-value}`;
  return value >= max ? `+${value} ${words.max}` : `+${value}`;
}

// "+10% danno", "+10% cadenza" o il nome dell'arma
function chestLabel(kind) {
  if (kind.effect === 'weapon') return WEAPONS[kind.weapon].label;
  return `+${Math.round(kind.amount * 100)}% ${CHESTS.sign.words[kind.effect]}`;
}
