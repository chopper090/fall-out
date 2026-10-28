import { ENEMY_TYPES } from '../data/enemies.js';
import { ELITE, WEAPONS } from '../data/units.js';
import { CATEGORIES } from '../data/heroes.js';
import { BOSS, LIMITS, WAVES } from '../data/waves.js';
import { CHEST_KINDS } from '../data/chests.js';
import { ARMY, CAMERA, CHESTS, ENEMIES, ENEMY_SHOT, GATES, LEVEL, MISSION, PLATOONS, SHOTS } from './battle.js';
import { FX } from './fx.js';
import { CONTROLS } from './settings.js';
import { FONT } from './styles.js';

// Schermo degli strumenti di sviluppo: contatore FPS, acceso dal pannello
export const DEV_SCREEN = {
  showFps: false,
};

// Difficoltà di prova, dal pannello di sviluppo (il giocatore non la vede): in ogni battaglia i nemici hanno
// enemyHpScale volte la vita e arrivano enemyCountScale volte più fitti, oltre alle regole della battaglia; la potenza
// del livello nello schieramento ne tiene conto. A 1 tutto com'è
export const TEST_BATTLE = {
  enemyHpScale: 1,
  enemyCountScale: 1,
};

// Cartelle del pannello per gli eroi: per ogni categoria la vita, la sua abilità, con i campi che l'abilità ha
// (ABILITY_FIELDS), e i numeri che cambiano dall'epico in su (ability.upgrade, che per quegli eroi vince sugli altri);
// valgono per tutti gli eroi della categoria (data/heroes.js)
const ABILITY_FIELDS = {
  cooldownSeconds: { label: 'ricarica (s, da prossima partita)', min: 1, max: 30, step: 0.5 },
  radius: { label: 'raggio (da prossima partita)', min: 50, max: 500, step: 10 },
  share: { label: 'quota della vita (da prossima partita)', min: 0.05, max: 2, step: 0.01 },
  seconds: { label: 'dura (s, da prossima partita)', min: 0.5, max: 10, step: 0.5 },
  fireRateScale: { label: 'cadenza (volte, da prossima partita)', min: 1, max: 5, step: 0.1 },
  range: { label: 'gittata (da prossima partita)', min: 200, max: 2000, step: 50 },
  width: { label: 'larghezza (da prossima partita)', min: 10, max: 200, step: 5 },
  reactSeconds: { label: 'anticipo (s, da prossima partita)', min: 0.1, max: 3, step: 0.1 },
  damageBonus: { label: 'danno in più (da prossima partita)', min: 0, max: 2, step: 0.05 },
  fireRateBonus: { label: 'cadenza in più (da prossima partita)', min: 0, max: 2, step: 0.05 },
  smashCut: { label: 'schianto in meno (da prossima partita)', min: 0, max: 1, step: 0.05 },
  pushSpeed: { label: 'spinta (da prossima partita)', min: 0, max: 800, step: 20 },
  stunSeconds: { label: 'ferma (s, da prossima partita)', min: 0, max: 5, step: 0.1 },
  gateHits: { label: 'colpi alle porte (da prossima partita)', min: 0, max: 20, step: 1 },
  healShare: { label: 'vita agli eroi (da prossima partita)', min: 0, max: 1, step: 0.05 },
  soldiers: { label: 'soldati che tornano (da prossima partita)', min: 0, max: 40, step: 1 },
  gateShare: { label: 'parte delle porte che torna (da prossima partita)', min: 0, max: 1, step: 0.05 },
  belowShare: { label: 'parte quando la vita è sotto (da prossima partita)', min: 0, max: 1, step: 0.05 },
  minLost: { label: 'parte con soldati persi almeno (da prossima partita)', min: 1, max: 40, step: 1 },
  markBonus: { label: 'danno in più al marchiato (da prossima partita)', min: 0, max: 2, step: 0.05 },
  marks: { label: 'nemici marchiati (da prossima partita)', min: 1, max: 5, step: 1 },
};
const HERO_FOLDERS = Object.values(CATEGORIES).flatMap((category) => [
  {
    title: category.role,
    target: category,
    fields: { maxHp: { label: 'vita (da prossima partita)', min: 1, max: 30, step: 1 } },
  },
  { title: `Abilità · ${category.role}`, target: category.ability, fields: abilityFields(category.ability) },
  {
    title: `Abilità dall'epico · ${category.role}`,
    target: category.ability.upgrade,
    fields: abilityFields(category.ability.upgrade),
  },
]);

function abilityFields(numbers) {
  return Object.fromEntries(
    Object.keys(numbers).flatMap((key) => (ABILITY_FIELDS[key] ? [[key, ABILITY_FIELDS[key]]] : [])),
  );
}

// Strumenti di sviluppo: il pannello si apre dalla sezione Sviluppo dell'ingranaggio e resta aperto
// finché non lo si richiude da lì. Durante lo sviluppo ci sono anche nel link pubblico
export const DEBUG = {
  fpsOverlay: {
    refreshMs: 500,
    margin: '8px',
    padding: '2px 6px',
    font: '12px monospace',
    color: '#ffffff',
    background: 'rgba(0, 0, 0, 0.6)',
  },
  panelTitle: 'Debug',
  restartLabel: 'Ricomincia la partita',
  // Test delle partite di fila, il gate della Fase 3 (debug/playtest.js): spento dal gate della Fase 4, che si gioca
  // senza strumenti (si riaccende dal pannello). games: partite del test; storageKey e version: il registro salvato sul
  // telefono (version sale quando cambia il livello, così il registro riparte da zero); questions: le domande della
  // scheda sotto la schermata di fine, ognuna con le sue risposte e il nome breve per il riepilogo; labels: le scritte
  // della scheda e del pannello
  playtest: {
    enabled: false,
    games: 10,
    storageKey: 'fall-out.playtest',
    version: 3,
    title: 'Test delle 10 partite',
    questions: [
      { id: 'boredom', label: 'Ti ha annoiato?', short: 'noia', options: ['no', "un po'", 'sì'] },
      {
        id: 'difficulty',
        label: "Com'era la difficoltà?",
        short: 'difficoltà',
        options: ['troppo facile', 'giusta', 'troppo difficile'],
      },
    ],
    labels: {
      of: 'di',
      summary: 'Vedi il riepilogo',
      copy: 'Copia il riepilogo',
      copied: 'Copiato: incollalo nella chat',
      copyHint: 'Tieni premuto sul testo per copiarlo',
      newTest: 'Nuovo test',
      close: 'Chiudi',
      done: 'Test finito',
      enabled: 'attivo',
      played: 'partite',
    },
  },
  // Le schede sopra il gioco (debug/card.js), del test delle partite, del salvataggio da copiare e incollare e del
  // registro degli errori: un riquadro in basso al centro, con le sue scritte, la casella di testo (textFont,
  // textHeight) e i pulsanti
  card: {
    bottom: '12px',
    width: 'min(92vw, 400px)',
    padding: '10px 12px',
    radius: '10px',
    gap: '6px',
    background: 'rgba(16, 18, 24, 0.92)',
    color: '#ffffff',
    font: `15px ${FONT}`,
    titleFont: `bold 15px ${FONT}`,
    textFont: '12px monospace',
    textHeight: '40vh',
    button: '#2a2f3a',
    selected: '#3d7bff',
    buttonPadding: '10px 4px',
    zIndex: '10',
  },
  // Trucchi di prova sul meta-gioco (debug/metaPanel.js), nella prima cartella del pannello: start, i numeri da cui
  // partono le sue caselle (risorse da aggiungere, casella della strada, aree conquistate, livello, stelle e grado
  // dell'eroe); skipOptions, il tempo che si può far passare; labels, le scritte, con l'esito dell'ultimo trucco (i
  // posti cantiere al limite: da 1 a uno per edificio, non meno dei cantieri aperti)
  meta: {
    title: 'Meta · trucchi di prova',
    start: { amount: 100, tile: 0, areas: 1, level: 10, stars: 3, grade: 3 },
    skipOptions: [
      { label: '10 minuti', minutes: 10 },
      { label: '1 ora', minutes: 60 },
      { label: '8 ore', minutes: 480 },
      { label: '1 giorno', minutes: 1440 },
    ],
    labels: {
      note: 'esito',
      done: 'fatto',
      noBuild: 'nessun cantiere aperto',
      buildersLimit: 'posti già al limite',
      noBattle: 'nessuna battaglia in corso',
      readOnly: 'sola lettura: non si salva',
      writeFailed: 'non si riesce a salvare',
      amount: 'risorse',
      addResources: 'Aggiungi a tutte le risorse',
      finishBuild: 'Finisci i cantieri',
      builders: 'posti cantiere',
      addBuilder: 'Posti cantiere +1',
      removeBuilder: 'Posti cantiere -1',
      skip: 'tempo',
      skipTime: 'Fai passare il tempo',
      tile: 'casella (0 porta)',
      jumpToTile: 'Vai alla casella',
      areas: 'aree conquistate',
      jumpToArea: 'Conquista fin qui',
      unlockHeroes: 'Sblocca tutti gli eroi',
      hero: 'eroe',
      level: 'livello',
      stars: 'stelle',
      grade: 'grado del potere',
      setHero: "Dai livello, stelle e grado all'eroe",
      win: 'Vinci la battaglia',
      lose: 'Perdi la battaglia',
      exportSave: 'Copia il salvataggio',
      importSave: 'Incolla un salvataggio',
    },
  },
  // Il salvataggio da copiare e incollare (debug/saveTransfer.js): le scritte della sua scheda, con com'è andato un
  // salvataggio incollato che non entra (core/save.js importSave: invalid, newer, failed)
  saveTransfer: {
    labels: {
      exportTitle: 'Il salvataggio, da copiare',
      importTitle: 'Incolla un salvataggio',
      importHint: 'Incolla qui il testo copiato: quello di adesso resta nella copia di riserva',
      copy: 'Copia',
      copied: 'Copiato',
      copyHint: 'Tieni premuto sul testo per copiarlo',
      load: 'Carica',
      close: 'Chiudi',
      invalid: 'Non è un salvataggio: non è cambiato niente',
      newer: 'È di una versione più nuova del gioco: non è cambiato niente',
      failed: 'Non si riesce a salvare: non è cambiato niente',
    },
  },
  // Il registro degli errori (debug/errorReport.js): il pulsante in cima al pannello, che lo copia e lo mostra in una
  // scheda sopra il gioco, e le scritte della scheda (empty: il registro è vuoto, cleared: appena svuotato)
  errorLog: {
    button: 'Copia il registro degli errori',
    labels: {
      title: 'Il registro degli errori',
      copy: 'Copia',
      copied: 'Copiato: incollalo nella chat',
      copyHint: 'Tieni premuto sul testo per copiarlo',
      clear: 'Svuota',
      cleared: 'Registro svuotato',
      empty: 'Nessun errore',
      close: 'Chiudi',
    },
  },
  // Le battaglie rigiocabili (systems/replay.js, debug/replay.js, npm run replay): format, la versione del formato
  // registrato (sale quando cambia); le ultime keep battaglie finite stanno sul telefono sotto storageKey; seedParam,
  // il nome del seme fisso nell'indirizzo, per le prove (?seed=N, solo nelle build di sviluppo); il pulsante in cima
  // al pannello che copia l'ultima battaglia, e le scritte della sua scheda (empty: nessuna battaglia finita)
  replay: {
    format: 2,
    storageKey: 'fall-out.replays',
    keep: 3,
    seedParam: 'seed',
    button: "Copia l'ultima battaglia",
    labels: {
      title: "L'ultima battaglia, da rigiocare",
      copy: 'Copia',
      copied: 'Copiato: incollalo nella chat',
      copyHint: 'Tieni premuto sul testo per copiarlo',
      empty: 'Nessuna battaglia finita',
      close: 'Chiudi',
    },
  },
  // Il registro degli eventi della battaglia (debug/eventLog.js), che va nel registro degli errori: gli ultimi size
  // eventi, ognuno con il frame, il nome e fino a fields valori semplici di quello che porta
  eventLog: {
    size: 50,
    fields: 3,
  },
  folders: [
    {
      title: 'Difficoltà di prova',
      target: TEST_BATTLE,
      fields: {
        enemyHpScale: { label: 'vita dei nemici (×, da prossima partita)', min: 0.5, max: 3, step: 0.1 },
        enemyCountScale: { label: 'numero dei nemici (×, da prossima partita)', min: 0.5, max: 3, step: 0.1 },
      },
    },
    {
      title: 'Schermo',
      target: DEV_SCREEN,
      fields: {
        showFps: { label: 'mostra FPS' },
      },
    },
    {
      title: 'Comandi',
      target: CONTROLS,
      fields: {
        sensitivity: { label: 'sensibilità', min: 0.5, max: 2, step: 0.05 },
        snapEnabled: { label: 'aggancio' },
        snapRadius: { label: 'raggio (px)', min: 0, max: 120, step: 1 },
        snapSpeed: { label: 'velocità (px/s)', min: 100, max: 3000, step: 50 },
        keyboardSpeed: { label: 'tastiera (px/s)', min: 100, max: 3000, step: 50 },
      },
    },
    {
      title: 'Livello',
      target: LEVEL,
      fields: {
        startWave: { label: 'ondata iniziale (da prossima partita)', min: 1, max: WAVES.length, step: 1 },
        startWithBoss: { label: 'parti dal boss (da prossima partita)' },
        breakSeconds: { label: 'pausa tra le ondate (s)', min: 0, max: 10, step: 0.5 },
        firstBreakSeconds: { label: 'pausa prima della prima ondata (s)', min: 0, max: 10, step: 0.5 },
        headStartZ: { label: "nemico più vicino all'avvio (da prossima partita)", min: 500, max: 2400, step: 50 },
      },
    },
    {
      title: 'Colpi a fine gittata',
      target: SHOTS.fade,
      fields: {
        share: { label: "sfumano nell'ultima parte (0-1)", min: 0, max: 1, step: 0.05 },
        minScale: { label: 'grandezza alla fine', min: 0, max: 1, step: 0.05 },
        curve: { label: 'resta pieno più a lungo (1 = regolare)', min: 1, max: 4, step: 0.5 },
      },
    },
    {
      title: 'Fucile',
      target: WEAPONS.rifle,
      fields: {
        fireRate: { label: 'cadenza (colpi/s a testa)', min: 0, max: 20, step: 0.5 },
        damage: { label: 'danno', min: 0, max: 20, step: 0.5 },
        speed: { label: 'velocità colpi (dal prossimo colpo)', min: 200, max: 4000, step: 50 },
        range: { label: 'gittata', min: 300, max: 4000, step: 50 },
      },
    },
    {
      title: 'Raffica',
      target: WEAPONS.burst,
      fields: {
        fireRate: { label: 'cadenza (raffiche/s a testa)', min: 0, max: 20, step: 0.5 },
        damage: { label: 'danno di ogni colpo', min: 0, max: 20, step: 0.1 },
        pellets: { label: 'colpi per raffica', min: 1, max: 9, step: 1 },
        spreadDeg: { label: 'apertura (°)', min: 0, max: 90, step: 1 },
        range: { label: 'gittata', min: 200, max: 2000, step: 25 },
      },
    },
    {
      title: 'Lanciatore',
      target: WEAPONS.launcher,
      fields: {
        fireRate: { label: 'cadenza (granate/s a testa)', min: 0, max: 5, step: 0.1 },
        damage: { label: 'danno', min: 0, max: 50, step: 0.5 },
        radius: { label: 'raggio dello scoppio', min: 10, max: 300, step: 5 },
        range: { label: 'dove scoppia (distanza)', min: 300, max: 2400, step: 25 },
      },
    },
    {
      title: 'Esercito',
      target: ARMY,
      fields: {
        startSize: { label: "soldati con l'eroe (da prossima partita)", min: 1, max: 200, step: 1 },
      },
    },
    {
      title: 'Riserve',
      target: ARMY.reserves,
      fields: {
        maxBonus: { label: 'danno in più al massimo (0.3 = +30%)', min: 0, max: 1, step: 0.05 },
        halfCount: { label: 'riserve per metà del danno in più', min: 1, max: 100, step: 1 },
      },
    },
    {
      title: 'Tetti del livello',
      target: LIMITS,
      fields: {
        maxArmy: { label: 'soldati in campo (da prossima partita)', min: 10, max: 150, step: 10 },
      },
    },
    {
      title: 'Plotoni',
      target: PLATOONS,
      fields: {
        size: { label: 'soldati a plotone (da prossima partita)', min: 1, max: 10, step: 1 },
        followMs: { label: 'ritardo (ms)', min: 0, max: 400, step: 10 },
      },
    },
    ...HERO_FOLDERS,
    {
      title: 'Missione',
      target: MISSION,
      fields: {
        maxEscaped: { label: 'nemici che possono passare', min: 1, max: 20, step: 1 },
      },
    },
    {
      title: 'Tiratori',
      target: ENEMY_TYPES.shooter.fire,
      fields: {
        stopZ: { label: 'si ferma a (distanza)', min: 300, max: 2000, step: 50 },
        stopSeconds: { label: 'fermo per (s)', min: 0, max: 10, step: 0.5 },
        interval: { label: 'un colpo ogni (s)', min: 0.2, max: 5, step: 0.1 },
      },
    },
    {
      title: 'Freno a campo fermo',
      target: ENEMIES.brake,
      fields: {
        strength: { label: 'forza (per parte di vita tolta)', min: 0, max: 50, step: 1 },
        halfLifeMs: { label: 'si dimezza in (ms)', min: 50, max: 5000, step: 50 },
      },
    },
    {
      title: 'Contraccolpo',
      target: ENEMIES.knockback,
      fields: {
        strength: { label: 'forza (per parte di vita tolta)', min: 0, max: 5000, step: 50 },
        maxSpeed: { label: 'spinta al massimo (unità/s)', min: 0, max: 3000, step: 50 },
        halfLifeMs: { label: 'si dimezza in (ms)', min: 20, max: 1000, step: 10 },
      },
    },
    {
      title: 'Colpi nemici',
      target: ENEMY_SHOT,
      fields: {
        speed: { label: 'velocità (dal prossimo colpo)', min: 100, max: 2000, step: 25 },
      },
    },
    {
      title: 'Boss',
      target: BOSS,
      fields: {
        hp: { label: 'vita (dal prossimo boss)', min: 100, max: 10000, step: 50 },
        layers: { label: 'strati (dal prossimo boss)', min: 1, max: 20, step: 1 },
        spawnZ: { label: 'entra a (dal prossimo boss)', min: 1000, max: 2400, step: 50 },
        walkSpeed: { label: 'velocità di marcia (dal prossimo boss)', min: 20, max: 600, step: 10 },
        holdZ: { label: 'si pianta a (dal prossimo boss)', min: 400, max: 1000, step: 25 },
        restSeconds: { label: 'pausa tra gli attacchi (s)', min: 0, max: 5, step: 0.1 },
        moveSpeed: { label: 'velocità di lato', min: 20, max: 600, step: 10 },
      },
    },
    {
      title: 'Schiacciamento del boss',
      target: BOSS.smash,
      fields: {
        warnSeconds: { label: 'avviso (s)', min: 0.3, max: 3, step: 0.1 },
        radius: { label: 'raggio della zona (dal prossimo attacco)', min: 40, max: 300, step: 10 },
      },
    },
    {
      title: 'Scorta del boss',
      target: BOSS.escort,
      fields: {
        interval: { label: 'ogni (s)', min: 0.5, max: 10, step: 0.5 },
        count: { label: 'pedine', min: 1, max: 30, step: 1 },
        minZ: { label: 'non esce più vicina di', min: 0, max: 1500, step: 50 },
        walkSpeed: { label: 'velocità di marcia (dalla prossima)', min: 20, max: 800, step: 10 },
      },
    },
    {
      title: 'Cancelli',
      target: GATES,
      fields: {
        spawnInterval: { label: 'ogni (s)', min: 1, max: 15, step: 0.5 },
      },
    },
    {
      title: 'Scrigni',
      target: CHESTS,
      fields: {
        everyGates: { label: 'uno ogni (arrivi di cancelli)', min: 1, max: 6, step: 1 },
      },
    },
    {
      title: 'Danno degli scrigni',
      target: CHEST_KINDS.damage,
      fields: {
        amount: { label: 'danno in più (0.1 = +10%)', min: 0, max: 1, step: 0.05 },
      },
    },
    {
      title: 'Cadenza degli scrigni',
      target: CHEST_KINDS.fireRate,
      fields: {
        amount: { label: 'cadenza in più (0.1 = +10%)', min: 0, max: 1, step: 0.05 },
      },
    },
    {
      title: 'Élite degli scrigni',
      target: CHEST_KINDS.elite,
      fields: {
        count: { label: 'élite a scrigno', min: 1, max: 10, step: 1 },
      },
    },
    {
      title: 'Truppe élite',
      target: ELITE,
      fields: {
        lives: { label: 'vite (dalle prossime)', min: 1, max: 10, step: 1 },
      },
    },
    {
      title: 'Effetti',
      target: FX,
      fields: {
        enabled: { label: 'attivi' },
        showHealthBars: { label: 'barra vita' },
        showDamageNumbers: { label: 'numeri danno' },
      },
    },
    {
      title: 'Camera',
      target: CAMERA,
      fields: {
        height: { label: 'altezza', min: 100, max: 3000, step: 10 },
        distance: { label: 'distanza dietro', min: 50, max: 2000, step: 10 },
        pitchDeg: { label: 'inclinazione (°)', min: 5, max: 85, step: 1 },
        fovDeg: { label: 'campo visivo (°)', min: 20, max: 100, step: 1 },
      },
    },
  ],
};
