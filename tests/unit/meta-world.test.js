import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  VILLAGE,
  WORLD,
  WORLD_CELLS,
  WORLD_VIEW,
  areaRect,
  createProfile,
  createRng,
  gateCells,
  inTerritory,
  iso,
  lockedAreas,
  overlaps,
  placing,
  profileFrom,
  villageModule,
  villageRect,
} from '../support/suite.js';

// 150. Il quadrato: 5 × 5 aree di 7 × 7 celle, il villaggio al centro, le altre 24 chiuse senza toccarlo e tutte
// diverse; la porta sul lato est, a metà, con la cella dentro nel territorio e quella fuori no
test('150. Il quadrato: 5 × 5 aree di 7 × 7 celle, il villaggio al centro, le altre 24 chiuse...', async (t) => {
  const check = checker(t);
  const village = villageRect();
  const locked = lockedAreas();
  const rects = locked.map(areaRect);
  const apart = rects.every((rect) => !overlaps(rect, village));
  const distinct = new Set(locked.map(({ col, row }) => `${col},${row}`)).size === locked.length;
  const covered = rects.reduce((sum, rect) => sum + rect.cols * rect.rows, 0) + village.cols * village.rows;
  const { inside, outside } = gateCells();
  const insideOk = inTerritory({ ...inside, cols: 1, rows: 1 }, 0);
  const outsideOut = !inTerritory({ ...outside, cols: 1, rows: 1 }, 0);
  check(
    `mondo: ${WORLD_CELLS}×${WORLD_CELLS} celle, villaggio ${JSON.stringify(village)}, aree chiuse ${locked.length} (fuori dal villaggio ${apart}, diverse ${distinct}, celle in tutto ${covered}); porta dentro ${JSON.stringify(inside)} ${insideOk}, fuori ${JSON.stringify(outside)} ${outsideOut}`,
    WORLD_CELLS === WORLD.areas * WORLD.areaCells &&
      locked.length === WORLD.areas ** 2 - 1 &&
      apart &&
      distinct &&
      covered === WORLD_CELLS ** 2 &&
      village.col === 2 * WORLD.areaCells &&
      insideOk &&
      outsideOut &&
      inside.col === village.col + village.cols - 1 &&
      outside.col === inside.col + 1 &&
      inside.row === village.row + WORLD.gate.at,
  );
  check.done();
});

// 151. Isometria: griglia → mondo → griglia torna uguale; il centro di una cella cade nella cella; il rombo del mondo
// è largo il doppio di quanto è alto; la sagoma di una scatola contiene il suo centro e la sua cima, non un punto fuori
test('151. Isometria: griglia → mondo → griglia torna uguale; il centro di una cella cade nel...', async (t) => {
  const check = checker(t);
  const rng = createRng(47);
  let worst = 0;
  for (let index = 0; index < 500; index++) {
    const col = rng.float() * WORLD_CELLS;
    const row = rng.float() * WORLD_CELLS;
    const world = iso.toWorld(col, row);
    const back = iso.toGrid(world.x, world.y);
    worst = Math.max(worst, Math.abs(back.col - col), Math.abs(back.row - row));
  }
  const center = iso.toWorld(10.5, 3.5);
  const grid = iso.toGrid(center.x, center.y);
  const cellOk = Math.floor(grid.col) === 10 && Math.floor(grid.row) === 3;
  const [north, east, south, west] = iso.rectCorners({ col: 0, row: 0, cols: WORLD_CELLS, rows: WORLD_CELLS });
  const height = WORLD_CELLS * WORLD_VIEW.tileHeight;
  const shape = east.x - west.x === iso.WORLD_WIDTH && south.y - north.y === height && iso.WORLD_WIDTH === 2 * height;
  const rect = { col: 15, row: 15, cols: 2, rows: 2 };
  const outline = iso.boxOutline(rect, 40);
  const middle = iso.rectCenter(rect);
  const inBox = iso.insidePolygon(outline, middle.x, middle.y) && iso.insidePolygon(outline, middle.x, middle.y - 40);
  const outBox =
    !iso.insidePolygon(outline, middle.x, middle.y - 200) && !iso.insidePolygon(outline, middle.x + 300, middle.y);
  check(
    `isometria: andata e ritorno scarto ${worst.toExponential(1)}; cella del centro ${cellOk}; rombo ${iso.WORLD_WIDTH}×${height} ${shape}; sagoma dentro ${inBox}, fuori ${outBox}`,
    worst < 1e-9 && cellOk && shape && inBox && outBox && iso.WORLD_WIDTH === WORLD_CELLS * WORLD_VIEW.tileWidth,
  );
  check.done();
});

// 152. Dove si può mettere un edificio: tutto nel territorio, non davanti alla porta, senza toccare gli altri (lui
// escluso, per spostarlo); il posto libero più vicino al centro (o a un punto) è giusto e sempre lo stesso
test('152. Dove si può mettere un edificio: tutto nel territorio, non davanti alla porta, sen...', async (t) => {
  const check = checker(t);
  const { canPlace, freeSpot } = placing;
  const v = villageRect();
  const empty = createProfile().village.positions;
  const corner = canPlace(empty, 'farm', { col: v.col, row: v.row });
  const lastCorner = canPlace(empty, 'farm', { col: v.col + v.cols - 2, row: v.row + v.rows - 2 });
  const out = canPlace(empty, 'farm', { col: v.col - 1, row: v.row });
  const over = canPlace(empty, 'barracks', { col: v.col + v.cols - 2, row: v.row });
  const { inside } = gateCells();
  const gate = canPlace(empty, 'farm', { col: inside.col - 1, row: inside.row });
  const withFarm = { ...empty, farm: { col: v.col + 2, row: v.row + 2 } };
  const touching = canPlace(withFarm, 'forge', { col: v.col + 3, row: v.row + 3 });
  const beside = canPlace(withFarm, 'forge', { col: v.col + 4, row: v.row + 2 });
  const itself = canPlace(withFarm, 'farm', { col: v.col + 3, row: v.row + 2 });
  const spot = freeSpot(empty, 'barracks');
  const again = freeSpot(empty, 'barracks');
  const spotOk = canPlace(empty, 'barracks', spot);
  // Il più vicino al centro: nessun altro posto valido ha il centro più vicino
  const centerOf = (cell) => ({ col: cell.col + 1.5, row: cell.row + 1 });
  const target = { col: v.col + v.cols / 2, row: v.row + v.rows / 2 };
  const distance = (cell) => (centerOf(cell).col - target.col) ** 2 + (centerOf(cell).row - target.row) ** 2;
  let closer = 0;
  for (let row = v.row; row < v.row + v.rows; row++) {
    for (let col = v.col; col < v.col + v.cols; col++) {
      if (canPlace(empty, 'barracks', { col, row }) && distance({ col, row }) < distance(spot) - 1e-9) closer += 1;
    }
  }
  const nearCorner = freeSpot(empty, 'farm', { col: v.col, row: v.row });
  check(
    `posti: angolo ${corner}, angolo opposto ${lastCorner}, fuori ${out}, a cavallo del bordo ${over}, davanti alla porta ${gate}; contro la fattoria ${touching}, accanto ${beside}, su sé stessa spostata ${itself}; posto libero della caserma ${JSON.stringify(spot)} (valido ${spotOk}, uguale ${JSON.stringify(again) === JSON.stringify(spot)}, più vicini ${closer}); vicino all'angolo ${JSON.stringify(nearCorner)}`,
    corner &&
      lastCorner &&
      !out &&
      !over &&
      !gate &&
      !touching &&
      beside &&
      itself &&
      spotOk &&
      closer === 0 &&
      JSON.stringify(again) === JSON.stringify(spot) &&
      nearCorner.col === v.col &&
      nearCorner.row === v.row,
  );
  check.done();
});

// 153. Mettere e spostare: il primo livello si paga e apre il cantiere lì; non due volte, non con un altro cantiere
// aperto, non senza risorse, non dove non ci sta; senza posto non si migliora; spostare è gratis e non tocca livello
// né cantiere; non si sposta su un altro edificio né un edificio non messo
test('153. Mettere e spostare: il primo livello si paga e apre il cantiere lì; non due volte,...', async (t) => {
  const check = checker(t);
  const { placeBuilding, moveBuilding, freeSpot } = placing;
  const v = villageRect();
  const p = createProfile();
  const before = p.resources.materials;
  const unplaced = villageModule.startUpgrade(p, 'farm', 0);
  const bad = placeBuilding(p, 'farm', { col: v.col - 2, row: v.row }, 0);
  const cell = { col: v.col + 1, row: v.row + 1 };
  const placed = placeBuilding(p, 'farm', cell, 0);
  const paid = before - p.resources.materials;
  const job = p.village.construction?.building;
  const twice = placeBuilding(p, 'farm', { col: v.col + 4, row: v.row + 4 }, 0);
  const busy = placeBuilding(p, 'forge', { col: v.col + 4, row: v.row + 4 }, 0);
  const busyPosition = p.village.positions.forge;
  const moved = moveBuilding(p, 'farm', { col: v.col + 4, row: v.row + 1 });
  const after = { ...p.village.positions.farm };
  const keep =
    p.village.construction?.building === 'farm' &&
    p.village.levels.farm === 0 &&
    p.resources.materials === before - paid;
  const ghostMove = moveBuilding(p, 'forge', { col: v.col, row: v.row + 4 });
  const q = createProfile();
  q.resources.materials = 0;
  const poor = placeBuilding(q, 'farm', cell, 0);
  const r = createProfile();
  r.resources.materials = 1000;
  r.resources.scrap = 1000;
  placeBuilding(r, 'farm', cell, 0);
  r.village.construction = null;
  const onTop = moveBuilding(r, 'farm', cell);
  placeBuilding(r, 'forge', freeSpot(r.village.positions, 'forge'), 0);
  const blocked = moveBuilding(r, 'forge', cell);
  check(
    `mettere: senza posto ${unplaced}, fuori ${bad}, al suo posto ${placed} (pagati ${paid}, cantiere ${job}), di nuovo ${twice}, con un altro cantiere ${busy} (posto ${busyPosition}); spostata ${moved} in ${JSON.stringify(after)} senza cambiare il resto ${keep}; spostare un edificio non messo ${ghostMove}; senza materiali ${poor}; sullo stesso posto ${onTop}; sopra un altro ${blocked}`,
    !unplaced &&
      !bad &&
      placed &&
      paid === VILLAGE.buildings.farm.costs[0].materials &&
      job === 'farm' &&
      !twice &&
      !busy &&
      busyPosition === null &&
      moved &&
      after.col === v.col + 4 &&
      keep &&
      !ghostMove &&
      !poor &&
      onTop &&
      !blocked,
  );
  check.done();
});

// 154. Profilo: chi comincia non ha edifici messi; i posti salvati si tengono se ci stanno, uno dopo l'altro; quelli
// sbagliati (fuori, sovrapposti, non interi) prendono il primo posto libero vicino al centro; un edificio da costruire
// e senza cantiere non ha posto; un posto rotto non sposta gli edifici che stavano bene; un salvataggio di prima del
// 4.7 (livelli senza posti) mette da solo gli edifici costruiti e quello in cantiere, senza sovrapporli, sempre allo
// stesso modo
test('154. Profilo: chi comincia non ha edifici messi; i posti salvati si tengono se ci stann...', async (t) => {
  const check = checker(t);
  const { canPlace, footprint } = placing;
  const v = villageRect();
  const fresh = createProfile().village.positions;
  const kept = profileFrom({
    village: {
      levels: { farm: 2, barracks: 1, forge: 0 },
      positions: {
        farm: { col: v.col, row: v.row },
        barracks: { col: v.col + 3, row: v.row + 4 },
        forge: { col: v.col, row: v.row + 4 },
      },
    },
  }).village.positions;
  const wrong = profileFrom({
    village: {
      levels: { farm: 1, barracks: 1, forge: 1 },
      positions: {
        farm: { col: 0, row: 0 },
        barracks: { col: v.col, row: v.row },
        forge: { col: v.col + 1, row: v.row + 1.5 },
      },
    },
  }).village;
  const separate = (positions) => {
    const ids = Object.keys(positions).filter((id) => positions[id] !== null);
    return ids.every((a) =>
      ids.every((b) => a === b || !overlaps(footprint(a, positions[a]), footprint(b, positions[b]))),
    );
  };
  const wrongOk = Object.entries(wrong.positions).every(([id, at]) => at !== null && canPlace(wrong.positions, id, at));
  const legacy = {
    levels: { farm: 3, barracks: 0, forge: 1 },
    construction: { building: 'barracks', endsAt: 99, challenged: false },
  };
  const first = profileFrom({ village: legacy }).village.positions;
  const second = profileFrom({ village: legacy }).village.positions;
  const legacyOk =
    first.farm !== null &&
    first.forge !== null &&
    first.barracks !== null &&
    separate(first) &&
    JSON.stringify(first) === JSON.stringify(second);
  const keepGood = profileFrom({
    village: {
      levels: { farm: 1, barracks: 1, forge: 1 },
      positions: { farm: { col: 0, row: 0 }, barracks: { col: 16, row: 17 }, forge: { col: 14, row: 14 } },
    },
  }).village.positions;
  const goodKept =
    keepGood.barracks.col === 16 &&
    keepGood.barracks.row === 17 &&
    keepGood.forge.col === 14 &&
    keepGood.farm !== null &&
    separate(keepGood);
  const notBuilt = profileFrom({ village: { levels: { farm: 0 }, positions: { farm: { col: v.col, row: v.row } } } })
    .village.positions;
  check(
    `posti nel profilo: da zero ${JSON.stringify(fresh)}; tenuti ${JSON.stringify(kept)}; sbagliati rifatti ${JSON.stringify(wrong.positions)} (validi ${wrongOk}, separati ${separate(wrong.positions)}); prima del 4.7 ${JSON.stringify(first)} (${legacyOk}); un posto rotto non sposta gli altri ${JSON.stringify(keepGood)} ${goodKept}; da costruire ${JSON.stringify(notBuilt.farm)}`,
    Object.values(fresh).every((at) => at === null) &&
      kept.farm.col === v.col &&
      kept.barracks.col === v.col + 3 &&
      kept.forge === null &&
      wrongOk &&
      separate(wrong.positions) &&
      wrong.positions.barracks.col === v.col &&
      legacyOk &&
      notBuilt.farm === null &&
      goodKept,
  );
  check.done();
});

// 155. Il villaggio salvato e riletto (come fa il salvataggio sul telefono) tiene i posti
test('155. Il villaggio salvato e riletto (come fa il salvataggio sul telefono) tiene i posti', async (t) => {
  const check = checker(t);
  const p = createProfile();
  p.resources.materials = 1000;
  p.resources.scrap = 1000;
  const v = villageRect();
  placing.placeBuilding(p, 'forge', { col: v.col + 2, row: v.row + 3 }, 0);
  const back = profileFrom(JSON.parse(JSON.stringify(p))).village;
  const same =
    JSON.stringify(back.positions) === JSON.stringify(p.village.positions) && back.construction?.building === 'forge';
  check(`posti salvati e riletti: ${JSON.stringify(back.positions)} ${same}`, same);
  check.done();
});
