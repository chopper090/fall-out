import * as Phaser from 'phaser';
import { HERO, LANES } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createLanes } from '../systems/lanes.js';
import { createArmy, updateArmy } from '../systems/army.js';
import { createScroll, updateScroll } from '../systems/scroll.js';
import { createCombat, updateCombat } from '../systems/combat.js';
import { createCamera } from '../view/camera.js';
import { createFieldView } from '../view/fieldView.js';
import { createUnitsView } from '../view/unitsView.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const { width, height } = this.scale;
    const lanes = createLanes(LANES.count, LANES.fieldWidth);
    const centerX = LANES.fieldWidth / 2;

    this.perspective = createCamera({ screenWidth: width, screenHeight: height, centerX });
    this.perspective.update();
    this.fieldView = createFieldView(this.add.graphics(), this.perspective, lanes, height);
    this.unitsView = createUnitsView(this.add.graphics(), this.perspective, centerX);

    this.scroll = createScroll();
    this.combat = createCombat();
    const bus = createEventBus();
    this.army = createArmy(bus, {
      startX: lanes[HERO.startLane].centerX,
      laneCenters: lanes.map((lane) => lane.centerX),
    });

    // Swipe: lo spostamento del dito sullo schermo diventa uno spostamento uguale dell'eroe, alla sua profondità
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.x - pointer.prevPosition.x;
      bus.emit(EVENTS.STEER, dx * this.perspective.worldPerPixelAtHero());
    });
    const endSteer = () => bus.emit(EVENTS.STEER_END);
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    updateScroll(this.scroll, delta);
    updateArmy(this.army, delta);
    updateCombat(this.combat, this.army.x, delta);
    this.perspective.update();
    this.fieldView.draw(this.scroll.distance);
    this.unitsView.draw(this.army.x, this.combat.projectiles);
  }
}
