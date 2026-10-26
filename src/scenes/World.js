import * as Phaser from 'phaser';
import { HUD, WORLD_VIEW } from '../config/balance.js';
import { now } from '../core/clock.js';
import { META_EVENTS, WORLD_EVENTS, createEventBus } from '../core/events.js';
import { VILLAGE } from '../data/village.js';
import { clearFlash, flashCell, floatGain } from '../fx/worldFx.js';
import { canFight, conqueredAreas, hereTile, isBattle, targetTile } from '../meta/road.js';
import { canChallenge, footprint, freeSpot, siteOf } from '../meta/village.js';
import { villageRect } from '../meta/world.js';
import { boxOutline, insidePolygon, rectCenter, rectCorners, standingDepth, toGrid, toWorld } from '../view/iso.js';
import { createPawnAtlas } from '../view/pawns.js';
import { BUILDING_ATLAS, buildingHeight, createWorldAtlas, siteFrame, siteHeight } from '../view/worldAtlas.js';
import { clampPoint, lookAt, screenToWorld, viewCenter, worldToScreen, zoomLimits } from '../view/worldCamera.js';
import { drawFog, drawGround, drawWalls } from '../view/worldGround.js';
import {
  createRoadView,
  drawRoad,
  inCurrentArea,
  pawnAt,
  roadTileUnder,
  targetUnder,
  tileSpot,
  walkPawn,
} from '../view/worldRoad.js';
import { gainText, timeLeftText } from '../view/worldWords.js';
import { openSettings } from './PauseMenu.js';
import { createGestures, resetGestures, touching } from './worldInput.js';
import {
  centerCell,
  confirmAt,
  createPlacement,
  destroyPlacement,
  dragCell,
  drawGhost,
  grabGhost,
  moveGhost,
} from './worldPlacement.js';

// Il mondo in isometria, in grigio (data/world.js): il grande quadrato di aree, il villaggio al centro con le sue mura
// e la porta, le aree conquistate che allargano il territorio, quella da conquistare nella nebbia leggera e le altre
// nella nebbia piena. Dalla porta parte la strada unica (meta/road.js, disegnata da view/worldRoad.js), con i segni
// delle caselle e il capo sulla casella dove si è. Gli edifici stanno al loro posto (il cantiere del primo livello
// finché non è finito), con il livello, quanto manca al loro cantiere (anche più d'uno insieme) e le razioni pronte
// della fattoria, che si raccolgono toccandole. Un dito trascina la vista, due dita (o la rotella) zoomano; toccando
// un edificio si apre la sua scheda. Sulla strada non ci sono modi: toccando la casella da toccare per andare avanti
// si va avanti (il capo ci cammina, o si apre lo schieramento della sua battaglia), toccando le altre caselle, il capo
// o l'area da conquistare si apre la scheda della strada. Per mettere o spostare un edificio (dal menu, dalla scheda,
// o tenendolo premuto) lo si trascina dove è verde e si conferma con ✓ (✗ annulla). Sopra, l'interfaccia
// (scenes/WorldUI.js), con cui si parla sul bus del mondo (WORLD_EVENTS), e, dal suo ingranaggio, le impostazioni
// (scenes/PauseMenu.js). I cambi li fanno le azioni del meta-gioco (meta/actions.js, nel registro: actions), che
// salvano subito; dopo ognuna (META_EVENTS.PROFILE_CHANGED) tutti si ridisegnano. Il terreno lo disegna
// view/worldGround.js, i gesti li riconosce scenes/worldInput.js, l'edificio da mettere sta in scenes/worldPlacement.js
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    createWorldAtlas(this.textures);
    createPawnAtlas(this.textures);
    this.save = this.registry.get('save');
    this.actions = this.registry.get('actions');
    this.actions.settle();
    // Di ritorno da una battaglia della strada (o dal suo schieramento) la vista va sul capo, con l'area conquistata
    const back = this.registry.get('worldReturn') ?? null;
    this.registry.remove('worldReturn');
    this.bus = createEventBus();
    const conquered = this.conquered();
    drawGround(this, conquered);
    drawWalls(this);
    drawFog(this, conquered, back?.conquest ?? null);
    this.villageObjects = [];
    this.overlays = [];
    this.placement = null;
    this.flash = null;
    this.leaving = false;
    this.setupCamera();
    this.setupInput();
    this.listen();
    this.drawVillage();
    this.road = createRoadView(this);
    drawRoad(this.road, this.save.profile);
    if (back !== null) this.showRoad(false);
    this.scene.launch('WorldUI', { bus: this.bus, conquest: back?.conquest ?? null });
    this.time.addEvent({ delay: HUD.world.tickMs, loop: true, callback: () => this.tick() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.leave());
  }

  // Il tempo scorre: se qualcosa che si vede è cambiato (un cantiere finito, una razione pronta) tutti si
  // ridisegnano, altrimenti cambiano solo i tempi scritti
  tick() {
    this.actions.settle();
    if (this.state() === this.shown) this.bus.emit(WORLD_EVENTS.TICK);
    else this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
  }

  // Quello che cambia il villaggio disegnato e la sua interfaccia: con i cantieri aperti, se la loro sfida si può fare
  state() {
    const { profile } = this.save;
    const { levels, positions, sites, farm } = profile.village;
    const ready = Math.floor(farm.stored);
    const open = sites.map(({ building }) => [building, canChallenge(profile, building, now())]);
    return JSON.stringify([levels, positions, open, ready, profile.resources]);
  }

  listen() {
    // Dopo un passo sulla strada ci si ridisegna quando il capo arriva (walk)
    this.profileChanged = ({ action }) => {
      if (action !== 'step') this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
    };
    this.game.events.on(META_EVENTS.PROFILE_CHANGED, this.profileChanged);
    const on = (name, handler) => this.bus.on(name, handler);
    on(WORLD_EVENTS.WORLD_CHANGED, () => {
      this.drawVillage();
      drawRoad(this.road, this.save.profile);
    });
    on(WORLD_EVENTS.TICK, () => this.refreshTimers());
    on(WORLD_EVENTS.PLACE_REQUESTED, ({ id }) => this.startPlacement(id, false, true));
    on(WORLD_EVENTS.MOVE_REQUESTED, ({ id }) => this.startPlacement(id, true, true));
    on(WORLD_EVENTS.FOCUS_REQUESTED, ({ id }) => this.focus(id, true));
    on(WORLD_EVENTS.PAWN_FOCUS_REQUESTED, () => this.showRoad(true));
    // Le impostazioni si aprono sopra il mondo, che intanto non riceve tocchi: i gesti lasciati a metà si dimenticano
    on(WORLD_EVENTS.SETTINGS_REQUESTED, () => {
      resetGestures(this.gestures);
      openSettings(this);
    });
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

  // Chiuso il mondo si chiude anche la sua interfaccia, e il mondo non ascolta più il meta-gioco
  leave() {
    this.game.events.off(META_EVENTS.PROFILE_CHANGED, this.profileChanged);
    this.scene.stop('WorldUI');
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
    this.timers = [];
    const { profile } = this.save;
    const { levels, positions } = profile.village;
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
      this.drawMarks(id, { x: center.x, y: center.y - height }, siteOf(profile, id) !== null);
    }
    this.targets.sort((a, b) => b.depth - a.depth);
    this.shown = this.state();
    this.fitOverlays();
  }

  // Un passo sulla strada, verso una casella senza battaglia: si fa subito, poi il capo cammina fino alla casella
  // nuova; arrivato, tutti si ridisegnano, la vista lo segue (se non la si sta trascinando) e una raccolta mostra il
  // suo premio
  walk() {
    const result = this.actions.step();
    if (result === null) return;
    const { tile, gain } = result;
    walkPawn(this.road, tile, () => {
      this.bus.emit(WORLD_EVENTS.WORLD_CHANGED);
      if (!touching(this.gestures)) this.focusPawn(false);
      if (gain === null) return;
      const { center } = tileSpot(tile);
      floatGain(this, center.x, center.y - this.road.pawn.displayHeight, gainText(gain));
    });
  }

  // Sopra l'edificio id, dal basso: il livello (se è costruito), quanto manca al suo cantiere (building: ce n'è uno),
  // le razioni pronte della fattoria. top: il punto del mondo sopra la sua cima
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
      const text = this.add.text(0, y, timeLeftText(profile, id, now()), timerStyle).setOrigin(0.5);
      const graphics = this.add.graphics();
      const width = text.width + timer.padding * 2;
      graphics.fillStyle(timer.color, timer.alpha);
      graphics.fillRoundedRect(-width / 2, y - timer.height / 2, width, timer.height, timer.radius);
      this.addOverlay(top, [graphics, text]);
      this.timers.push({ id, text, graphics, y });
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

  // Il tempo di ogni cantiere scritto di nuovo, con il suo fondo largo quanto la scritta
  refreshTimers() {
    const { timer } = WORLD_VIEW.overlays;
    for (const { id, text, graphics, y } of this.timers) {
      text.setText(timeLeftText(this.save.profile, id, now()));
      const width = text.width + timer.padding * 2;
      graphics.clear();
      graphics.fillStyle(timer.color, timer.alpha);
      graphics.fillRoundedRect(-width / 2, y - timer.height / 2, width, timer.height, timer.radius);
    }
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

  // La vista va sul capo (vedi focusPawn) e la casella da toccare per andare avanti si accende per un momento, al
  // posto di una accesa prima (fx/worldFx.js)
  showRoad(always) {
    this.focusPawn(always);
    if (this.flash !== null) clearFlash(this, this.flash);
    this.flash = null;
    const tile = targetTile(this.save.profile);
    if (tile !== null) this.flash = flashCell(this, rectCorners({ col: tile.col, row: tile.row, cols: 1, rows: 1 }));
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

  // I gesti sul mondo (scenes/worldInput.js) e cosa vogliono dire qui: l'interfaccia sopra si tiene i suoi tocchi;
  // tenuto fermo, un edificio si prende per spostarlo, e si lascia se arriva un secondo dito prima di averlo mosso
  setupInput() {
    this.gestures = createGestures(this, {
      covers: (x, y) => this.scene.get('WorldUI').covers(x, y),
      placing: () => this.placement !== null,
      grab: (world) => grabGhost(this.placement, world),
      holdable: (world) => this.buildingAt(world),
      hold: (id) => this.startPlacement(id, true, false),
      drop: () => this.endPlacement(),
      drag: (pointer, grab) => this.placeGhost(dragCell(screenToWorld(this.cameras.main, pointer.x, pointer.y), grab)),
      tap: (pointer) => this.tap(pointer),
      zoomed: () => this.fitOverlays(),
    });
  }

  // Un tocco (scenes/worldInput.js: breve, e senza trascinare): mentre si mette un edificio va a tapPlacement; se no
  // le razioni pronte si raccolgono, o tocca il mondo (tapWorld)
  tap(pointer) {
    const world = screenToWorld(this.cameras.main, pointer.x, pointer.y);
    if (this.placement !== null) this.tapPlacement(pointer, world);
    else if (this.bubbleAt(pointer)) this.actions.collectRations();
    else this.tapWorld(world);
  }

  // Mentre si mette un edificio: ✓ conferma, ✗ annulla e altrove l'edificio va lì
  tapPlacement(pointer, world) {
    const button = confirmAt(this.placement, this.cameras.main, pointer);
    const center = centerCell(this.placement, toGrid(world.x, world.y));
    if (button === 'ok') this.confirmPlacement();
    else if (button === 'cancel') this.endPlacement();
    else if (grabGhost(this.placement, world) === null) this.placeGhost(center);
  }

  // Un tocco nel punto del mondo world: prima la casella da toccare con il suo segno, il capo o un edificio (pickAt,
  // l'edificio apre la sua scheda); poi le altre caselle della strada, con la porta (tapRoad), l'area da conquistare
  // (la scheda della strada) e il resto del terreno, che chiude le schede
  tapWorld(world) {
    const { profile } = this.save;
    const picked = this.pickAt(world);
    if (picked?.id !== undefined) {
      this.select(picked.id);
      return;
    }
    const tile = picked?.tile ?? roadTileUnder(profile, world);
    if (tile !== null) this.tapRoad(tile);
    else if (inCurrentArea(profile, world)) this.openRoad();
    else this.bus.emit(WORLD_EVENTS.GROUND_TAPPED);
  }

  // Chi si tocca nel punto del mondo world tra la casella da toccare con il suo segno (view/worldRoad.js targetUnder),
  // il capo e gli edifici: il capo, che vale come la casella dove sta, vince sugli edifici; la casella da toccare vince
  // su chi le sta dietro (alla porta il capo le sta accanto, appena dietro). { tile } per una casella, { id } per un
  // edificio, null se nessuno
  pickAt(world) {
    const { profile } = this.save;
    const target = targetUnder(profile, world);
    const front = target === null ? -Infinity : standingDepth(tileSpot(target).center.y);
    const building = this.targets.find((one) => insidePolygon(one.outline, world.x, world.y));
    if (pawnAt(this.road, world) && this.road.pawn.depth > front) return { tile: hereTile(profile) };
    if (target !== null && (building === undefined || standingDepth(building.depth) < front)) return { tile: target };
    return building === undefined ? null : { id: building.id };
  }

  // Un tocco sulla casella tile della strada. Quella da toccare per andare avanti (meta/road.js targetTile) fa la sua
  // cosa: su una neutra o una raccolta il capo ci cammina; su una battaglia si apre il suo schieramento (le razioni si
  // pagano partendo, e tornando indietro non si paga niente), o, se le razioni non bastano, la scheda della strada, che
  // dice quante ne mancano e come averle. Le altre caselle aprono la scheda; mentre il capo cammina, niente
  tapRoad(tile) {
    if (this.road.walking) return;
    const { profile } = this.save;
    if (tile !== targetTile(profile)) this.openRoad();
    else if (!isBattle(tile)) this.walk();
    else if (canFight(profile, tile.index)) this.navigate('Lineup', { mode: 'road', tile: tile.index });
    else this.openRoad();
  }

  // Si apre la scheda dell'edificio id, e lui resta in vista
  select(id) {
    this.focus(id, false);
    this.bus.emit(WORLD_EVENTS.BUILDING_TAPPED, { id });
  }

  // Si apre la scheda della strada, il capo resta in vista e la casella da toccare si accende
  openRoad() {
    this.showRoad(false);
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
    const { positions, levels } = this.save.profile.village;
    const center = viewCenter(this.cameras.main);
    const cell = moving ? positions[id] : freeSpot(positions, id, this.conquered(), toGrid(center.x, center.y));
    const start = cell ?? { col: villageRect().col, row: villageRect().row };
    this.placement = createPlacement(this, { id, moving, cell: start, site: levels[id] === 0 && moving });
    this.drawVillage();
    this.updateGhost();
    this.bus.emit(WORLD_EVENTS.PLACEMENT_STARTED, { id, moving });
    if (!focus) return;
    const middle = rectCenter(footprint(id, start));
    this.cameras.main.pan(middle.x, middle.y, WORLD_VIEW.zoom.focusMs, Phaser.Math.Easing.Sine.InOut, true);
  }

  // L'edificio da mettere al suo posto di adesso (vedi drawGhost)
  updateGhost() {
    drawGhost(this.placement, this.save.profile.village.positions, this.conquered());
    this.fitOverlays();
  }

  // L'edificio da mettere con l'angolo nord in cell, dentro il mondo
  placeGhost(cell) {
    if (moveGhost(this.placement, cell)) this.updateGhost();
  }

  // ✓: l'edificio nuovo apre il suo cantiere lì, quello spostato resta lì; poi si apre la sua scheda
  confirmPlacement() {
    const { id, moving, cell, valid } = this.placement;
    if (!valid) return;
    const done = moving ? this.actions.moveBuilding(id, cell) : this.actions.placeBuilding(id, cell);
    if (!done) return;
    this.endPlacement();
    this.select(id);
  }

  // Finisce di mettere o spostare, senza cambiare niente (✗) o dopo ✓
  endPlacement() {
    if (this.placement === null) return;
    destroyPlacement(this.placement);
    this.placement = null;
    this.drawVillage();
    this.bus.emit(WORLD_EVENTS.PLACEMENT_ENDED);
  }
}
