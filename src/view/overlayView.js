import { CAMERA, ENEMIES, FX } from '../config/balance.js';

// Sopra ai nemici, davanti a tutto: barra della vita dopo un colpo e numeri del danno che salgono e sfumano.
// Le scritte sono oggetti Text riusati: se ne crea una nuova solo quando ne servono di più
export function createOverlayView(scene, camera) {
  const graphics = scene.add.graphics();
  const texts = [];
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

  function textAt(index) {
    return texts[index] ?? (texts[index] = scene.add.text(0, 0, '', FX.damageNumber.style).setOrigin(0.5));
  }

  return {
    draw(enemies, enemyFx) {
      graphics.clear();
      for (const enemy of enemies) {
        if (enemyFx.healthBars.has(enemy)) drawHealthBar(enemy);
      }

      const { durationMs, rise, minScale } = FX.damageNumber;
      enemyFx.damageNumbers.forEach((number, index) => {
        const progress = number.elapsedMs / durationMs;
        const y = ENEMIES.size + rise * progress;
        if (!inFront(y, number.z)) {
          textAt(index).setVisible(false);
          return;
        }
        const span = projectSpan(number.x, y, number.z, ENEMIES.size);
        textAt(index)
          .setText(`-${number.value}`)
          .setPosition((left.x + right.x) / 2, left.y)
          .setScale(Math.max(minScale, span / ENEMIES.size))
          .setAlpha(1 - progress)
          .setVisible(true);
      });
      for (let index = enemyFx.damageNumbers.length; index < texts.length; index++) texts[index].setVisible(false);
    },
  };
}
