import * as Phaser from 'phaser';
import { DEPTH, LANES } from '../config/balance.js';
import { EVENTS, GAME_EVENTS } from '../core/events.js';
import { battleResult, createBattle, updateBattle } from '../systems/battle.js';
import { createEnemyFx, updateEnemyFx } from '../fx/enemyFx.js';
import { createArmyFx, shakeOffset, updateArmyFx } from '../fx/armyFx.js';
import { createChestFx, updateChestFx } from '../fx/chestFx.js';
import { createLootFx, updateLootFx } from '../fx/lootFx.js';
import { createGateFx, updateGateFx } from '../fx/gateFx.js';
import { createWeaponFx, updateWeaponFx } from '../fx/weaponFx.js';
import { createHeroFx, updateHeroFx } from '../fx/heroFx.js';
import { createCamera } from '../view/camera.js';
import { createFieldView } from '../view/fieldView.js';
import { createUnitsView } from '../view/unitsView.js';
import { createOverlayView } from '../view/overlayView.js';
import { createMarksView } from '../view/marksView.js';
import { createPawnAtlas } from '../view/pawns.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { isOnHudButton } from './hudButtons.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // Cosa portare in battaglia lo costruisce il meta-gioco (loadout: una funzione) a ogni partenza: ricominciando
  // (pausa, pannello) prende i numeri di adesso, i valori del pannello e il profilo rifatto dopo una cancellazione
  init(data) {
    if (data?.loadout) this.makeLoadout = data.loadout;
  }

  create() {
    const { width, height } = this.scale;
    const centerX = LANES.fieldWidth / 2;

    // La battaglia vera è in systems/battle.js, la stessa del simulatore: qui si disegna e si guida
    this.battle = createBattle(Date.now(), undefined, this.makeLoadout?.() ?? STARTING_LOADOUT);
    const { bus, army, mission, waves, scroll, boss } = this.battle;

    this.perspective = createCamera({ screenWidth: width, screenHeight: height, centerX });
    this.perspective.update();
    createPawnAtlas(this.textures);
    const fieldGraphics = this.add.graphics().setDepth(DEPTH.field);
    this.fieldView = createFieldView(fieldGraphics, this.perspective, this.battle.lanes, height);
    this.marksView = createMarksView(this, this.perspective);
    this.unitsView = createUnitsView(this, this.perspective, centerX);
    this.overlayView = createOverlayView(this, this.perspective);

    this.enemyFx = createEnemyFx(bus);
    this.armyFx = createArmyFx(bus);
    this.chestFx = createChestFx(bus);
    this.lootFx = createLootFx(bus);
    this.gateFx = createGateFx(bus);
    this.weaponFx = createWeaponFx(bus);
    this.heroFx = createHeroFx(bus);
    this.shake = { x: 0, y: 0 };

    // Missione finita, fallita o compiuta: la battaglia si ferma, la schermata di fine la mostra l'interfaccia e il
    // risultato va al meta-gioco (GAME_EVENTS.BATTLE_ENDED); una battaglia lasciata a metà non conta.
    // In pausa la battaglia resta ferma finché il menu non la fa ripartire
    const ended = () => this.game.events.emit(GAME_EVENTS.BATTLE_ENDED, battleResult(this.battle));
    bus.on(EVENTS.MISSION_FAILED, ended);
    bus.on(EVENTS.MISSION_COMPLETED, ended);
    this.paused = false;
    bus.on(EVENTS.GAME_PAUSED, () => {
      this.paused = true;
    });
    // Il dito si è alzato mentre il menu era aperto: ripartendo l'esercito si aggancia come a fine swipe
    bus.on(EVENTS.GAME_RESUMED, () => {
      this.paused = false;
      bus.emit(EVENTS.STEER_END);
    });
    // Ripartendo, per esempio dal pannello di sviluppo, un menu o un riepilogo rimasto aperto si chiude
    this.scene.stop('PauseMenu');
    this.scene.stop('Summary');
    const { armyFx, enemyFx, gateFx } = this;
    const { loot } = this.battle;
    this.scene.launch('BattleUI', { bus, army, mission, waves, scroll, boss, loot, armyFx, enemyFx, gateFx });

    // Swipe: lo spostamento del dito sullo schermo diventa uno spostamento uguale degli eroi, alla loro profondità.
    // Un tocco partito sopra un pulsante dell'interfaccia non guida l'esercito
    const steering = (pointer) => !this.battle.over && !this.paused && !isOnHudButton(pointer.downX, pointer.downY);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (!pointer.isDown || !steering(pointer)) return;
      const dx = pointer.x - pointer.prevPosition.x;
      bus.emit(EVENTS.STEER, dx * this.perspective.worldPerPixelAtHero());
    });
    const endSteer = (pointer) => {
      if (steering(pointer)) bus.emit(EVENTS.STEER_END);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    const { battle } = this;
    if (battle.over || this.paused) return;

    // Prima invecchiano gli effetti già in corso: quelli nati in questo frame vengono disegnati almeno una volta
    const { speed } = battle.scroll;
    updateEnemyFx(this.enemyFx, delta, speed);
    updateArmyFx(this.armyFx, delta);
    updateChestFx(this.chestFx, delta, speed);
    updateLootFx(this.lootFx, delta, speed);
    updateGateFx(this.gateFx, delta);
    updateWeaponFx(this.weaponFx, delta, speed);
    updateHeroFx(this.heroFx, delta);
    updateBattle(battle, delta);

    // La scossa sposta la telecamera della battaglia; a partita finita la telecamera torna ferma
    shakeOffset(this.armyFx, this.shake);
    if (battle.over) this.cameras.main.setScroll(0, 0);
    else this.cameras.main.setScroll(this.shake.x, this.shake.y);

    this.perspective.update();
    this.fieldView.draw(battle.scroll.distance);
    const { boss, abilities, army } = battle;
    const { enemyFx, chestFx, armyFx, lootFx } = this;
    const { projectiles, grenades } = battle.combat;
    const { enemies } = battle.spawner;
    this.marksView.draw(boss, grenades, enemyFx, this.weaponFx, abilities, army, this.heroFx, chestFx, enemies);
    const { shots } = battle.enemyFire;
    const { list: gates } = battle.gates;
    const { list: chests } = battle.chests;
    const { list: loot } = battle.loot;
    this.unitsView.draw(army, projectiles, grenades, shots, enemies, gates, chests, loot, enemyFx, chestFx, armyFx);
    this.overlayView.draw(enemies, gates, chests, loot, enemyFx, chestFx, lootFx, army, abilities);
  }
}
