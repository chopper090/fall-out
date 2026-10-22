import * as Phaser from 'phaser';
import { HERO, LANES } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createLanes } from '../systems/lanes.js';
import { createArmy, updateArmy } from '../systems/army.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const { width, height } = this.scale;
    const lanes = createLanes(LANES.count, width, height);
    lanes.forEach((lane, index) => this.drawLane(lane, index));

    const bus = createEventBus();
    this.army = createArmy(bus, {
      startX: lanes[HERO.startLane].centerX,
      laneCenters: lanes.map((lane) => lane.centerX),
    });
    this.hero = this.add.rectangle(this.army.x, height - HERO.bottomOffset, HERO.size, HERO.size, HERO.color);

    // Swipe: lo spostamento orizzontale del dito, ovunque sullo schermo, sposta l'eroe
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (pointer.isDown) bus.emit(EVENTS.STEER, pointer.x - pointer.prevPosition.x);
    });
    const endSteer = () => bus.emit(EVENTS.STEER_END);
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    updateArmy(this.army, delta);
    this.hero.x = this.army.x;
  }

  drawLane({ x, y, width, height }, index) {
    const color = LANES.colors[index % LANES.colors.length];
    this.add.rectangle(x, y, width, height, color).setOrigin(0);
  }
}
