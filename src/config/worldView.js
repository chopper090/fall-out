import { FONT } from './styles.js';

// Il palo in grigio dei segni della strada (WORLD_VIEW.road.markers) e la bandiera delle battaglie, che prende il
// colore della durata
const ROAD_POLE = { top: 0x9a8f80, left: 0x7a7064, right: 0x5f574d };
const BATTLE_POLE = { at: [0.2, 0.2, 0.08, 0.08], base: 0, height: 44, colors: ROAD_POLE };
const BATTLE_FLAG = { width: 26, height: 18 };

// Il mondo visto in isometria (scenes/World.js, view/iso.js, view/worldAtlas.js), in pixel del mondo a zoom 1: una
// cella è un rombo tileWidth × tileHeight. Le immagini degli edifici si disegnano textureScale volte più grandi, per
// restare nitide da vicino. Zoom: da lontano tutto il quadrato nella larghezza dello schermo (meno fitMargin), da
// vicino closeCells celle in larghezza, all'apertura startCells; la rotella zooma di wheelFactor per unità; andare su
// un edificio o sul capo dura focusMs (toccandolo, la vista si sposta solo se non sta tutto, con revealMargin pixel di
// margine, nello schermo che resta libero tra le risorse e la sua scheda). Un tocco si sposta al massimo di tapSlop
// pixel dello schermo; tenuto fermo longPressMs su un edificio lo prende per spostarlo. Le immagini degli edifici
// e dei segni della strada stanno nei loro atlanti con atlasPadding pixel vuoti attorno, su righe larghe al massimo
// atlasMaxWidth pixel (un'immagine più larga i telefoni vecchi non la tengono)
export const WORLD_VIEW = {
  tileWidth: 96,
  tileHeight: 48,
  textureScale: 2,
  atlasPadding: 4,
  atlasMaxWidth: 2048,
  zoom: { fitMargin: 0.04, closeCells: 4.5, startCells: 8.5, wheelFactor: 0.0015, focusMs: 350, revealMargin: 60 },
  gestures: { tapSlop: 14, longPressMs: 450 },
  // Terreno: fuori dal territorio (land), nel territorio (territory, con il bordo della cella grid) e la strada (road,
  // con il bordo roadEdge); i rombi sono un po' più larghi della cella (seam) e sotto tutto c'è un rombo pieno di land:
  // niente righine tra le celle. Nel tileset i rombi hanno tileMargin pixel vuoti attorno e tileSpacing tra uno e
  // l'altro
  ground: {
    land: 0x50574d,
    territory: 0x7d8876,
    grid: 0x6c7666,
    road: 0xa8987a,
    roadEdge: 0x8a7c62,
    gridWidth: 1.5,
    seam: 0.75,
    tileMargin: 1,
    tileSpacing: 2,
  },
  // Nebbia piena sulle aree chiuse, leggera (current: quanto copre) sull'area da conquistare, dove si intravede la
  // strada; sopra, i confini di tutte le aree
  fog: { color: 0xc4cad6, current: 0.55 },
  areaLines: { color: 0x8f98ab, alpha: 0.6, width: 4 },
  // Mura sul bordo del villaggio, alte height e spesse thickness celle; ai lati della porta due torri (post: lato in
  // celle e altezza)
  walls: {
    height: 16,
    thickness: 0.16,
    colors: { top: 0xa3b3d1, left: 0x74839f, right: 0x5b6882 },
    post: { size: 0.36, height: 34, colors: { top: 0xb6c5e3, left: 0x8494b3, right: 0x67759a } },
  },
  // Edifici in grigio, i nostri in blu, fatti di pezzi disegnati dal fondo al davanti: ogni pezzo è una scatola sul
  // rettangolo at (colonna, riga, colonne, righe, in celle dall'angolo nord dell'edificio), da base a base + height
  // pixel, con i colori delle facce (sopra, sinistra, destra); roof: un tetto a punta alto height (colori delle falde
  // dietro, a sinistra e a destra); stripes: count file disegnate sopra (i campi)
  buildings: {
    center: [
      { at: [0, 0, 2, 2], base: 0, height: 10, colors: { top: 0x8f98ab, left: 0x6f778a, right: 0x5a6172 } },
      {
        at: [0.15, 0.15, 1.7, 1.7],
        base: 10,
        height: 46,
        colors: { top: 0x9db8f0, left: 0x6d8fd4, right: 0x4f6fae },
        roof: { height: 22, colors: { back: 0x4b6bb3, left: 0x3a5590, right: 0x2c416e } },
      },
      {
        at: [0.7, 0.7, 0.6, 0.6],
        base: 56,
        height: 40,
        colors: { top: 0xb4c8f2, left: 0x7f9cd8, right: 0x5f7cb8 },
        roof: { height: 20, colors: { back: 0x4b6bb3, left: 0x3a5590, right: 0x2c416e } },
      },
    ],
    lodge: [
      {
        at: [0.1, 0.1, 1.3, 1.5],
        base: 0,
        height: 30,
        colors: { top: 0x9db8f0, left: 0x6d8fd4, right: 0x4f6fae },
        roof: { height: 20, colors: { back: 0x4b6bb3, left: 0x3a5590, right: 0x2c416e } },
      },
      { at: [1.5, 0.3, 0.4, 1.2], base: 0, height: 14, colors: { top: 0xb7a27a, left: 0x8f7c58, right: 0x6f5f42 } },
    ],
    farm: [
      {
        at: [0, 0, 2, 2],
        base: 0,
        height: 5,
        colors: { top: 0x8c9476, left: 0x6c7359, right: 0x565c47 },
        stripes: { count: 5, color: 0x6f7759, width: 3 },
      },
      {
        at: [0.12, 0.12, 0.85, 0.85],
        base: 5,
        height: 32,
        colors: { top: 0x9db8f0, left: 0x6d8fd4, right: 0x4f6fae },
        roof: { height: 24, colors: { back: 0x4b6bb3, left: 0x3a5590, right: 0x2c416e } },
      },
    ],
    barracks: [
      { at: [0, 0, 3, 2], base: 0, height: 62, colors: { top: 0x9db8f0, left: 0x6d8fd4, right: 0x4f6fae } },
      { at: [0.2, 0.2, 2.6, 1.6], base: 62, height: 12, colors: { top: 0xb4c8f2, left: 0x7f9cd8, right: 0x5f7cb8 } },
    ],
    forge: [
      {
        at: [0.1, 0.1, 1.8, 1.8],
        base: 0,
        height: 44,
        colors: { top: 0x9db8f0, left: 0x6d8fd4, right: 0x4f6fae },
        roof: { height: 32, colors: { back: 0x4b6bb3, left: 0x3a5590, right: 0x2c416e } },
      },
      {
        at: [0.32, 0.32, 0.36, 0.36],
        base: 44,
        height: 48,
        colors: { top: 0x5b6170, left: 0x474c58, right: 0x373b45 },
      },
    ],
  },
  // Cantiere del primo livello: il terreno battuto (plot), un palo a ogni angolo (post: lato in celle e altezza) e
  // l'impalcatura tra le cime (frame)
  site: {
    plot: { height: 4, colors: { top: 0x8a8070, left: 0x6b6357, right: 0x575047 } },
    post: { size: 0.14, height: 40, colors: { top: 0xb8a888, left: 0x9a8b6e, right: 0x7d7058 } },
    frame: { color: 0xc9b994, width: 3 },
  },
  // Segni della strada, in piedi nella parte dietro della loro casella (pezzi come quelli degli edifici, in celle della
  // casella; flag: una bandiera larga width e alta height pixel appesa in cima al pezzo; label: una scritta di size
  // pixel sopra il pezzo): short, medium e long la battaglia corta, media e lunga (bandiera bianca, arancione, rossa),
  // boss il boss dell'area, collect una raccolta, conquered il boss battuto, unknown una casella dell'area da
  // conquistare di cui non si sa ancora il tipo. Sulla casella dove si è c'è il capo (pawn: largo width pixel del
  // mondo); un passo dura stepMs
  road: {
    markers: {
      short: [{ ...BATTLE_POLE, flag: { ...BATTLE_FLAG, color: 0xf2f2f2 } }],
      medium: [{ ...BATTLE_POLE, flag: { ...BATTLE_FLAG, color: 0xffa726 } }],
      long: [{ ...BATTLE_POLE, flag: { ...BATTLE_FLAG, color: 0xd9534f } }],
      boss: [
        {
          at: [0.1, 0.1, 0.5, 0.5],
          base: 0,
          height: 38,
          colors: { top: 0xe07a74, left: 0xb94a44, right: 0x8f3530 },
          roof: { height: 20, colors: { back: 0x8f3530, left: 0x7a2a26, right: 0x5e201d } },
        },
        {
          at: [0.32, 0.32, 0.06, 0.06],
          base: 58,
          height: 26,
          colors: ROAD_POLE,
          flag: { width: 24, height: 16, color: 0xd9534f },
        },
      ],
      collect: [
        {
          at: [0.22, 0.22, 0.36, 0.36],
          base: 0,
          height: 20,
          colors: { top: 0xffe08a, left: 0xe0b23a, right: 0xa8821f },
          stripes: { count: 2, color: 0xa8821f, width: 3 },
        },
      ],
      conquered: [
        {
          at: [0.2, 0.2, 0.08, 0.08],
          base: 0,
          height: 52,
          colors: ROAD_POLE,
          flag: { width: 30, height: 20, color: 0x3d7bff },
        },
      ],
      unknown: [
        {
          at: [0.3, 0.3, 0.3, 0.3],
          base: 0,
          height: 6,
          colors: { top: 0xb4b9c4, left: 0x8f95a1, right: 0x747a86 },
          label: { text: '?', size: 26, color: 0xeef1f6 },
        },
      ],
    },
    pawn: { width: 46 },
    stepMs: 260,
  },
  // L'edificio da mettere o da spostare, mezzo trasparente, sul suo posto colorato valid (ci sta) o invalid, con il
  // bordo del posto spesso outlineWidth sopra di lui; se non ci sta è tinto di invalid
  ghost: { alpha: 0.75, valid: 0x4caf50, invalid: 0xd9534f, footprintAlpha: 0.45, outlineWidth: 4 },
  // Segni sopra gli edifici, sempre grandi uguali sullo schermo (pixel dello schermo): il livello (badge), quanto
  // manca al cantiere (timer), le razioni pronte della fattoria da toccare (bubble, che si tocca fino a tapRadius dal
  // centro, più grande di lei per il dito), ognuno gap sopra quello sotto;
  // sotto l'edificio da mettere ✗ e ✓ (confirm: raggio, distanza tra i centri, quanto sotto l'angolo sud)
  overlays: {
    badge: { radius: 15, color: 0x101a33, border: 0x7aa6ff, borderWidth: 2, gap: 6 },
    timer: { height: 32, padding: 10, radius: 10, color: 0x101a33, alpha: 0.9, gap: 8 },
    bubble: { radius: 28, tapRadius: 44, color: 0xffe680, border: 0x8a6d1f, borderWidth: 3, gap: 10 },
    confirm: {
      radius: 32,
      gap: 90,
      offsetY: 56,
      ok: 0x43a047,
      cancel: 0xd9534f,
      icon: 0xffffff,
      iconWidth: 6,
      disabledAlpha: 0.4,
      // Le stanghette della ✗ e i tre punti della ✓, in frazioni del raggio dal centro
      cross: 0.4,
      check: [
        [-0.4, 0],
        [-0.1, 0.28],
        [0.4, -0.24],
      ],
    },
    badgeStyle: { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' },
    timerStyle: { fontFamily: FONT, fontSize: '18px', color: '#ffffff' },
    bubbleStyle: { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#3a2c05' },
  },
  // Ordine di disegno: terreno, nebbia, confini delle aree, mura dietro, la casella da toccare che si accende (flash,
  // fx/worldFx.js), poi le cose in piedi (edifici, mura davanti a pezzi, segni della strada e il capo: più avanti chi
  // ha il centro del suo posto più in basso, a standing più quella y; tie pixel in più per chi vince a pari posto: le
  // mura sugli edifici, il capo sul segno della sua casella), edificio da mettere, segni sopra gli edifici
  depth: {
    ground: 0,
    fog: 1,
    areaLines: 2,
    backWalls: 3,
    flash: 4,
    standing: 10,
    tie: 1,
    ghost: 6000,
    overlays: 7000,
  },
};
