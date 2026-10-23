import * as Phaser from 'phaser';
import { CAMERA, DEPTH, ENEMY_SHOT, FX, GATES, HERO, PAWNS, PLATOONS, SHOTS } from '../config/balance.js';
import { grenadeHeight } from '../systems/combat.js';
import { isMalus } from '../systems/gates.js';
import { createBoxDrawer } from './box.js';
import { PAWN_ATLAS, enemyFrame, heroFrame, shotFrame, soldierFrame } from './pawns.js';

// Disegna pedine, colpi, scoppi e cancelli dal più lontano al più vicino lungo la strada: chi è davanti
// copre chi è dietro. Le pedine sono riquadri dell'atlante, in piedi e rivolte alla telecamera, appoggiate
// sul loro punto del terreno e grandi quanto vuole la loro distanza; ogni soldato con la pedina della sua arma.
// I colpi dritti volano a SHOTS.flightHeight, le granate sul loro arco, quelli dei nemici a ENEMY_SHOT.flightHeight.
// Un nemico colpito lampeggia di bianco, un tiratore che spara di arancione.
// I cancelli restano scatole in prospettiva, ognuno nella sua grafica. Immagini, grafiche e record si riusano
export function createUnitsView(scene, camera, cameraX) {
  const records = [];
  const queue = [];
  const images = [];
  const gates = [];
  const point = { x: 0, y: 0 };
  // Colori dei cancelli, normali e mentre lampeggiano
  const palettes = {
    bonus: { normal: GATES.colors, flash: lighten(GATES.colors, FX.hitFlash.gateLighten) },
    malus: { normal: GATES.malusColors, flash: lighten(GATES.malusColors, FX.hitFlash.gateLighten) },
  };

  // key: bordo più vicino lungo la strada, per l'ordine di disegno. tint: colore del lampo, null se non
  // lampeggia (per i cancelli basta che non sia null: schiariscono i loro colori). lift: altezza da terra del punto
  // d'appoggio, grow: ingrandimento (scoppi) o rimpicciolimento (colpi a fine gittata), alpha: opacità (scoppi e
  // colpi a fine gittata).
  // Un colpo si disegna sopra i soldati che sorvola
  function enqueue(frame, x, z, key, tint = null, lift = 0, grow = 1, alpha = 1, gate = null) {
    const record = records[queue.length] ?? (records[queue.length] = {});
    record.frame = frame;
    record.x = x;
    record.z = z;
    record.key = key;
    record.tint = tint;
    record.lift = lift;
    record.grow = grow;
    record.alpha = alpha;
    record.gate = gate;
    queue.push(record);
  }

  function enqueuePawn(frame, x, z, size, tint = null) {
    enqueue(frame, x, z, z - size / 2, tint);
  }

  // Bianco se colpito, arancione se ha appena sparato
  function enemyTint(enemy, enemyFx) {
    if (enemyFx.flashes.has(enemy)) return FX.hitFlash.tint;
    if (enemyFx.muzzles.has(enemy)) return FX.muzzleFlash.tint;
    return null;
  }

  // Scoppio: la pedina di chi è morto che cresce e sfuma
  function enqueuePop(frame, pop, size) {
    const progress = pop.elapsedMs / FX.death.durationMs;
    const grow = 1 + FX.death.growth * progress;
    enqueue(frame, pop.x, pop.z, pop.z - (size * grow) / 2, null, 0, grow, 1 - progress);
  }

  function showPawn(record, depth, index) {
    const image = images[index] ?? (images[index] = scene.add.image(0, 0, PAWN_ATLAS, record.frame));
    if (image.frame.name !== record.frame) image.setFrame(record.frame);
    camera.project(record.x, 0, record.z, point);
    const scale = camera.scaleAt(0, record.z);
    image
      .setPosition(point.x, point.y - scale * record.lift)
      .setScale((scale * record.grow) / PAWNS.textureScale)
      .setAlpha(record.alpha)
      .setDepth(depth)
      .setVisible(true);
    if (record.tint !== null) image.setTint(record.tint).setTintMode(Phaser.TintModes.FILL);
    else image.clearTint();
  }

  // Due pali ai lati e poi la trave in alto che fa da insegna: la trave copre sempre la cima dei pali
  function showGate({ gate, tint }, depth, index) {
    const view = gates[index] ?? (gates[index] = createGateGraphics());
    const { width, depth: gateDepth, postWidth, postHeight, beamHeight } = GATES;
    const palette = isMalus(gate) ? palettes.malus : palettes.bonus;
    const colors = tint !== null ? palette.flash : palette.normal;
    const postOffset = (width - postWidth) / 2;
    view.graphics.clear().setDepth(depth).setVisible(true);
    view.drawBox(gate.x - postOffset, 0, gate.z, postWidth, postHeight, gateDepth, colors);
    view.drawBox(gate.x + postOffset, 0, gate.z, postWidth, postHeight, gateDepth, colors);
    view.drawBox(gate.x, postHeight, gate.z, width, beamHeight, gateDepth, colors);
  }

  function createGateGraphics() {
    const graphics = scene.add.graphics();
    return { graphics, drawBox: createBoxDrawer(graphics, camera, cameraX) };
  }

  // Quanto resta del colpo prima della fine della gittata, da 1 (fuori dall'ultima parte) a 0 (alla fine).
  // Con curve più grande di 1 il colpo resta pieno più a lungo e svanisce soprattutto verso la fine
  function fadeLeft({ z, weapon }) {
    const { share, curve } = SHOTS.fade;
    const fadeLength = weapon.range * share;
    if (fadeLength <= 0) return 1;
    const left = Math.min(1, Math.max(0, (weapon.range - z) / fadeLength));
    return 1 - (1 - left) ** curve;
  }

  function hideFrom(items, count, get) {
    for (let index = count; index < items.length; index++) get(items[index]).setVisible(false);
  }

  return {
    draw(army, projectiles, grenades, enemyShots, enemies, gateList, enemyFx, gateFx, armyFx) {
      queue.length = 0;
      for (const hero of army.heroes) enqueuePawn(heroFrame(hero), hero.x, hero.z, hero.size);
      for (const soldier of army.soldiers) enqueuePawn(soldierFrame(soldier.weapon), soldier.x, soldier.z, soldier.size);
      for (const enemy of enemies) enqueuePawn(enemyFrame(enemy.type), enemy.x, enemy.z, enemy.size, enemyTint(enemy, enemyFx));
      for (const shot of projectiles) {
        const key = shot.z - (shot.weapon.size / 2 + PLATOONS.soldierSize);
        const left = fadeLeft(shot);
        const grow = SHOTS.fade.minScale + (1 - SHOTS.fade.minScale) * left;
        enqueue(shotFrame(shot.weapon), shot.x, shot.z, key, null, SHOTS.flightHeight, grow, left);
      }
      for (const grenade of grenades) {
        const key = grenade.z - (grenade.weapon.size / 2 + PLATOONS.soldierSize);
        enqueue(shotFrame(grenade.weapon), grenade.x, grenade.z, key, null, grenadeHeight(grenade));
      }
      for (const shot of enemyShots) {
        enqueue('enemyShot', shot.x, shot.z, shot.z - ENEMY_SHOT.size / 2, null, ENEMY_SHOT.flightHeight);
      }
      for (const pop of enemyFx.pops) enqueuePop(enemyFrame(pop.type), pop, pop.type.size);
      for (const pop of armyFx.pops) {
        if (pop.hero !== null) enqueuePop(heroFrame(pop.hero), pop, HERO.size);
        else enqueuePop(soldierFrame(pop.weapon), pop, PLATOONS.soldierSize);
      }
      for (const gate of gateList) {
        const tint = gateFx.flashes.has(gate) ? FX.hitFlash.tint : null;
        enqueue(null, gate.x, gate.z, gate.z - GATES.depth / 2, tint, 0, 1, 1, gate);
      }

      // Stesso bordo vicino: resta l'ordine di arrivo (l'ordinamento è stabile)
      queue.sort((a, b) => b.key - a.key);
      let imageCount = 0;
      let gateCount = 0;
      queue.forEach((record, order) => {
        const depth = DEPTH.world + order;
        if (record.gate) showGate(record, depth, gateCount++);
        else if (camera.depthOf(0, record.z) > CAMERA.nearDepth) showPawn(record, depth, imageCount++);
      });
      hideFrom(images, imageCount, (image) => image);
      hideFrom(gates, gateCount, (view) => view.graphics);
    },
  };
}

// I tre colori di una scatola avvicinati al bianco di share (0 restano uguali, 1 tutti bianchi)
function lighten(colors, share) {
  const mix = (color) => {
    const channel = (shift) => {
      const value = (color >> shift) & 0xff;
      return Math.round(value + (0xff - value) * share) << shift;
    };
    return channel(16) | channel(8) | channel(0);
  };
  return { top: mix(colors.top), front: mix(colors.front), side: mix(colors.side) };
}
