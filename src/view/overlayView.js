import { CAMERA, ENEMIES, FX, GATES } from '../config/balance.js';

// Davanti a tutto: barra della vita sui nemici colpiti, numeri del danno che salgono e sfumano,
// insegna "+N" sui cancelli. Le scritte sono oggetti Text riusati: se ne crea una nuova solo quando ne servono di più
export function createOverlayView(scene, camera) {
  const graphics = scene.add.graphics();
  const numberTexts = [];
  const signTexts = [];
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
    return texts[index] ?? (texts[index] = scene.add.text(0, 0, '', style).setOrigin(0.5));
  }

  function hideFrom(texts, count) {
    for (let index = count; index < texts.length; index++) texts[index].setVisible(false);
  }

  function drawHealthBar(enemy) {
    const { width, height, offsetY, colors } = FX.healthBar;
    const y = ENEMIES.size + offsetY;
    if (!inFront(y, enemy.z)) return;
    const screenWidth = projectSpan(enemy.x, y, enemy.z, width);
    const screenHeight = (height * screenWidth) / width;
    const top = left.y - screenHeight / 2;
    graphics.fillStyle(colors.back);
    graphics.fillRect(left.x, top, screenWidth, screenHeight);
    graphics.fillStyle(colors.fill);
    graphics.fillRect(left.x, top, (screenWidth * Math.max(0, enemy.hp)) / enemy.maxHp, screenHeight);
  }

  function drawDamageNumbers(enemyFx) {
    const { durationMs, rise, minScale, style } = FX.damageNumber;
    enemyFx.damageNumbers.forEach((number, index) => {
      const text = textAt(numberTexts, index, style);
      const progress = number.elapsedMs / durationMs;
      const y = ENEMIES.size + rise * progress;
      if (!inFront(y, number.z)) {
        text.setVisible(false);
        return;
      }
      const span = projectSpan(number.x, y, number.z, ENEMIES.size);
      text
        .setText(`-${number.value}`)
        .setPosition((left.x + right.x) / 2, left.y)
        .setScale(Math.max(minScale, span / ENEMIES.size))
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

  return {
    draw(enemies, gates, enemyFx) {
      graphics.clear();
      for (const enemy of enemies) {
        if (enemyFx.healthBars.has(enemy)) drawHealthBar(enemy);
      }
      drawGateSigns(gates);
      drawDamageNumbers(enemyFx);
    },
  };
}
