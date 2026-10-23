import { CAMERA, DEPTH, FX, GATES, HERO, PLATOONS } from '../config/balance.js';
import { enemyFrame, pawnTop } from './pawns.js';

// Davanti a tutto: barra della vita sui nemici colpiti e sempre sopra l'eroe, numeri del danno che salgono
// e sfumano, insegna "+N" sui cancelli, numero dei soldati sopra l'esercito.
// Barre, numeri e contatore stanno sopra la testa delle pedine, nello stesso spazio in piedi delle pedine.
// Le scritte sono oggetti Text riusati: se ne crea una nuova solo quando ne servono di più
export function createOverlayView(scene, camera) {
  const graphics = scene.add.graphics().setDepth(DEPTH.overlay);
  const numberTexts = [];
  const signTexts = [];
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

  // Insegna al centro della faccia anteriore della trave, grande quanto la trave in prospettiva
  function drawGateSigns(gates) {
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
      text
        .setText(`+${gate.value}`)
        .setPosition((left.x + right.x) / 2, left.y)
        .setScale(Math.max(sign.minScale, span / width))
        .setVisible(true);
    });
    hideFrom(signTexts, gates.length);
  }

  // Il numero segue l'esercito, sopra la testa dell'eroe e la sua barra della vita
  function drawArmyCounter(army) {
    const { hero } = army;
    if (!inFront(0, hero.z)) {
      counterText.setVisible(false);
      return;
    }
    aboveGround(hero.x, hero.z, pawnTop('hero') + PLATOONS.counter.offsetY);
    counterText.setText(String(army.size)).setPosition(left.x, left.y).setVisible(true);
  }

  return {
    draw(enemies, gates, enemyFx, army) {
      graphics.clear();
      for (const enemy of enemies) {
        if (!enemyFx.healthBars.has(enemy)) continue;
        const top = pawnTop(enemyFrame(enemy.type));
        drawHealthBar(enemy.x, enemy.z, enemy.size, top, enemy.hp, enemy.maxHp, FX.healthBar);
      }
      const { hero } = army;
      drawHealthBar(hero.x, hero.z, hero.size, pawnTop('hero'), hero.hp, hero.maxHp, HERO.healthBar);
      drawGateSigns(gates);
      drawArmyCounter(army);
      drawDamageNumbers(enemyFx);
    },
  };
}

// Sotto 1 (colpi sui corazzati) si mostra un decimale, così il numero non scrive mai zero
function formatDamage(value) {
  return value < 1 ? value.toFixed(1) : String(Math.round(value));
}
