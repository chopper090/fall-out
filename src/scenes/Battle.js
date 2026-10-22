import * as Phaser from 'phaser';
import { HERO, LANES } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { createLanes } from '../systems/lanes.js';
import { createArmy, updateArmy } from '../systems/army.js';
import { createScroll, updateScroll } from '../systems/scroll.js';
import { breachEnemies, createSpawner, updateSpawner } from '../systems/spawn.js';
import { createCombat, updateCombat } from '../systems/combat.js';
import { createEnemyFx, updateEnemyFx } from '../fx/enemyFx.js';
import { createArmyFx, shakeOffset, updateArmyFx } from '../fx/armyFx.js';
import { createCamera } from '../view/camera.js';
import { createFieldView } from '../view/fieldView.js';
import { createUnitsView } from '../view/unitsView.js';
import { createOverlayView } from '../view/overlayView.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const { width, height } = this.scale;
    const lanes = createLanes(LANES.count, LANES.fieldWidth);
    const laneCenters = lanes.map((lane) => lane.centerX);
    const centerX = LANES.fieldWidth / 2;

    this.perspective = createCamera({ screenWidth: width, screenHeight: height, centerX });
    this.perspective.update();
    this.fieldView = createFieldView(this.add.graphics(), this.perspective, lanes, height);
    this.unitsView = createUnitsView(this.add.graphics(), this.perspective, centerX);
    this.overlayView = createOverlayView(this, this.perspective);

    const bus = createEventBus();
    this.scroll = createScroll();
    this.army = createArmy(bus, { startX: laneCenters[HERO.startLane], laneCenters });
    this.spawner = createSpawner(bus, createRng(Date.now()), laneCenters);
    this.combat = createCombat(bus);
    this.enemyFx = createEnemyFx(bus);
    this.armyFx = createArmyFx(bus);
    this.shake = { x: 0, y: 0 };

    // Energia finita: la battaglia si ferma, la schermata di fine la mostra l'interfaccia
    this.over = false;
    bus.on(EVENTS.ARMY_DEFEATED, () => {
      this.over = true;
    });
    this.scene.launch('BattleUI', { bus, army: this.army, scroll: this.scroll, armyFx: this.armyFx });

    // Swipe: lo spostamento del dito sullo schermo diventa uno spostamento uguale dell'eroe, alla sua profondità
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (!pointer.isDown || this.over) return;
      const dx = pointer.x - pointer.prevPosition.x;
      bus.emit(EVENTS.STEER, dx * this.perspective.worldPerPixelAtHero());
    });
    const endSteer = () => bus.emit(EVENTS.STEER_END);
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    if (this.over) return;

    // Prima invecchiano gli effetti già in corso: quelli nati in questo frame vengono disegnati almeno una volta
    updateEnemyFx(this.enemyFx, delta);
    updateArmyFx(this.armyFx, delta);
    updateScroll(this.scroll, delta);
    updateArmy(this.army, delta);
    updateSpawner(this.spawner, delta);
    updateCombat(this.combat, this.army.x, this.spawner.enemies, delta);
    breachEnemies(this.spawner);

    // La scossa sposta la telecamera della battaglia; a partita finita la telecamera torna ferma
    shakeOffset(this.armyFx, this.shake);
    if (this.over) this.cameras.main.setScroll(0, 0);
    else this.cameras.main.setScroll(this.shake.x, this.shake.y);

    this.perspective.update();
    this.fieldView.draw(this.scroll.distance);
    this.unitsView.draw(this.army.x, this.combat.projectiles, this.spawner.enemies, this.enemyFx);
    this.overlayView.draw(this.spawner.enemies, this.enemyFx);
  }
}
