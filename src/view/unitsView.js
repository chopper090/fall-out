import { ENEMIES, FX, GATES, HERO, PLATOONS, WEAPON } from '../config/balance.js';
import { createBoxDrawer } from './box.js';

// Disegna esercito, colpi, nemici, scoppi e cancelli in ordine di profondità, dal più lontano al più vicino:
// così chi è davanti copre chi è dietro. I record della coda si riusano a ogni frame
export function createUnitsView(graphics, camera, cameraX) {
  const drawBox = createBoxDrawer(graphics, camera, cameraX);
  const records = [];
  const queue = [];
  const armyItems = [];
  const shotsByHero = [];
  const shotsOver = [];
  const popItems = [];
  let popCount = 0;

  // Due scatole alla stessa distanza ma affiancate: la più lontana di lato dalla telecamera sta dietro.
  // Negli altri casi va prima quella più avanti lungo la strada. Tra due colpi, piccoli e alla stessa
  // altezza, conta solo la distanza lungo la strada
  const byDepth = (a, b) => {
    if (a.kind === 'shot' && b.kind === 'shot') return b.z - a.z;
    const sideBySide = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 && Math.abs(a.x - b.x) >= (a.width + b.width) / 2;
    if (sideBySide) return Math.abs(b.x - cameraX) - Math.abs(a.x - cameraX);
    return b.z - a.z;
  };
  const shotsByDepth = (a, b) => b.z - a.z;

  // Distanza di lato tra la telecamera e una scatola larga 2 * half (zero se la telecamera le sta davanti)
  const lateralGap = (x, half) => Math.max(0, Math.abs(x - cameraX) - half);

  function enqueue(x, y, z, width, height, depth, colors, kind = 'box', army = null) {
    const record = records[queue.length] ?? (records[queue.length] = {});
    record.x = x;
    record.y = y;
    record.z = z;
    record.width = width;
    record.height = height;
    record.depth = depth;
    record.colors = colors;
    record.kind = kind;
    record.army = army;
    queue.push(record);
  }

  function enqueueCube(x, y, z, size, colors, kind) {
    enqueue(x, y, z, size, size, size, colors, kind);
  }

  // Il cancello entra in coda come un oggetto unico: le sue parti si disegnano sempre nello stesso ordine
  function enqueueGate(gate, colors) {
    const { width, depth, postHeight, beamHeight } = GATES;
    enqueue(gate.x, 0, gate.z, width, postHeight + beamHeight, depth, colors, 'gate');
  }

  // Anche l'esercito entra in coda come un oggetto unico, grande quanto tutta la folla in questo momento.
  // I colpi ancora sopra la folla si disegnano insieme a lei: prima dell'eroe quelli che lui può coprire
  // (davanti a lui o dalla sua parte lontana dalla telecamera), dopo tutti gli altri.
  // Gli scoppi dentro la folla (soldati morti, nemici che si scontrano) si ordinano con i soldati
  function enqueueArmy(army, projectiles, enemyFx, armyFx) {
    const half = PLATOONS.soldierSize / 2;
    let left = army.x - HERO.size / 2;
    let right = army.x + HERO.size / 2;
    let back = -HERO.size / 2;
    let front = HERO.size / 2;
    for (const { x, z } of army.soldiers) {
      left = Math.min(left, x - half);
      right = Math.max(right, x + half);
      back = Math.min(back, z - half);
      front = Math.max(front, z + half);
    }
    enqueue((left + right) / 2, 0, (back + front) / 2, right - left, HERO.size, front - back, HERO.colors, 'army', army);

    shotsByHero.length = 0;
    shotsOver.length = 0;
    const halfShot = WEAPON.size / 2;
    const heroBand = (HERO.size + WEAPON.size) / 2;
    const heroGap = lateralGap(army.x, HERO.size / 2);
    for (const shot of projectiles) {
      if (shot.z - halfShot >= front) enqueueCube(shot.x, WEAPON.flightHeight, shot.z, WEAPON.size, WEAPON.colors, 'shot');
      else if (shot.z > -heroBand && (Math.abs(shot.x - army.x) < heroBand || lateralGap(shot.x, halfShot) > heroGap)) {
        shotsByHero.push(shot);
      } else shotsOver.push(shot);
    }

    popCount = 0;
    armyItems.length = 0;
    for (const soldier of army.soldiers) armyItems.push(soldier);
    for (const pop of armyFx.pops) armyItems.push(popItem(pop, PLATOONS.soldierSize, HERO.colors));
    for (const pop of enemyFx.pops) {
      const item = popItem(pop, ENEMIES.size, ENEMIES.colors);
      const half = item.size / 2;
      const inCrowd = item.z - half < front && item.z + half > back && item.x - half < right && item.x + half > left;
      if (inCrowd) armyItems.push(item);
      else enqueueCube(item.x, 0, item.z, item.size, item.colors);
    }
  }

  // Scoppio che cresce, riusato a ogni frame
  function popItem(pop, baseSize, colors) {
    const item = popItems[popCount] ?? (popItems[popCount] = {});
    popCount += 1;
    item.x = pop.x;
    item.z = pop.z;
    item.size = baseSize * (1 + FX.death.growth * (pop.elapsedMs / FX.death.durationMs));
    item.colors = colors;
    return item;
  }

  // Due pali ai lati e poi la trave in alto che fa da insegna: la trave copre sempre la cima dei pali
  function drawGate({ x, z, colors }) {
    const { width, depth, postWidth, postHeight, beamHeight } = GATES;
    const postOffset = (width - postWidth) / 2;
    drawBox(x - postOffset, 0, z, postWidth, postHeight, depth, colors);
    drawBox(x + postOffset, 0, z, postWidth, postHeight, depth, colors);
    drawBox(x, postHeight, z, width, beamHeight, depth, colors);
  }

  // Ordine dentro la folla, scoppi compresi: prima chi sta davanti all'eroe, poi chi è al suo fianco
  // più lontano di lui dalla telecamera, i colpi che l'eroe può coprire, l'eroe, chi è al suo fianco
  // più vicino alla telecamera, chi sta dietro e infine gli altri colpi: volano più in alto dei soldati,
  // quindi nessun soldato li copre. In ogni gruppo si va dalla fila più avanti alla più indietro
  // e, nella stessa fila, dal più lontano di lato
  function drawArmy(army) {
    const heroGap = lateralGap(army.x, HERO.size / 2);
    const group = (item) => {
      const heroReach = (HERO.size + item.size) / 2;
      if (item.z >= heroReach) return 0;
      if (item.z <= -heroReach) return 4;
      return lateralGap(item.x, item.size / 2) > heroGap ? 1 : 3;
    };
    const sideDistance = (item) => Math.abs(item.x - cameraX);
    armyItems.sort((a, b) => group(a) - group(b) || b.z - a.z || sideDistance(b) - sideDistance(a));

    const drawHero = () => {
      shotsByHero.sort(shotsByDepth);
      for (const shot of shotsByHero) drawShot(shot);
      drawBox(army.x, 0, 0, HERO.size, HERO.size, HERO.size, HERO.colors);
    };
    let heroDrawn = false;
    for (const item of armyItems) {
      if (!heroDrawn && group(item) > 1) {
        drawHero();
        heroDrawn = true;
      }
      drawBox(item.x, 0, item.z, item.size, item.size, item.size, item.colors ?? HERO.colors);
    }
    if (!heroDrawn) drawHero();
    shotsOver.sort(shotsByDepth);
    for (const shot of shotsOver) drawShot(shot);
  }

  function drawShot(shot) {
    drawBox(shot.x, WEAPON.flightHeight, shot.z, WEAPON.size, WEAPON.size, WEAPON.size, WEAPON.colors);
  }

  return {
    draw(army, projectiles, enemies, gates, enemyFx, gateFx, armyFx) {
      queue.length = 0;
      enqueueArmy(army, projectiles, enemyFx, armyFx);
      for (const enemy of enemies) {
        enqueueCube(enemy.x, 0, enemy.z, ENEMIES.size, enemyFx.flashes.has(enemy) ? FX.hitFlash.colors : ENEMIES.colors);
      }
      for (const gate of gates) enqueueGate(gate, gateFx.flashes.has(gate) ? FX.hitFlash.colors : GATES.colors);

      queue.sort(byDepth);
      graphics.clear();
      for (const r of queue) {
        if (r.kind === 'army') drawArmy(r.army);
        else if (r.kind === 'gate') drawGate(r);
        else drawBox(r.x, r.y, r.z, r.width, r.height, r.depth, r.colors);
      }
    },
  };
}
