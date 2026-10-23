import { CAMERA, DEPTH, FX, SHOTS, SMASH_ZONE } from '../config/balance.js';
import { BOSS_PHASES, warnProgress } from '../systems/boss.js';

// Segni a terra, sopra il campo e sotto le pedine: durante l'avviso la zona che il boss sta per schiacciare,
// rossa, che si riempie man mano che il colpo si avvicina, e subito dopo il colpo la stessa zona chiara che
// sfuma; l'ombra di ogni granata in volo, sotto di lei; lo scoppio delle granate, che sfuma.
// Un segno che finirebbe in parte dietro la telecamera non si disegna (succede solo con telecamere estreme)
export function createMarksView(scene, camera) {
  const graphics = scene.add.graphics().setDepth(DEPTH.marks);
  const points = Array.from({ length: SMASH_ZONE.segments }, () => ({ x: 0, y: 0 }));
  const near = { x: 0, y: 0 };
  const far = { x: 0, y: 0 };

  function inFront(z) {
    return camera.depthOf(0, z) > CAMERA.nearDepth;
  }

  // Un cerchio a terra, in prospettiva; null se il suo bordo più vicino è dietro la telecamera
  function outline({ x, z, radius }) {
    if (!inFront(z - radius)) return null;
    points.forEach((point, index) => {
      const angle = (index / points.length) * Math.PI * 2;
      camera.project(x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius, point);
    });
    return points;
  }

  function fillCircle(circle, color, alpha) {
    const shape = outline(circle);
    if (shape === null) return;
    graphics.fillStyle(color, alpha);
    graphics.fillPoints(shape, true);
  }

  function drawBoss(boss, enemyFx) {
    const shape = boss.enemy !== null && boss.phase === BOSS_PHASES.warn ? outline(boss.zone) : null;
    if (shape !== null) {
      const { color, fillAlpha, ringWidth, ringAlpha } = SMASH_ZONE;
      graphics.fillStyle(color, fillAlpha.from + (fillAlpha.to - fillAlpha.from) * warnProgress(boss));
      graphics.fillPoints(shape, true);
      graphics.lineStyle(ringWidth, color, ringAlpha);
      graphics.strokePoints(shape, true);
    }
    const { smash } = enemyFx;
    if (smash.ms > 0) fillCircle(smash, FX.bossSmash.color, (FX.bossSmash.alpha * smash.ms) / FX.bossSmash.impactMs);
  }

  // L'ombra è un'ellisse a terra larga quanto la granata, schiacciata dalla prospettiva come il terreno
  function drawShadows(grenades) {
    const { color, alpha } = SHOTS.shadow;
    graphics.fillStyle(color, alpha);
    for (const grenade of grenades) {
      const half = grenade.weapon.size / 2;
      if (!inFront(grenade.z - half)) continue;
      camera.project(grenade.x, 0, grenade.z - half, near);
      camera.project(grenade.x, 0, grenade.z + half, far);
      const width = camera.scaleAt(0, grenade.z) * grenade.weapon.size;
      graphics.fillEllipse(near.x, (near.y + far.y) / 2, width, near.y - far.y);
    }
  }

  function drawBlasts(weaponFx) {
    const { durationMs, color, alpha } = FX.blast;
    for (const blast of weaponFx.blasts) fillCircle(blast, color, alpha * (1 - blast.elapsedMs / durationMs));
  }

  return {
    draw(boss, grenades, enemyFx, weaponFx) {
      graphics.clear();
      drawBoss(boss, enemyFx);
      drawShadows(grenades);
      drawBlasts(weaponFx);
    },
  };
}
