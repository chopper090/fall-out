import * as Phaser from 'phaser';
import { CAMERA, DEPTH, FX, GATES, PAWNS, PLATOONS, WEAPON } from '../config/balance.js';
import { createBoxDrawer } from './box.js';
import { PAWN_ATLAS, enemyFrame } from './pawns.js';

// Disegna pedine, colpi, scoppi e cancelli dal più lontano al più vicino lungo la strada: chi è davanti
// copre chi è dietro. Le pedine sono riquadri dell'atlante, in piedi e rivolte alla telecamera, appoggiate
// sul loro punto del terreno e grandi quanto vuole la loro distanza; i colpi volano a WEAPON.flightHeight.
// I cancelli restano scatole in prospettiva, ognuno nella sua grafica. Immagini, grafiche e record si riusano
export function createUnitsView(scene, camera, cameraX) {
  const records = [];
  const queue = [];
  const images = [];
  const gates = [];
  const point = { x: 0, y: 0 };

  // key: bordo più vicino lungo la strada, per l'ordine di disegno. lift: altezza da terra del punto
  // d'appoggio, grow: ingrandimento (scoppi). Un colpo si disegna sopra i soldati che sorvola
  function enqueue(frame, x, z, key, flash = false, lift = 0, grow = 1, alpha = 1, gate = null) {
    const record = records[queue.length] ?? (records[queue.length] = {});
    record.frame = frame;
    record.x = x;
    record.z = z;
    record.key = key;
    record.flash = flash;
    record.lift = lift;
    record.grow = grow;
    record.alpha = alpha;
    record.gate = gate;
    queue.push(record);
  }

  function enqueuePawn(frame, x, z, size, flash) {
    enqueue(frame, x, z, z - size / 2, flash);
  }

  // Scoppio: la pedina di chi è morto che cresce e sfuma
  function enqueuePop(frame, pop, size) {
    const progress = pop.elapsedMs / FX.death.durationMs;
    const grow = 1 + FX.death.growth * progress;
    enqueue(frame, pop.x, pop.z, pop.z - (size * grow) / 2, false, 0, grow, 1 - progress);
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
    if (record.flash) image.setTint(FX.hitFlash.tint).setTintMode(Phaser.TintModes.FILL);
    else image.clearTint();
  }

  // Due pali ai lati e poi la trave in alto che fa da insegna: la trave copre sempre la cima dei pali
  function showGate({ gate, flash }, depth, index) {
    const view = gates[index] ?? (gates[index] = createGateGraphics());
    const { width, depth: gateDepth, postWidth, postHeight, beamHeight } = GATES;
    const colors = flash ? FX.hitFlash.colors : GATES.colors;
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

  function hideFrom(items, count, get) {
    for (let index = count; index < items.length; index++) get(items[index]).setVisible(false);
  }

  return {
    draw(army, projectiles, enemies, gateList, enemyFx, gateFx, armyFx) {
      queue.length = 0;
      const { hero } = army;
      enqueuePawn('hero', hero.x, hero.z, hero.size, false);
      for (const soldier of army.soldiers) enqueuePawn('soldier', soldier.x, soldier.z, soldier.size, false);
      for (const enemy of enemies) enqueuePawn(enemyFrame(enemy.type), enemy.x, enemy.z, enemy.size, enemyFx.flashes.has(enemy));
      const shotKey = WEAPON.size / 2 + PLATOONS.soldierSize;
      for (const shot of projectiles) enqueue('shot', shot.x, shot.z, shot.z - shotKey, false, WEAPON.flightHeight);
      for (const pop of enemyFx.pops) enqueuePop(enemyFrame(pop.type), pop, pop.type.size);
      for (const pop of armyFx.pops) enqueuePop('soldier', pop, PLATOONS.soldierSize);
      for (const gate of gateList) {
        enqueue(null, gate.x, gate.z, gate.z - GATES.depth / 2, gateFx.flashes.has(gate), 0, 1, 1, gate);
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
