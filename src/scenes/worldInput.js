import * as Phaser from 'phaser';
import { WORLD_VIEW } from '../config/balance.js';
import { panBy, screenToWorld, zoomAround } from '../view/worldCamera.js';

const E = Phaser.Input.Events;

// I gesti sul mondo (scenes/World.js): un dito trascina la vista, due dita (o la rotella) zoomano, un tocco breve e
// fermo sceglie, un dito tenuto fermo su un edificio lo prende per spostarlo. Cosa vogliono dire lo dice il mondo con
// handlers: covers(x, y) l'interfaccia sopra copre il punto dello schermo (quel tocco è suo); placing() si sta
// mettendo un edificio; grab(world) dove lo si prende nel punto del mondo (null se lì non c'è); holdable(world)
// l'edificio che si prende tenendolo premuto lì (null se nessuno); hold(id) lo si prende; drop() lo si lascia, se
// arriva un secondo dito prima di averlo mosso; drag(pointer, grab) lo si trascina; tap(pointer) un tocco; zoomed()
// lo zoom è cambiato
export function createGestures(scene, handlers) {
  const gestures = { scene, handlers, touches: new Map(), press: null, pinch: null };
  scene.input.on(E.POINTER_DOWN, (pointer) => pointerDown(gestures, pointer));
  scene.input.on(E.POINTER_MOVE, (pointer) => pointerMove(gestures, pointer));
  scene.input.on(E.POINTER_UP, (pointer) => pointerUp(gestures, pointer));
  scene.input.on(E.POINTER_UP_OUTSIDE, (pointer) => pointerUp(gestures, pointer));
  scene.input.on(E.POINTER_WHEEL, (pointer, over, dx, dy) => wheel(gestures, pointer, dy));
  return gestures;
}

// Almeno un dito è appoggiato sul mondo
export function touching(gestures) {
  return gestures.touches.size > 0;
}

// Un dito si appoggia: con due dita si zooma; con uno si sta per toccare, trascinare la vista o, sull'edificio da
// mettere, trascinare lui; tenuto fermo su un edificio lo si prende per spostarlo
function pointerDown(gestures, pointer) {
  const { scene, handlers, touches } = gestures;
  if (handlers.covers(pointer.x, pointer.y)) return;
  const cam = scene.cameras.main;
  cam.panEffect.reset();
  touches.set(pointer.id, pointer);
  cancelHold(gestures);
  if (touches.size === 2) {
    if (gestures.press?.held && !gestures.press.moved) handlers.drop();
    startPinch(gestures);
    return;
  }
  if (touches.size > 2) return;
  const world = screenToWorld(cam, pointer.x, pointer.y);
  gestures.press = { id: pointer.id, moved: false, held: false, grab: null, hold: null };
  if (handlers.placing()) {
    gestures.press.grab = handlers.grab(world);
    return;
  }
  const id = handlers.holdable(world);
  if (id === null) return;
  gestures.press.hold = scene.time.delayedCall(WORLD_VIEW.gestures.longPressMs, () => {
    gestures.press.held = true;
    handlers.hold(id);
    gestures.press.grab = handlers.grab(screenToWorld(cam, pointer.x, pointer.y));
  });
}

function pointerMove(gestures, pointer) {
  if (!gestures.touches.has(pointer.id)) return;
  if (gestures.pinch !== null) {
    updatePinch(gestures);
    return;
  }
  const { press } = gestures;
  if (press === null || press.id !== pointer.id) return;
  if (!press.moved && pointer.getDistance() > WORLD_VIEW.gestures.tapSlop) {
    press.moved = true;
    cancelHold(gestures);
  }
  if (!press.moved) return;
  if (press.grab !== null) gestures.handlers.drag(pointer, press.grab);
  else panBy(gestures.scene.cameras.main, pointer.x - pointer.prevPosition.x, pointer.y - pointer.prevPosition.y);
}

// Un dito si alza: finito un pizzico, il dito che resta continua a trascinare la vista; un tocco breve e fermo
// sceglie quello che c'è sotto (non quello annullato dal telefono, per una chiamata o un gesto del sistema)
function pointerUp(gestures, pointer) {
  const { touches } = gestures;
  if (!touches.delete(pointer.id)) return;
  if (gestures.pinch !== null) {
    if (touches.size < 2) gestures.pinch = null;
    const [left] = touches.values();
    gestures.press = left === undefined ? null : { id: left.id, moved: true, held: false, grab: null, hold: null };
    return;
  }
  const { press } = gestures;
  cancelHold(gestures);
  gestures.press = null;
  if (press === null || press.id !== pointer.id || press.moved || press.held || pointer.wasCanceled) return;
  gestures.handlers.tap(pointer);
}

function wheel({ scene, handlers }, pointer, dy) {
  if (handlers.covers(pointer.x, pointer.y)) return;
  const cam = scene.cameras.main;
  const world = screenToWorld(cam, pointer.x, pointer.y);
  zoomAround(cam, cam.zoom * Math.exp(-dy * WORLD_VIEW.zoom.wheelFactor), world.x, world.y, pointer.x, pointer.y);
  handlers.zoomed();
}

function cancelHold({ press }) {
  press?.hold?.remove();
  if (press) press.hold = null;
}

// Due dita: lo zoom segue la loro distanza e il punto del mondo che stava tra loro resta tra loro
function startPinch(gestures) {
  const [a, b] = gestures.touches.values();
  const cam = gestures.scene.cameras.main;
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  gestures.press = null;
  gestures.pinch = {
    distance: Math.max(1, Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)),
    zoom: cam.zoom,
    anchor: screenToWorld(cam, middle.x, middle.y),
  };
}

function updatePinch({ scene, handlers, touches, pinch }) {
  const [a, b] = touches.values();
  const { distance, zoom, anchor } = pinch;
  const now = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
  const cam = scene.cameras.main;
  zoomAround(cam, (zoom * now) / distance, anchor.x, anchor.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  handlers.zoomed();
}
