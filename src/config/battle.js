import { FONT } from './styles.js';

// Battaglia: campo e telecamera, eroi ed esercito, livello e potenza, nemici, cancelli, scrigni e premi in strada.
// Mondo in prospettiva: x di lato, y in alto, z in avanti; gli eroi davanti stanno a z = 0

// Corsie che coprono tutta la larghezza del campo, colori alternati (scuro, chiaro, scuro)
export const LANES = {
  count: 3,
  fieldWidth: 720,
  colors: [0x1f1f29, 0x363645],
};

// Campo fermo, segnato da trattini sui confini tra le corsie: l'esercito non avanza, sono nemici, porte, scrigni e
// bottino a scendere verso di lui, alla velocità dell'ondata in corso (data/waves.js)
export const FIELD = {
  dash: {
    length: 60,
    gap: 60,
    width: 8,
    color: 0x6e6e86,
  },
};

// Telecamera ferma al centro, dietro l'eroe e in alto, inclinata verso il basso
export const CAMERA = {
  height: 1600,
  distance: 900,
  pitchDeg: 46,
  fovDeg: 40,
  drawDistance: 4000,
  nearDepth: 10,
};

// Eroi (data/heroes.js): pedine blu, più alte dei soldati (height, in unità del mondo; size è la larghezza
// della base), in uno dei cinque posti di slots (dx di lato e dz lungo la strada rispetto al punto guidato
// dallo swipe): due davanti e tre dietro. Posti stretti quanto basta perché i colpi dritti dei due davanti
// prendano anche un nemico esattamente al centro e perché gli eroi arrivino al centro delle corsie laterali
// senza uscire dalla strada. A ogni partita ogni eroe si sposta a caso dal suo posto, avanti o indietro lungo la
// strada di al massimo slotJitter, così non stanno in riga (di lato no, per non perdere quelle due misure).
// L'esercito parte nella corsia startLane.
// Ogni eroe ha la sua vita: ogni nemico che lo tocca, o lo colpisce con un suo colpo, gliene toglie quanta ne dice
// il suo tipo (data/enemies.js); a zero muore. Sopra la testa di ognuno la barra della vita e sopra quella la
// barra della ricarica dell'abilità (cooldownBar), misure in unità del mondo; le barre sono larghe barShare della
// sua base, così quelle di due eroi affiancati restano separate
export const HERO = {
  size: 80,
  height: 92,
  barShare: 0.8,
  startLane: 1,
  slots: [
    { dx: -40, dz: 0 },
    { dx: 40, dz: 0 },
    { dx: -80, dz: -75 },
    { dx: 0, dz: -75 },
    { dx: 80, dz: -75 },
  ],
  slotJitter: 12,
  healthBar: {
    height: 12,
    offsetY: 12,
    colors: {
      back: 0x101a33,
      fill: 0x3d7bff,
    },
  },
  cooldownBar: {
    height: 5,
    offsetY: 4,
    colors: {
      back: 0x101a33,
      fill: 0xffe680,
    },
  },
};

// Esercito: soldati di partenza, capo compreso. Riserve, i soldati oltre il tetto della folla (LIMITS.maxArmy in
// data/waves.js): alzano il danno di tutti i colpi fino a maxBonus (0.3 = +30%), sempre meno man mano che
// crescono: le prime halfCount riserve ne danno metà, le successive halfCount metà di quello che resta, e così via
export const ARMY = {
  startSize: 1,
  reserves: { maxBonus: 0.3, halfCount: 20 },
};

// Livello: ondata da cui si parte (le ondate e il boss sono in data/waves.js) e secondi di pausa prima di ognuna
// e prima del boss (che aspetta anche la strada libera); prima della prima ondata la pausa dura firstBreakSeconds.
// La scritta "Ondata N" o "Boss" resta bannerSeconds. Partenza rapida: la prima ondata trova la strada già
// popolata, come se fosse in corso da un po', con nemici e cancelli già in arrivo e il più vicino a headStartZ.
// startWithBoss: la partita parte direttamente dal boss, per provarlo
export const LEVEL = {
  startWave: 1,
  startWithBoss: false,
  breakSeconds: 1.5,
  firstBreakSeconds: 0,
  bannerSeconds: 3,
  headStartZ: 1100,
};

// Potenza (systems/power.js): scale porta la radice di danno al secondo per vita a numeri comodi; blastTargets, nemici
// presi in media da una granata. Quanto alzano la nostra forza (una parte: 0.1 = +10%), misurato con il bot nella
// battaglia normale con lo schieramento di partenza (C32: il fattore di vita dei nemici a cui si vince metà delle
// partite, con e senza): abilities, il potere di ogni tipo con l'eroe comune al primo grado; soldierTypes, ogni tipo di
// soldato per la sua quota dell'esercito, al posto di un fuciliere; forge, ogni arma della fucina a ogni livello, con
// l'esercito di riferimento (cinque fucilieri ogni lanciatore; la raffica con tre fucilieri, due raffiche e un
// lanciatore), resi crescenti dove la misura oscilla; forgeOthers, quanto contano le armi dopo la più alta (tutte al
// livello 5 valgono +85%, non la somma). Lo scudo e il soccorso non cambiano le vittorie e valgono 0. levelScale pesa
// la potenza del livello, tarata con il bot perché a rapporto 1 (nostra potenza uguale a quella del livello) si vinca
// circa metà delle partite. bands: fasce di difficoltà dalla più facile, ognuna da un rapporto from in su, con il suo
// nome e il suo colore, e la parte di partite che promette di vincere: da wins in su, fino a wins della fascia più
// facile. Tarate con il simulatore (npm run sim) cambiando la vita dei nemici. Limite noto: i soldati presi ai cancelli
// contano solo attraverso le parti misurate
export const POWER = {
  scale: 5,
  blastTargets: 2,
  abilities: {
    rally: 0.05,
    rapidFire: 0.16,
    shield: 0,
    shockwave: 0.05,
    pierce: 0.03,
    bombard: 0.11,
    rescue: 0,
    mark: 0.055,
    fury: 0.04,
  },
  soldierTypes: { rifle: 0, burst: 0.48, launcher: 0.7, elite: 0.13 },
  forge: {
    rifle: [0.08, 0.12, 0.27, 0.27, 0.47],
    burst: [0.05, 0.07, 0.1, 0.14, 0.28],
    launcher: [0.16, 0.32, 0.32, 0.66, 0.7],
  },
  forgeOthers: 0.3,
  levelScale: 0.019,
  bands: [
    { from: 1.35, label: 'Facile', color: 0x66bb6a, wins: 0.7 },
    { from: 1, label: 'Normale', color: 0xffe680, wins: 0.5 },
    { from: 0.75, label: 'Difficile', color: 0xffa726, wins: 0.25 },
    { from: 0.6, label: 'Molto difficile', color: 0xef5350, wins: 0.1 },
    { from: 0, label: 'Proibitiva', color: 0xab47bc, wins: 0 },
  ],
};

// Missione: fallisce se muore il capo (leader, data/heroes.js) o se maxEscaped nemici superano l'esercito
export const MISSION = {
  maxEscaped: 3,
};

// Plotoni: i soldati (pedine blu) si raggruppano a size a size, nell'ordine in cui arrivano: ogni plotone
// segue l'eroe con un ritardo di followMs, così la folla ondeggia quando si sposta. Quando qualcuno muore
// i superstiti stringono le file verso l'eroe: chi cambia posto ci arriva con un ritardo di depthMs lungo
// la strada e di sideMs di lato. Misure in unità del mondo
export const PLATOONS = {
  size: 10,
  soldierSize: 20,
  soldierHeight: 30,
  followMs: 90,
  regroup: {
    sideMs: 140,
    depthMs: 50,
  },
  // Numero dei soldati sopra l'esercito, offsetY sopra la testa del capo (sopra le sue barre)
  counter: {
    offsetY: 50,
    style: {
      fontFamily: FONT,
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
};

// Folla attorno agli eroi (systems/formation.js), compatta e sparpagliata: cresce in cerchi attorno al centro degli
// eroi (shape: quanto contano la distanza di lato, ax, e lungo la strada, az; 1 e 1 è un cerchio), spostato in
// avanti di frontBias a fargli da scudo. I posti partono da una griglia a nido d'ape (spacing tra due vicini) e
// ognuno è spostato a caso di al massimo jitter, così i soldati non stanno in riga; heroGap: spazio libero attorno a
// ogni eroe; nessuno più di back dietro il punto guidato (il fondo dello schermo). La folla è fluida: contro il bordo
// della strada un soldato resta schiacciato finché ne uscirebbe di più di squeeze, poi il suo posto si chiude e la
// folla scorre a catena tra posti accanto fino a riempire i primi posti liberi attorno agli eroi; il posto si riapre
// quando ci sta tutto dentro. rows e columns: fin dove arriva la griglia dei posti possibili, abbastanza perché una
// folla piena fino a 150 soldati (il tetto più alto del pannello) ci stia anche contro il bordo. La folla non è mai
// più larga di maxLanes corsie (con i soldati interi dentro): una corsia resta sempre libera per schivare, e chi
// cresce si allunga verso il fondo invece di allargarsi
export const FORMATION = {
  spacing: 30,
  jitter: 8,
  heroGap: 8,
  shape: { ax: 1, az: 1 },
  frontBias: 15,
  back: 185,
  squeeze: 12,
  rows: 12,
  columns: 10,
  maxLanes: 2,
};

// Ordine di disegno: il campo sotto, i segni a terra (zona del boss, ombre e scoppi delle granate, cerchio degli
// scrigni aperti), poi pedine, colpi, cancelli e scrigni (dal più lontano al più vicino a partire da world), sopra
// tutto barre, numeri e scritte
export const DEPTH = {
  field: 0,
  marks: 1,
  world: 10000,
  overlay: 20000,
};

// Poteri degli eroi che fanno danno (systems/powers.js): ogni nemico colpito perde la quota share della sua vita
// (ability.share, data/heroes.js), per targetShare se è un'élite o un boss, per il danno in più di scrigni e riserve
// (systems/army.js damageMultiplier). La quota cresce con la forza dell'eroe (rarità, livello e stelle) e con quella
// del grado del potere (GROWTH.gradeDamage, data/growth.js), elevate a growthExponent (meta/heroes.js heroData). Gli
// eroi dalla rarità upgradeFrom in su hanno i numeri di ability.upgrade (data/heroes.js): l'effetto in più della loro
// rarità
export const HERO_POWERS = {
  targetShare: { elite: 0.5, boss: 0.08 },
  growthExponent: 0.75,
  upgradeFrom: 'epic',
};

// Pedine in grigio, come pezzi di un gioco da tavolo: base tonda con il suo spessore, corpo che si stringe
// verso il collo, testa tonda. Ogni tipo è disegnato una volta in un'unica immagine e mostrato in piedi,
// rivolto alla telecamera, grande quanto vuole la sua distanza: la grafica vera prenderà il posto dell'immagine.
// Misure in frazioni della larghezza della pedina: head raggio della testa, neck e waist larghezza del corpo
// in alto e in basso, base altezza dell'ellisse della base; detail: collare, elmo piatto, corona, corna
// (horns: punti di ogni corno in raggi della testa), canna (muzzle: bordo e foro in raggi della testa) o pennacchio
// (plume: larghezza, altezza e affondamento nella testa, in raggi della testa) o fascia (band: altezza e
// spostamento del centro dal centro della testa, in raggi della testa). Gli eroi hanno tutti la sagoma hero,
// ognuno con il suo segno (data/heroes.js) e la base del colore della sua rarità.
// textureScale: pixel dell'immagine per unità del mondo; atlasWidth: la sua larghezza più grande (i riquadri vanno a
// capo)
export const PAWNS = {
  textureScale: 1.6,
  padding: 2,
  atlasWidth: 2048,
  baseThickness: 0.1,
  neckDrop: 0.7,
  shadeShare: 0.28,
  highlight: { offset: 0.32, size: 0.38 },
  collar: { width: 1.9, height: 0.32 },
  helmet: { width: 1.15, height: 1.5, brim: 0.32, rim: 1.25 },
  crown: { width: 0.85, height: 0.22, sink: 0.25 },
  horns: { inner: [0.35, 0.85], outer: [0.88, 0.3], tip: [1.55, 1.75] },
  muzzle: { ring: 0.8, hole: 0.5, holeColor: 0x1a0a0a },
  plume: { width: 0.35, height: 1.1, sink: 0.3 },
  band: { height: 0.36, offset: -0.3 },
  shapes: {
    rifleSoldier: { head: 0.3, neck: 0.3, waist: 0.66, base: 0.36 },
    burstSoldier: { head: 0.26, neck: 0.24, waist: 0.56, base: 0.34 },
    launcherSoldier: { head: 0.28, neck: 0.36, waist: 0.74, base: 0.38, detail: 'helmet' },
    eliteSoldier: { head: 0.3, neck: 0.3, waist: 0.66, base: 0.36, detail: 'plume' },
    hero: { head: 0.22, neck: 0.24, waist: 0.6, base: 0.32 },
    grunt: { head: 0.25, neck: 0.27, waist: 0.62, base: 0.34 },
    swarm: { head: 0.36, neck: 0.42, waist: 0.72, base: 0.38 },
    fast: { head: 0.2, neck: 0.2, waist: 0.46, base: 0.3 },
    armored: { head: 0.26, neck: 0.32, waist: 0.68, base: 0.34, detail: 'helmet' },
    elite: { head: 0.22, neck: 0.27, waist: 0.64, base: 0.32, detail: 'crown' },
    shooter: { head: 0.26, neck: 0.24, waist: 0.56, base: 0.34, detail: 'muzzle' },
    boss: { head: 0.16, neck: 0.36, waist: 0.84, base: 0.34, detail: 'horns' },
  },
};

// Scudo di un eroe (abilità shield): un anello a terra attorno all'esercito, a margin dal suo bordo, finché dura
export const SHIELD_RING = {
  color: 0x9ad0ff,
  fillAlpha: 0.12,
  ringWidth: 5,
  ringAlpha: 0.8,
  margin: 20,
};

// Zona che il boss sta per schiacciare, segnata a terra sotto le pedine: un cerchio rosso che si riempie
// man mano che il colpo si avvicina (opacità da fillAlpha.from a fillAlpha.to), con il bordo (larghezza
// in pixel). segments: lati del cerchio
export const SMASH_ZONE = {
  segments: 32,
  color: 0xff1a1a,
  fillAlpha: { from: 0.12, to: 0.45 },
  ringWidth: 6,
  ringAlpha: 0.9,
};

// Colpi dell'esercito (le armi sono in data/units.js): palline sopra la folla, flightHeight è l'altezza a cui si
// disegna il centro dei colpi dritti, poco sopra la testa dei soldati. Le riserve oltre la folla in campo alzano il
// danno di tutti i colpi (ARMY.reserves). Le granate hanno un'ombra a terra, di colore shadow.color, larga quanto la
// granata, che mostra dove sono. Nell'ultima parte della gittata (fade.share) i colpi dritti sbiadiscono fino a sparire
// e si rimpiccioliscono fino a fade.minScale, sempre più in fretta verso la fine (fade.curve: 1 regolare, più grande
// resta pieno più a lungo): la fine della gittata non è una riga e i colpi che colpiscono poco prima si vedono ancora
// bene. I pallini pesanti della raffica (la fucina: weapon.heavy) si disegnano heavyScale volte più grandi (solo a
// vedersi: colpiscono come gli altri). Le pool partono grandi quanto il picco dei colpi in campo, così a metà
// battaglia, con la folla che cresce, non se ne creano altri: misurato con il bot (60 battaglie per durata) 721 colpi
// senza villaggio; con l'esercito della caserma al livello 5 (élite comprese) 753 con le armi di base e 1403 con le
// armi della fucina al livello 5 (i colpi che passano i nemici volano più a lungo, la raffica ha più pallini);
// granate al massimo 33
export const SHOTS = {
  flightHeight: 30,
  shadow: { color: 0x000000, alpha: 0.35 },
  fade: { share: 0.25, minScale: 0.5, curve: 2 },
  heavyScale: 1.6,
  poolSize: 1400,
  grenadePoolSize: 60,
};

// Colpi dei nemici che sparano: palline rosse più grandi e più lente delle nostre, che volano dritte dal tiratore
// verso il punto dove stava uno degli eroi, a caso, quando ha sparato, e oltre. Si fermano sulla prima pedina
// dell'esercito che toccano: un soldato perde una vita (un'élite ne ha ELITE.lives), un eroe la vita del tipo del
// tiratore; con lo scudo del
// difensore alzato si fermano senza fare danno. Passano tra i nostri colpi senza
// scontrarsi. Spariscono oltre despawnZ o fuori dalla strada; flightHeight: altezza a cui si disegnano
export const ENEMY_SHOT = {
  speed: 450,
  size: 22,
  flightHeight: 40,
  despawnZ: -300,
  colors: {
    top: 0xffb4a8,
    front: 0xe53935,
    side: 0xa52a2a,
  },
  poolSize: 24,
};

// Nemici: i tipi sono in data/enemies.js; vita, frequenza e composizione degli arrivi le decide l'ondata
// in corso (data/waves.js). Compaiono a spawnDistance in fondo alla strada; i nemici di una fila ognuno fino a
// rowStagger più indietro, così la fila non è in riga. Chi tocca l'esercito si scontra
// e sparisce: toglie tante vite di soldato quanta vita gli resta (almeno una a ognuno di quelli che tocca) e a ogni
// eroe che tocca toglie
// la vita del suo tipo. Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ, già sotto
// il bordo dello schermo. L'armatura toglie danno a ogni colpo, ma ne lascia passare almeno minDamageShare.
// queueGap: spazio che un nemico lascia davanti a sé quando resta in coda a un altro.
// Ogni nemico entra in un punto a caso della sua corsia, restandoci dentro con laneMargin di spazio dal bordo;
// uno sciame si sposta tutto insieme. I cancelli invece stanno sempre al centro della corsia.
// Freno: a campo fermo (durante il boss) ogni colpo frena chi cammina da solo, il boss e la sua scorta: il freno
// sale di brake.strength volte la parte di vita che il colpo toglie (un colpo che toglie un decimo della vita, con
// strength 12, frena di 1.2, cioè del tutto), fino al maxBrake del tipo (data/enemies.js), e torna a zero da solo:
// ne resta una parte che si dimezza ogni brake.halfLifeMs. Con freno 1 il nemico è fermo, con 0.65 va al 35%.
// Contraccolpo: ogni colpo spinge il nemico indietro, lungo la strada, a una velocità di knockback.strength unità/s
// per la parte di vita che gli toglie, per il knockback del tipo (data/enemies.js), fino a knockback.maxSpeed; la
// spinta cala da sola, dimezzandosi ogni knockback.halfLifeMs: un colpo che toglie un decimo della vita, con
// strength 700 e halfLifeMs 120, lo sposta indietro di circa 12 unità; sotto il fuoco di una folla rallenta. Una
// spinta più forte fa ammassare i nemici respinti, che poi arrivano tutti insieme (misurato con il simulatore)
export const ENEMIES = {
  spawnDistance: 2400,
  despawnZ: -300,
  minDamageShare: 0.25,
  queueGap: 12,
  rowStagger: 80,
  laneMargin: 8,
  brake: { strength: 12, halfLifeMs: 700 },
  knockback: { strength: 700, maxSpeed: 400, halfLifeMs: 120 },
  poolSize: 280,
  swarmPoolSize: 10,
  shooterPoolSize: 8,
};

// Cancelli (tipi in data/gates.js, quali e con che numeri lo decide l'ondata in data/waves.js): uno o una coppia
// ogni spawnInterval secondi, sempre al centro della corsia, solo durante le ondate. Ogni colpo che li tocca alza il
// loro numero di perHit, fino al loro massimo.
// Gialli se danno soldati, rossi (malusColors) se li tolgono. Misure in unità del mondo: larghi poco meno di una
// corsia. Valgono solo per gli eroi (systems/gates.js): quelli che gli eroi mancano vanno avanti senza effetto e
// spariscono a despawnZ, già sotto il bordo dello schermo
export const GATES = {
  spawnInterval: 4,
  perHit: 1,
  spawnDistance: 2400,
  despawnZ: -300,
  width: 220,
  depth: 16,
  postWidth: 16,
  postHeight: 150,
  beamHeight: 56,
  colors: {
    top: 0xffe680,
    front: 0xf5c518,
    side: 0xc99a00,
  },
  malusColors: {
    top: 0xff8a80,
    front: 0xe53935,
    side: 0xa52a2a,
  },
  // Insegna sulla trave ("+N" o "−N"): minScale la tiene leggibile anche lontano; le scritte lunghe si
  // rimpiccioliscono in proporzione, per occupare al massimo maxWidthShare della trave. Scritta scura su tutti i
  // cancelli
  sign: {
    minScale: 0.5,
    maxWidthShare: 0.9,
    style: {
      fontFamily: FONT,
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#1a1a1a',
    },
  },
  poolSize: 8,
};

// Scrigni (ricompense in data/chests.js; colpi per aprirli e ricompense le decide l'ondata in data/waves.js): la fonte
// principale di potenza, uno ogni everyGates arrivi di cancelli, a metà tra due arrivi (il primo dell'ondata dopo
// firstAfterGates intervalli dei cancelli, prima del suo primo cancello), al centro di una corsia a caso, solo durante
// le ondate; compaiono a spawnDistance in fondo alla strada. Fermano i colpi dritti e ognuno toglie uno al contatore, o
// weapon.gateHits con la fucina (le granate ci volano sopra, tranne quelle con la spoletta, che ci scoppiano e ne
// tolgono weapon.fuse: systems/combat.js); a zero lo scrigno si apre. armWidth: larghezza della parte di folla,
// centrata sullo scrigno, che prende l'arma di uno scrigno d'arma. Misure in unità del mondo: una cassa gialla come
// tutti i bonus, con il coperchio più chiaro e largo overhang in più per lato
export const CHESTS = {
  everyGates: 1,
  firstAfterGates: 0.5,
  spawnDistance: 2400,
  width: 130,
  depth: 90,
  height: 64,
  lid: { height: 22, overhang: 8 },
  armWidth: 220,
  colors: GATES.colors,
  lidColors: { top: 0xfff2b3, front: 0xffd84d, side: 0xe0b22a },
  // Sul fronte della cassa i colpi che mancano, sopra il coperchio la ricompensa ("+10% danno", "Raffica",
  // "+2 vita", "+5 élite"), a rewardOffsetY: minScale le tiene leggibili anche lontano. words: le parole dopo i
  // numeri
  sign: {
    minScale: 0.5,
    rewardOffsetY: 34,
    words: { damage: 'danno', fireRate: 'cadenza', heal: 'vita', elite: 'élite' },
    hitsStyle: {
      fontFamily: FONT,
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#1a1a1a',
    },
    rewardStyle: {
      fontFamily: FONT,
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffe680',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
  poolSize: 10,
};

// Premi in strada (systems/loot.js; cosa lasciano e quanto valgono in data/rewards.js): scatole basse larghe width,
// profonde depth e alte height, gialle come i bonus in una tonalità per tipo; i premi di uno stesso nemico cadono
// in fila lungo la strada, a spread l'uno dietro l'altro (le loro scritte non si coprono). A campo fermo (il boss)
// scivolano da soli verso l'esercito a ownSpeed unità/s. Sopra ognuno quanto vale ("+3 legno", con le parole di
// words, e di one per uno), a sign.offsetY sopra la scatola. seedOffset: il bottino ha un seme suo, quello della
// battaglia più seedOffset, così non tocca la sequenza casuale del resto della battaglia (i premi in strada però
// contano come oggetti sulla strada: il boss e la fine del livello li aspettano)
export const LOOT = {
  width: 56,
  depth: 40,
  height: 30,
  spread: 110,
  ownSpeed: 260,
  seedOffset: 7919,
  colors: {
    wood: { top: 0xffe08a, front: 0xe0b23a, side: 0xa8821f },
    stone: { top: 0xf6f1dc, front: 0xd9d2ae, side: 0x9e9772 },
    xp: { top: 0xfff4b8, front: 0xffe066, side: 0xc9a92e },
    fragments: { top: 0xffd27a, front: 0xff9f1c, side: 0xc2700a },
    gears: { top: 0xeee3b0, front: 0xc9b86a, side: 0x8c7f3e },
    gems: { top: 0xd8f6ff, front: 0x4dd0e1, side: 0x00838f },
  },
  // Le parole delle risorse, anche per il villaggio e il riepilogo (of: tra i frammenti e l'eroe, "+5 frammenti di
  // Fenice")
  words: {
    wood: 'legno',
    stone: 'pietra',
    xp: 'esperienza',
    fragments: 'frammenti',
    dogTags: 'piastrine',
    gears: 'ingranaggi',
    circuits: 'circuiti',
    gems: 'gemme',
    rations: 'razioni',
  },
  one: {
    wood: 'legno',
    stone: 'pietra',
    xp: 'esperienza',
    fragments: 'frammento',
    dogTags: 'piastrina',
    gears: 'ingranaggio',
    circuits: 'circuito',
    gems: 'gemma',
    rations: 'razione',
  },
  of: 'di',
  sign: {
    offsetY: 30,
    minScale: 0.5,
    style: {
      fontFamily: FONT,
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#ffe680',
      stroke: '#000000',
      strokeThickness: 6,
    },
  },
  poolSize: 16,
};
