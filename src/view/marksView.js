import { DEPTH, FX, SHIELD_RING, SHOTS, SMASH_ZONE } from '../config/balance.js';
import { BOSS_PHASES, warnProgress } from '../systems/boss.js';

// Segni a terra, sopra il campo e sotto le pedine: durante l'avviso la zona che il boss sta per schiacciare,
// rossa, che si riempie man mano che il colpo si avvicina, e subito dopo il colpo la stessa zona chiara che
// sfuma; l'ombra di ogni granata in volo, sotto di lei; lo scoppio delle granate, che sfuma; l'anello dello scudo
// attorno all'esercito finché dura; l'onda d'urto che si allarga, la scia del colpo perforante, i lampi dei colpi
// fermati dallo scudo e l'anello del fuoco rapido attorno al suo eroe, che sfuma nell'ultimo tratto; il cerchio
// giallo dove si è appena aperto uno scrigno; il disco azzurro sotto i nemici frenati a campo fermo.
// Un segno che finirebbe in parte dietro la telecamera non si disegna (succede solo con telecamere estreme)
export function createMarksView(scene, camera) {
  const graphics = scene.add.graphics().setDepth(DEPTH.marks);
  const points = Array.from({ length: SMASH_ZONE.segments }, () => ({ x: 0, y: 0 }));
  const near = { x: 0, y: 0 };
  const far = { x: 0, y: 0 };

  // Un cerchio a terra, in prospettiva; null se il suo bordo più vicino è dietro la telecamera
  function outline({ x, z, radius }) {
    if (!camera.inFront(0, z - radius)) return null;
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
      if (!camera.inFront(0, grenade.z - half)) continue;
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

  const ring = { x: 0, z: 0, radius: 0 };

  // Più è frenato, più il disco si vede
  function drawBrakes(enemies) {
    const { color, maxAlpha, radiusShare, minBrake } = FX.brake;
    for (const enemy of enemies) {
      if (enemy.brake < minBrake) continue;
      ring.x = enemy.x;
      ring.z = enemy.z;
      ring.radius = enemy.size * radiusShare;
      fillCircle(ring, color, maxAlpha * enemy.brake);
    }
  }

  function drawChestOpens(chestFx) {
    const { burstMs, burstRadius, color, alpha } = FX.chestOpen;
    for (const open of chestFx.opens) {
      if (open.elapsedMs >= burstMs) continue;
      ring.x = open.x;
      ring.z = open.z;
      ring.radius = burstRadius;
      fillCircle(ring, color, alpha * (1 - open.elapsedMs / burstMs));
    }
  }
  const quad = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));

  // Anello attorno a tutta la folla, a margin dal suo bordo più lontano dal punto guidato
  function drawShield(abilities, army) {
    if (abilities.shieldMs <= 0) return;
    const { color, fillAlpha, ringWidth, ringAlpha, margin } = SHIELD_RING;
    ring.x = army.x;
    ring.z = 0;
    ring.radius = Math.max(army.left, army.right, army.front, -army.back) + margin;
    const shape = outline(ring);
    if (shape === null) return;
    graphics.fillStyle(color, fillAlpha);
    graphics.fillPoints(shape, true);
    graphics.lineStyle(ringWidth, color, ringAlpha);
    graphics.strokePoints(shape, true);
  }

  function drawAbilities(heroFx) {
    const { shockwave, pierce, shield } = FX;
    for (const wave of heroFx.waves) {
      const progress = wave.elapsedMs / shockwave.durationMs;
      ring.x = wave.x;
      ring.z = wave.z;
      ring.radius = wave.radius * progress;
      const shape = outline(ring);
      if (shape === null) continue;
      graphics.lineStyle(shockwave.ringWidth, shockwave.color, shockwave.alpha * (1 - progress));
      graphics.strokePoints(shape, true);
    }
    // La scia è un rettangolo a terra lungo la colonna del colpo perforante, in prospettiva
    for (const streak of heroFx.streaks) {
      const progress = streak.elapsedMs / pierce.durationMs;
      if (!camera.inFront(0, streak.z)) continue;
      const { x, z, radius, length } = streak;
      camera.project(x - radius, 0, z, quad[0]);
      camera.project(x + radius, 0, z, quad[1]);
      camera.project(x + radius, 0, z + length, quad[2]);
      camera.project(x - radius, 0, z + length, quad[3]);
      graphics.fillStyle(pierce.color, pierce.alpha * (1 - progress));
      graphics.fillPoints(quad, true);
    }
    for (const block of heroFx.blocks) {
      fillCircle(block, shield.color, shield.alpha * (1 - block.elapsedMs / shield.blockMs));
    }
    for (const boost of heroFx.boosts) drawBoost(boost);
  }

  function drawBoost(boost) {
    const { color, fillAlpha, ringWidth, ringAlpha, fadeMs } = FX.rapidFire;
    ring.x = boost.hero.x;
    ring.z = boost.hero.z;
    ring.radius = boost.radius;
    const shape = outline(ring);
    if (shape === null) return;
    const fade = Math.min(1, (boost.length - boost.elapsedMs) / fadeMs);
    graphics.fillStyle(color, fillAlpha * fade);
    graphics.fillPoints(shape, true);
    graphics.lineStyle(ringWidth, color, ringAlpha * fade);
    graphics.strokePoints(shape, true);
  }

  return {
    draw({ boss, grenades, enemyFx, weaponFx, abilities, army, heroFx, chestFx, enemies }) {
      graphics.clear();
      drawBoss(boss, enemyFx);
      if (FX.enabled) drawBrakes(enemies);
      drawShadows(grenades);
      drawBlasts(weaponFx);
      drawChestOpens(chestFx);
      drawShield(abilities, army);
      drawAbilities(heroFx);
    },
  };
}
