import { CAMERA, DEPTH, FX, SMASH_ZONE } from '../config/balance.js';
import { BOSS_PHASES, warnProgress } from '../systems/boss.js';

// Segni a terra del boss, sopra il campo e sotto le pedine: durante l'avviso la zona che sta per schiacciare,
// rossa, che si riempie man mano che il colpo si avvicina; subito dopo il colpo la stessa zona chiara che sfuma.
// Una zona che finirebbe in parte dietro la telecamera non si disegna (succede solo con telecamere estreme)
export function createSmashView(scene, camera) {
  const graphics = scene.add.graphics().setDepth(DEPTH.marks);
  const points = Array.from({ length: SMASH_ZONE.segments }, () => ({ x: 0, y: 0 }));

  // Il cerchio della zona, a terra, in prospettiva; null se il suo bordo più vicino è dietro la telecamera
  function outline({ x, z, radius }) {
    if (camera.depthOf(0, z - radius) <= CAMERA.nearDepth) return null;
    points.forEach((point, index) => {
      const angle = (index / points.length) * Math.PI * 2;
      camera.project(x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius, point);
    });
    return points;
  }

  return {
    draw(boss, enemyFx) {
      graphics.clear();
      const shape = boss.enemy !== null && boss.phase === BOSS_PHASES.warn ? outline(boss.zone) : null;
      if (shape !== null) {
        const { color, fillAlpha, ringWidth, ringAlpha } = SMASH_ZONE;
        graphics.fillStyle(color, fillAlpha.from + (fillAlpha.to - fillAlpha.from) * warnProgress(boss));
        graphics.fillPoints(shape, true);
        graphics.lineStyle(ringWidth, color, ringAlpha);
        graphics.strokePoints(shape, true);
      }
      const { smash } = enemyFx;
      const impact = smash.ms > 0 ? outline(smash) : null;
      if (impact !== null) {
        const { impactMs, color, alpha } = FX.bossSmash;
        graphics.fillStyle(color, (alpha * smash.ms) / impactMs);
        graphics.fillPoints(impact, true);
      }
    },
  };
}
