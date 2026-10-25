import * as Phaser from 'phaser';
import { HUD, WORLD_VIEW } from '../config/balance.js';
import { WORLD_EVENTS, createEventBus } from '../core/events.js';
import { refreshSave, writeSave } from '../core/save.js';
import { HEROES } from '../data/heroes.js';
import { VILLAGE } from '../data/village.js';
import { WORLD } from '../data/world.js';
import { fadeFog, floatGain } from '../fx/worldFx.js';
import { ROAD_TILES, conqueredAreas, hereTile, isBattle, step } from '../meta/road.js';
import {
  canChallenge,
  canPlace,
  collectRations,
  footprint,
  freeSpot,
  moveBuilding,
  placeBuilding,
  settle,
  timeLeft,
} from '../meta/village.js';
import { WORLD_CELLS, areaRect, cellsOf, conquestAreas, inTerritory, villageRect } from '../meta/world.js';
import { boxOutline, insidePolygon, rectCenter, rectCorners, standingDepth, toGrid, toWorld } from '../view/iso.js';
import { createPawnAtlas } from '../view/pawns.js';
import { amountText, durationText } from '../view/words.js';
import {
  BUILDING_ATLAS,
  GROUND_TEXTURE,
  GROUND_TILES,
  buildingHeight,
  createWorldAtlas,
  siteFrame,
  siteHeight,
} from '../view/worldAtlas.js';
import {
  clampPoint,
  lookAt,
  panBy,
  screenToWorld,
  viewCenter,
  worldToScreen,
  zoomAround,
  zoomLimits,
} from '../view/worldCamera.js';
import { createRoadView, drawRoad, pawnAt, roadCellAt, tileSpot, walkPawn } from '../view/worldRoad.js';

const E = Phaser.Input.Events;

// Il mondo in isometria, in grigio (data/world.js): il grande quadrato di aree, il villaggio al centro con le sue mura
// e la porta, le aree conquistate che allargano il territorio, quella da conquistare nella nebbia leggera e le altre
// nella nebbia piena. Dalla porta parte la strada unica (meta/road.js, disegnata da view/worldRoad.js), con i segni
// delle caselle e il capo sulla casella dove si è. Gli edifici stanno al loro posto (il cantiere del primo livello
// finché non è finito), con il livello, quanto manca al cantiere e le razioni pronte della fattoria, che si raccolgono
// toccandole. Un dito trascina la vista, due dita (o la rotella) zoomano; toccando un edificio si apre la sua scheda,
// toccando la strada, il capo o la porta quella della strada. Per mettere o spostare un edificio (dal menu, dalla
// scheda, o tenendolo premuto) lo si trascina dove è verde e si conferma con ✓ (✗ annulla). Sopra, l'interfaccia
// (scenes/WorldUI.js), con cui si parla sul bus del mondo (WORLD_EVENTS). Ogni cambio si salva subito
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    createWorldAtlas(this.textures);
    createPawnAtlas(this.textures);
    this.save = this.registry.get('save');
    refreshSave(this.save);
    settle(this.save.profile, Date.now());
    // Di ritorno da una battaglia della strada si riapre la sua scheda, con l'area conquistata se c'è
    const back = this.registry.get('worldReturn') ?? null;
    this.registry.remove('worldReturn');
    this.bus = createEventBus();
    this.drawGround();
    this.drawWalls();
    this.drawFog(back?.conquest ?? null);
    this.villageObjects = [];
    this.overlays = [];
    this.placement = null;
    this.touches = new Map();
    this.press = null;
    this.pinch = null;
    this.leaving = false;
    this.setupCamera();
    this.setupInput();
    this.listen();
    this.drawVillage();
    this.road = createRoadView(this);
    drawRoad(this.road, this.save.profile);
    if (back !== null) this.focusPawn(false);
    this.scene.launch('WorldUI', { bus: this.bus, road: back !== null, conquest: back?.conquest ?? null });
    this.time.addEvent({ delay: HUD.world.tickMs, loop: true, callback: () => this.tick() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.leave());
  }

  // Il tempo scorre: se qualcosa che si vede è cambiato (un cantiere finito, una razione pronta) tutti si
  // ridisegnano, altrimenti cambiano solo i tempi scritti
  tick() {
    settle(this.save.profile, Date.now());
    if (this.state() === this.shown) this.bus.emit(WORLD_EVENTS.TICK);
    else this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
  }

  // Quello che cambia il villaggio disegnato e la sua interfaccia
  state() {
    const { village, resources } = this.save.profile;
    const ready = Math.floor(village.farm.stored);
    const challenge = canChallenge(this.save.profile, Date.now());
    const { levels, positions, construction } = village;
    return JSON.stringify([levels, positions, construction?.building ?? null, ready, resources, challenge]);
  }

  listen() {
    const on = (name, handler) => this.bus.on(name, handler);
    on(WORLD_EVENTS.WORLD_CHANGED, () => {
      this.drawVillage();
      drawRoad(this.road, this.save.profile);
    });
    on(WORLD_EVENTS.TICK, () => this.refreshTimers());
    on(WORLD_EVENTS.PLACE_REQUESTED, ({ id }) => this.startPlacement(id, false, true));
    on(WORLD_EVENTS.MOVE_REQUESTED, ({ id }) => this.startPlacement(id, true, true));
    on(WORLD_EVENTS.FOCUS_REQUESTED, ({ id }) => this.focus(id, true));
    on(WORLD_EVENTS.PAWN_FOCUS_REQUESTED, () => this.focusPawn(true));
    on(WORLD_EVENTS.STEP_REQUESTED, () => this.walk());
    on(WORLD_EVENTS.NAVIGATE, ({ scene, data }) => this.navigate(scene, data));
  }

  // Le aree conquistate
  conquered() {
    return conqueredAreas(this.save.profile.road);
  }

  // Si lascia il mondo per la scena scene, una volta sola: la vista si ricorda, per ritrovarla al ritorno
  navigate(scene, data) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    const center = viewCenter(cam);
    this.registry.set('worldView', { x: center.x, y: center.y, zoom: cam.zoom });
    this.scene.start(scene, data);
  }

  // Chiuso il mondo si chiude anche la sua interfaccia
  leave() {
    this.scene.stop('WorldUI');
  }

  // Terreno: una cella per casella di un TilemapLayer isometrico (si disegnano solo quelle in vista), sopra un rombo
  // pieno che copre le righine tra le celle; il territorio (il villaggio e le aree conquistate, tranne le celle troppo
  // vicine alle mura) ha il suo colore e la griglia, la strada il suo
  drawGround() {
    const { tileWidth, tileHeight, ground, depth } = WORLD_VIEW;
    const world = { col: 0, row: 0, cols: WORLD_CELLS, rows: WORLD_CELLS };
    const base = this.add.graphics().setDepth(depth.ground);
    base.fillStyle(ground.land);
    base.fillPoints(rectCorners(world), true);
    const data = new Phaser.Tilemaps.MapData({
      width: WORLD_CELLS,
      height: WORLD_CELLS,
      tileWidth,
      tileHeight,
      orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
    });
    const map = new Phaser.Tilemaps.Tilemap(this, data);
    const key = GROUND_TEXTURE;
    const tiles = map.addTilesetImage(key, key, tileWidth, tileHeight, ground.tileMargin, ground.tileSpacing);
    // Phaser mette ogni casella con l'angolo in alto a sinistra del suo riquadro: mezza cella a sinistra del vertice
    const north = toWorld(0, 0);
    const layer = map.createBlankLayer('ground', tiles, north.x - tileWidth / 2, north.y).setDepth(depth.ground);
    layer.fill(GROUND_TILES.land);
    const { col, row, cols, rows } = villageRect();
    layer.fill(GROUND_TILES.territory, col, row, cols, rows);
    const conquered = this.conquered();
    for (const area of conquestAreas().slice(0, conquered)) {
      for (const { col: x, row: y } of cellsOf(areaRect(area))) {
        if (inTerritory({ col: x, row: y, cols: 1, rows: 1 }, conquered)) layer.putTileAt(GROUND_TILES.territory, x, y);
      }
    }
    for (const tile of ROAD_TILES) layer.putTileAt(GROUND_TILES.road, tile.col, tile.row);
  }

  // Le mura sul bordo del villaggio, una cella alla volta: i lati nord e ovest dietro tutto, i pezzi dei lati est e
  // sud in ordine con le cose in piedi (quello che sta fuori, davanti a loro, li copre). Sul lato della porta un varco
  // largo una cella, con una torre per parte
  drawWalls() {
    const { walls, depth } = WORLD_VIEW;
    const back = this.add.graphics().setDepth(depth.backWalls);
    const { col, row, cols, rows } = villageRect();
    const half = walls.thickness / 2;
    const sides = {
      north: { front: false, along: 'col', at: row, from: col, to: col + cols },
      west: { front: false, along: 'row', at: col, from: row, to: row + rows },
      east: { front: true, along: 'row', at: col + cols, from: row, to: row + rows },
      south: { front: true, along: 'col', at: row + rows, from: col, to: col + cols },
    };
    // Il tratto di muro (o la torre, quadrata di lato size) da start a end lungo il lato side, alto height
    const piece = (side, start, end, size, height, colors) => {
      const { along, at } = side;
      const rect = along === 'col'
        ? { col: start, row: at - size / 2, cols: end - start, rows: size }
        : { col: at - size / 2, row: start, cols: size, rows: end - start };
      const graphics = side.front ? this.add.graphics().setDepth(standingDepth(rectCenter(rect).y, true)) : back;
      drawBox(graphics, rect, height, colors);
    };
    for (const [name, side] of Object.entries(sides)) {
      const { from, to } = side;
      const gap = name === WORLD.gate.side ? from + WORLD.gate.at : null;
      for (let at = from; at < to; at++) {
        if (at === gap) continue;
        const start = at === from ? at - half : at;
        const end = at === to - 1 ? at + 1 + half : at + 1;
        piece(side, start, end, walls.thickness, walls.height, walls.colors);
      }
      if (gap === null) continue;
      const { size, height, colors } = walls.post;
      for (const end of [gap, gap + 1]) piece(side, end - size / 2, end + size / 2, size, height, colors);
    }
  }

  // Nebbia su ogni area non conquistata: leggera su quella da conquistare, piena sulle altre; appena conquistata
  // un'area (conquest) la sua nebbia leggera se ne va e quella dopo si alleggerisce. Poi i confini di tutte le aree
  drawFog(conquest) {
    const { fog, areaLines, depth } = WORLD_VIEW;
    const conquered = this.conquered();
    conquestAreas().forEach((area, index) => {
      const fresh = conquest?.area === index;
      if (index < conquered && !fresh) return;
      const graphics = this.add.graphics().setDepth(depth.fog);
      graphics.fillStyle(fog.color);
      graphics.fillPoints(rectCorners(areaRect(area)), true);
      if (fresh) fadeFog(this, graphics, fog.current, 0);
      else if (index > conquered) graphics.setAlpha(1);
      else if (conquest !== null) fadeFog(this, graphics, 1, fog.current);
      else graphics.setAlpha(fog.current);
    });
    const lines = this.add.graphics().setDepth(depth.areaLines);
    lines.lineStyle(areaLines.width, areaLines.color, areaLines.alpha);
    const size = WORLD.areaCells;
    for (let index = 0; index <= WORLD.areas; index++) {
      const at = index * size;
      lines.lineBetween(toWorld(at, 0).x, toWorld(at, 0).y, toWorld(at, WORLD_CELLS).x, toWorld(at, WORLD_CELLS).y);
      lines.lineBetween(toWorld(0, at).x, toWorld(0, at).y, toWorld(WORLD_CELLS, at).x, toWorld(WORLD_CELLS, at).y);
    }
  }

  // Si apre sulla vista lasciata l'ultima volta, o sul villaggio
  setupCamera() {
    const cam = this.cameras.main;
    const saved = this.registry.get('worldView');
    const center = rectCenter(villageRect());
    cam.setZoom(saved?.zoom ?? zoomLimits(cam).start);
    lookAt(cam, saved?.x ?? center.x, saved?.y ?? center.y);
  }

  // Gli edifici al loro posto (non quello che si sta spostando), ognuno con i suoi segni, e dove si toccano
  drawVillage() {
    for (const object of this.villageObjects) object.destroy();
    this.villageObjects = [];
    this.overlays = [];
    this.targets = [];
    this.bubble = null;
    this.timer = null;
    const { profile } = this.save;
    const { levels, positions, construction } = profile.village;
    for (const id of Object.keys(VILLAGE.buildings)) {
      if (positions[id] === null || (this.placement?.moving && this.placement.id === id)) continue;
      const rect = footprint(id, positions[id]);
      const site = levels[id] === 0;
      const height = site ? siteHeight() : buildingHeight(id);
      const center = rectCenter(rect);
      const image = this.add.image(center.x, center.y, BUILDING_ATLAS, site ? siteFrame(id) : id);
      image.setScale(1 / WORLD_VIEW.textureScale).setDepth(standingDepth(center.y));
      this.villageObjects.push(image);
      this.targets.push({ id, outline: boxOutline(rect, height), depth: center.y });
      this.drawMarks(id, { x: center.x, y: center.y - height }, construction?.building === id);
    }
    this.targets.sort((a, b) => b.depth - a.depth);
    this.shown = this.state();
    this.fitOverlays();
  }

  // Un passo sulla strada (STEP_REQUESTED), uno alla volta: si fa e si salva subito, poi il capo cammina fino alla
  // casella nuova; arrivato, tutti si ridisegnano, la vista lo segue (se non la si sta trascinando), una raccolta
  // mostra il suo premio e una battaglia apre lo schieramento
  walk() {
    if (this.road.walking) return;
    const result = step(this.save.profile);
    if (result === null) return;
    writeSave(this.save);
    const { tile, gain } = result;
    walkPawn(this.road, tile, () => {
      this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
      if (this.touches.size === 0) this.focusPawn(false);
      const { center } = tileSpot(tile);
      if (gain !== null) floatGain(this, center.x, center.y - this.road.pawn.displayHeight, gainText(gain));
      if (!isBattle(tile)) return;
      const open = () => this.navigate('Lineup', { mode: 'road', tile: tile.index });
      this.time.delayedCall(WORLD_VIEW.road.battleDelayMs, open);
    });
  }

  // Sopra l'edificio id, dal basso: il livello (se è costruito), quanto manca al cantiere, le razioni pronte della
  // fattoria. top: il punto del mondo sopra la sua cima
  drawMarks(id, top, building) {
    const { profile } = this.save;
    const { badge, timer, bubble, badgeStyle, timerStyle, bubbleStyle } = WORLD_VIEW.overlays;
    const level = profile.village.levels[id];
    let y = 0;
    if (level > 0) {
      y -= badge.gap + badge.radius;
      const graphics = this.add.graphics();
      graphics.fillStyle(badge.color);
      graphics.fillCircle(0, y, badge.radius);
      graphics.lineStyle(badge.borderWidth, badge.border);
      graphics.strokeCircle(0, y, badge.radius);
      const text = this.add.text(0, y, String(level), badgeStyle).setOrigin(0.5);
      this.addOverlay(top, [graphics, text]);
      y -= badge.radius;
    }
    if (building) {
      y -= timer.gap + timer.height / 2;
      const text = this.add.text(0, y, this.timerText(), timerStyle).setOrigin(0.5);
      const graphics = this.add.graphics();
      const width = text.width + timer.padding * 2;
      graphics.fillStyle(timer.color, timer.alpha);
      graphics.fillRoundedRect(-width / 2, y - timer.height / 2, width, timer.height, timer.radius);
      this.addOverlay(top, [graphics, text]);
      this.timer = { text, graphics, y };
      y -= timer.height / 2;
    }
    const ready = id === 'farm' ? Math.floor(profile.village.farm.stored) : 0;
    if (ready > 0) {
      y -= bubble.gap + bubble.radius;
      const graphics = this.add.graphics();
      graphics.fillStyle(bubble.color);
      graphics.fillCircle(0, y, bubble.radius);
      graphics.lineStyle(bubble.borderWidth, bubble.border);
      graphics.strokeCircle(0, y, bubble.radius);
      const text = this.add.text(0, y, `+${ready}`, bubbleStyle).setOrigin(0.5);
      this.addOverlay(top, [graphics, text]);
      this.bubble = { top, y };
    }
  }

  // Un segno nel punto del mondo at, sempre grande uguale sullo schermo
  addOverlay(at, children) {
    const container = this.add.container(at.x, at.y, children).setDepth(WORLD_VIEW.depth.overlays);
    this.villageObjects.push(container);
    this.overlays.push(container);
    return container;
  }

  // I segni si rimpiccioliscono quanto la vista si ingrandisce
  fitOverlays() {
    const scale = 1 / this.cameras.main.zoom;
    for (const container of this.overlays) container.setScale(scale);
    this.placement?.buttons.setScale(scale);
  }

  timerText() {
    return durationText(timeLeft(this.save.profile, Date.now()));
  }

  // Il tempo del cantiere scritto di nuovo, con il suo fondo largo quanto la scritta
  refreshTimers() {
    if (this.timer === null) return;
    const { text, graphics, y } = this.timer;
    const { timer } = WORLD_VIEW.overlays;
    text.setText(this.timerText());
    const width = text.width + timer.padding * 2;
    graphics.clear();
    graphics.fillStyle(timer.color, timer.alpha);
    graphics.fillRoundedRect(-width / 2, y - timer.height / 2, width, timer.height, timer.radius);
  }

  // La vista va sull'edificio id (vedi reveal)
  focus(id, always) {
    const at = this.save.profile.village.positions[id];
    if (at === null) return;
    const rect = footprint(id, at);
    const center = rectCenter(rect);
    const height = this.save.profile.village.levels[id] === 0 ? siteHeight() : buildingHeight(id);
    this.reveal(center, center.y - height, toWorld(rect.col + rect.cols, rect.row + rect.rows).y, always);
  }

  // La vista va sul capo, dalla sua testa all'angolo sud della sua casella (vedi reveal)
  focusPawn(always) {
    const { center } = tileSpot(hereTile(this.save.profile));
    this.reveal(center, center.y - this.road.pawn.displayHeight, center.y + WORLD_VIEW.tileHeight / 2, always);
  }

  // La vista va sul punto del mondo center, a metà tra le risorse in alto e la scheda che gli si apre sotto, senza
  // uscire dal mondo; con always false solo se lì non si vedrebbe tutto quello che sta tra le y del mondo top e bottom
  // (la cima sotto le risorse, il fondo sotto la scheda o il centro fuori dai lati, a meno di revealMargin)
  reveal(center, top, bottom, always) {
    const cam = this.cameras.main;
    const { top: band, panel } = HUD.world;
    const sheetTop = panel.bottom - panel.height;
    const margin = WORLD_VIEW.zoom.revealMargin;
    const middle = worldToScreen(cam, center.x, center.y);
    const peak = worldToScreen(cam, center.x, top).y;
    const low = worldToScreen(cam, center.x, bottom).y;
    const across = middle.x > margin && middle.x < cam.width - margin;
    if (!always && across && peak > band.height + margin && low < sheetTop - margin) return;
    const target = clampPoint(center.x, center.y + (cam.height / 2 - (band.height + sheetTop) / 2) / cam.zoom);
    cam.pan(target.x, target.y, WORLD_VIEW.zoom.focusMs, Phaser.Math.Easing.Sine.InOut, true);
  }

  setupInput() {
    this.input.on(E.POINTER_DOWN, (pointer) => this.pointerDown(pointer));
    this.input.on(E.POINTER_MOVE, (pointer) => this.pointerMove(pointer));
    this.input.on(E.POINTER_UP, (pointer) => this.pointerUp(pointer));
    this.input.on(E.POINTER_UP_OUTSIDE, (pointer) => this.pointerUp(pointer));
    this.input.on(E.POINTER_WHEEL, (pointer, over, dx, dy) => this.wheel(pointer, dy));
  }

  // L'interfaccia sopra copre il punto: quel tocco è suo
  onInterface(x, y) {
    return this.scene.get('WorldUI').covers(x, y);
  }

  // Un dito si appoggia: con due dita si zooma; con uno si sta per toccare, trascinare la vista o, sull'edificio da
  // mettere, trascinare lui; tenuto fermo su un edificio lo si prende per spostarlo
  pointerDown(pointer) {
    if (this.onInterface(pointer.x, pointer.y)) return;
    const cam = this.cameras.main;
    cam.panEffect.reset();
    this.touches.set(pointer.id, pointer);
    this.cancelHold();
    if (this.touches.size === 2) {
      if (this.press?.held && !this.press.moved) this.endPlacement();
      this.startPinch();
      return;
    }
    if (this.touches.size > 2) return;
    const world = screenToWorld(cam, pointer.x, pointer.y);
    this.press = { id: pointer.id, moved: false, held: false, grab: null, hold: null };
    if (this.placement !== null) {
      this.press.grab = this.grabGhost(world);
      return;
    }
    const id = this.buildingAt(world);
    if (id === null) return;
    this.press.hold = this.time.delayedCall(WORLD_VIEW.gestures.longPressMs, () => {
      this.press.held = true;
      this.startPlacement(id, true, false);
      this.press.grab = this.grabGhost(screenToWorld(cam, pointer.x, pointer.y));
    });
  }

  pointerMove(pointer) {
    if (!this.touches.has(pointer.id)) return;
    if (this.pinch !== null) {
      this.updatePinch();
      return;
    }
    const press = this.press;
    if (press === null || press.id !== pointer.id) return;
    if (!press.moved && pointer.getDistance() > WORLD_VIEW.gestures.tapSlop) {
      press.moved = true;
      this.cancelHold();
    }
    if (!press.moved) return;
    if (press.grab !== null) this.dragGhost(pointer, press.grab);
    else panBy(this.cameras.main, pointer.x - pointer.prevPosition.x, pointer.y - pointer.prevPosition.y);
  }

  // Un dito si alza: finito un pizzico, il dito che resta continua a trascinare la vista; un tocco breve e fermo
  // sceglie quello che c'è sotto (non quello annullato dal telefono, per una chiamata o un gesto del sistema)
  pointerUp(pointer) {
    if (!this.touches.delete(pointer.id)) return;
    if (this.pinch !== null) {
      if (this.touches.size < 2) this.pinch = null;
      const [left] = this.touches.values();
      this.press = left === undefined ? null : { id: left.id, moved: true, held: false, grab: null, hold: null };
      return;
    }
    const press = this.press;
    this.cancelHold();
    this.press = null;
    if (press === null || press.id !== pointer.id || press.moved || press.held || pointer.wasCanceled) return;
    this.tap(pointer);
  }

  wheel(pointer, dy) {
    if (this.onInterface(pointer.x, pointer.y)) return;
    const cam = this.cameras.main;
    const world = screenToWorld(cam, pointer.x, pointer.y);
    zoomAround(cam, cam.zoom * Math.exp(-dy * WORLD_VIEW.zoom.wheelFactor), world.x, world.y, pointer.x, pointer.y);
    this.fitOverlays();
  }

  cancelHold() {
    this.press?.hold?.remove();
    if (this.press) this.press.hold = null;
  }

  // Due dita: lo zoom segue la loro distanza e il punto del mondo che stava tra loro resta tra loro
  startPinch() {
    const [a, b] = this.touches.values();
    const cam = this.cameras.main;
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.press = null;
    this.pinch = {
      distance: Math.max(1, Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)),
      zoom: cam.zoom,
      anchor: screenToWorld(cam, middle.x, middle.y),
    };
  }

  updatePinch() {
    const [a, b] = this.touches.values();
    const { distance, zoom, anchor } = this.pinch;
    const now = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const cam = this.cameras.main;
    zoomAround(cam, (zoom * now) / distance, anchor.x, anchor.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    this.fitOverlays();
  }

  // Un tocco: mentre si mette un edificio ✓ conferma, ✗ annulla e altrove l'edificio va lì; altrimenti le razioni
  // pronte si raccolgono, il capo apre la scheda della strada (anche davanti a un edificio), un edificio la sua, la
  // strada con la porta quella della strada, il terreno chiude le schede
  tap(pointer) {
    const cam = this.cameras.main;
    const world = screenToWorld(cam, pointer.x, pointer.y);
    if (this.placement !== null) {
      const button = this.confirmAt(pointer);
      if (button === 'ok') this.confirmPlacement();
      else if (button === 'cancel') this.endPlacement();
      else if (this.grabGhost(world) === null) this.moveGhostTo(toGrid(world.x, world.y));
      return;
    }
    if (this.bubbleAt(pointer)) {
      collectRations(this.save.profile);
      writeSave(this.save);
      this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
      return;
    }
    if (pawnAt(this.road, world)) {
      this.openRoad();
      return;
    }
    const id = this.buildingAt(world);
    if (id !== null) this.select(id);
    else if (roadCellAt(this.save.profile, world)) this.openRoad();
    else this.bus.emit(WORLD_EVENTS.GROUND_TAPPED);
  }

  // Si apre la scheda dell'edificio id, e lui resta in vista
  select(id) {
    this.focus(id, false);
    this.bus.emit(WORLD_EVENTS.BUILDING_TAPPED, { id });
  }

  // Si apre la scheda della strada, e il capo resta in vista
  openRoad() {
    this.focusPawn(false);
    this.bus.emit(WORLD_EVENTS.ROAD_TAPPED);
  }

  // L'edificio la cui sagoma copre il punto del mondo, il più davanti; null se nessuno
  buildingAt({ x, y }) {
    return this.targets.find((target) => insidePolygon(target.outline, x, y))?.id ?? null;
  }

  // Il tocco cade sulle razioni pronte della fattoria
  bubbleAt(pointer) {
    if (this.bubble === null) return false;
    const cam = this.cameras.main;
    const { top, y } = this.bubble;
    const at = worldToScreen(cam, top.x, top.y);
    const { radius } = WORLD_VIEW.overlays.bubble;
    return Phaser.Math.Distance.Between(pointer.x, pointer.y, at.x, at.y + y) <= radius;
  }

  // Comincia a mettere l'edificio id (nuovo: nel posto libero più vicino al centro della vista) o a spostarlo
  // (moving); con focus la vista ci va (non quando lo si è preso con il dito)
  startPlacement(id, moving, focus) {
    this.endPlacement();
    const { positions } = this.save.profile.village;
    const center = viewCenter(this.cameras.main);
    const cell = moving ? positions[id] : freeSpot(positions, id, this.conquered(), toGrid(center.x, center.y));
    const start = cell ?? { col: villageRect().col, row: villageRect().row };
    const { ghost, depth, overlays } = WORLD_VIEW;
    const site = this.save.profile.village.levels[id] === 0 && moving;
    const image = this.add.image(0, 0, BUILDING_ATLAS, site ? siteFrame(id) : id).setAlpha(ghost.alpha);
    image.setScale(1 / WORLD_VIEW.textureScale).setDepth(depth.ghost + 1);
    const ground = this.add.graphics().setDepth(depth.ghost);
    const edge = this.add.graphics().setDepth(depth.ghost + 2);
    const buttons = this.add.container(0, 0, drawConfirm(this, overlays.confirm)).setDepth(depth.overlays);
    const height = site ? siteHeight() : buildingHeight(id);
    this.placement = { id, moving, cell: start, image, ground, edge, buttons, height, valid: false };
    this.drawVillage();
    this.updateGhost();
    this.bus.emit(WORLD_EVENTS.PLACEMENT_STARTED, { id, moving });
    if (!focus) return;
    const middle = rectCenter(footprint(id, start));
    this.cameras.main.pan(middle.x, middle.y, WORLD_VIEW.zoom.focusMs, Phaser.Math.Easing.Sine.InOut, true);
  }

  // L'edificio da mettere al suo posto di adesso: il posto verde se ci sta, rosso se no, con il bordo sopra
  // l'edificio; l'edificio stesso diventa rosso e ✓ si spegne se non ci sta
  updateGhost() {
    const { id, cell, image, ground, edge, buttons } = this.placement;
    const { ghost, overlays } = WORLD_VIEW;
    const rect = footprint(id, cell);
    const valid = canPlace(this.save.profile.village.positions, id, cell, this.conquered());
    const color = valid ? ghost.valid : ghost.invalid;
    const center = rectCenter(rect);
    image.setPosition(center.x, center.y);
    if (valid) image.clearTint();
    else image.setTint(ghost.invalid);
    ground.clear();
    ground.fillStyle(color, ghost.footprintAlpha);
    ground.fillPoints(rectCorners(rect), true);
    edge.clear();
    edge.lineStyle(ghost.outlineWidth, color);
    edge.strokePoints(rectCorners(rect), true);
    const south = toWorld(rect.col + rect.cols, rect.row + rect.rows);
    buttons.setPosition(south.x, south.y);
    buttons.list[1].setAlpha(valid ? 1 : overlays.confirm.disabledAlpha);
    this.placement.valid = valid;
    this.fitOverlays();
  }

  // Il punto del mondo cade sull'edificio da mettere: dove lo si è preso, rispetto al suo angolo nord; null se no
  grabGhost({ x, y }) {
    const { id, cell, height } = this.placement;
    const rect = footprint(id, cell);
    if (!insidePolygon(boxOutline(rect, height), x, y)) return null;
    const grid = toGrid(x, y);
    return { col: grid.col - cell.col, row: grid.row - cell.row };
  }

  // Il dito trascina l'edificio da mettere, preso nel punto grab, una cella alla volta
  dragGhost(pointer, grab) {
    const world = screenToWorld(this.cameras.main, pointer.x, pointer.y);
    const grid = toGrid(world.x, world.y);
    this.placeGhost({ col: Math.round(grid.col - grab.col), row: Math.round(grid.row - grab.row) });
  }

  // L'edificio da mettere va con il centro sul punto di griglia grid
  moveGhostTo(grid) {
    const [cols, rows] = VILLAGE.buildings[this.placement.id].size;
    this.placeGhost({ col: Math.round(grid.col - cols / 2), row: Math.round(grid.row - rows / 2) });
  }

  // L'edificio da mettere con l'angolo nord in cell, dentro il mondo
  placeGhost(cell) {
    const [cols, rows] = VILLAGE.buildings[this.placement.id].size;
    const col = Phaser.Math.Clamp(cell.col, 0, WORLD_CELLS - cols);
    const row = Phaser.Math.Clamp(cell.row, 0, WORLD_CELLS - rows);
    if (col === this.placement.cell.col && row === this.placement.cell.row) return;
    this.placement.cell = { col, row };
    this.updateGhost();
  }

  // Il tocco cade su ✓ (ok) o su ✗ (cancel) sotto l'edificio da mettere, o su niente (null)
  confirmAt(pointer) {
    const { radius, gap, offsetY } = WORLD_VIEW.overlays.confirm;
    const { buttons } = this.placement;
    const at = worldToScreen(this.cameras.main, buttons.x, buttons.y);
    const near = (dx) => Phaser.Math.Distance.Between(pointer.x, pointer.y, at.x + dx, at.y + offsetY) <= radius;
    if (near(gap / 2)) return 'ok';
    if (near(-gap / 2)) return 'cancel';
    return null;
  }

  // ✓: l'edificio nuovo apre il suo cantiere lì, quello spostato resta lì; poi si apre la sua scheda
  confirmPlacement() {
    const { id, moving, cell, valid } = this.placement;
    if (!valid) return;
    const { profile } = this.save;
    const done = moving ? moveBuilding(profile, id, cell) : placeBuilding(profile, id, cell, Date.now());
    if (!done) return;
    writeSave(this.save);
    this.endPlacement();
    this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
    this.select(id);
  }

  // Finisce di mettere o spostare, senza cambiare niente (✗) o dopo ✓
  endPlacement() {
    if (this.placement === null) return;
    const { image, ground, edge, buttons } = this.placement;
    image.destroy();
    ground.destroy();
    edge.destroy();
    buttons.destroy();
    this.placement = null;
    this.drawVillage();
    this.bus.emit(WORLD_EVENTS.PLACEMENT_ENDED);
  }
}

// Il premio di una raccolta: "+12 materiali", "+2 frammenti · Cecchino"
function gainText({ kind, amount, hero }) {
  const text = amountText(kind, amount, '+');
  return hero === null ? text : `${text}${HUD.world.separator}${HEROES[hero].name}`;
}

// Una scatola alta height sul rettangolo di celle rect, nella Graphics: faccia sinistra, destra, poi sopra
function drawBox(graphics, rect, height, colors) {
  const [north, east, south, west] = rectCorners(rect);
  const up = ({ x, y }) => ({ x, y: y - height });
  graphics.fillStyle(colors.left);
  graphics.fillPoints([west, south, up(south), up(west)], true);
  graphics.fillStyle(colors.right);
  graphics.fillPoints([south, east, up(east), up(south)], true);
  graphics.fillStyle(colors.top);
  graphics.fillPoints([up(north), up(east), up(south), up(west)], true);
}

// ✗ a sinistra e ✓ a destra, offsetY sotto il punto: rispettivamente i figli 0 e 1
function drawConfirm(scene, { radius, gap, offsetY, ok, cancel, icon, iconWidth, cross, check }) {
  const no = scene.add.graphics();
  const arm = radius * cross;
  no.fillStyle(cancel);
  no.fillCircle(-gap / 2, offsetY, radius);
  no.lineStyle(iconWidth, icon);
  no.lineBetween(-gap / 2 - arm, offsetY - arm, -gap / 2 + arm, offsetY + arm);
  no.lineBetween(-gap / 2 - arm, offsetY + arm, -gap / 2 + arm, offsetY - arm);
  const yes = scene.add.graphics();
  yes.fillStyle(ok);
  yes.fillCircle(gap / 2, offsetY, radius);
  yes.lineStyle(iconWidth, icon);
  yes.strokePoints(check.map(([x, y]) => ({ x: gap / 2 + x * radius, y: offsetY + y * radius })), false);
  return [no, yes];
}
