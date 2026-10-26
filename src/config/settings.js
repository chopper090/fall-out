import { FX } from './fx.js';

// Swipe: sensibilità (1 = segue il dito) e aggancio al centro corsia quando si alza il dito, solo se
// l'eroe è già a meno di snapRadius dal centro: i nemici entrano in punti diversi della corsia e il dito
// deve poter restare puntato su di loro. Se da metà tra due corsie l'esercito colpisce entrambe,
// ci si aggancia anche lì.
// Gli eroi restano sempre dentro la strada (la folla si rimodella attorno a loro): i punti di aggancio fuori
// portata si spostano al bordo
export const CONTROLS = {
  sensitivity: 1,
  snapEnabled: true,
  snapRadius: 30,
  snapSpeed: 1500,
};

// Impostazioni per tutti i giocatori, nell'ingranaggio: valgono subito e si salvano sul telefono.
// Ognuna cambia un valore di CONTROLS o di FX (target e key): quelle con min e max si regolano a passi di step,
// le altre sono interruttori
export const SETTINGS = {
  storageKey: 'fall-out.settings',
  version: 1,
  entries: [
    {
      id: 'sensitivity', label: 'Sensibilità swipe', target: CONTROLS, key: 'sensitivity', min: 0.5, max: 2, step: 0.25,
    },
    { id: 'snap', label: 'Aggancio al centro corsia', target: CONTROLS, key: 'snapEnabled' },
    { id: 'screenAlarm', label: 'Scossa e bordo rosso', target: FX, key: 'screenAlarm' },
    { id: 'damageNumbers', label: 'Numeri del danno', target: FX, key: 'showDamageNumbers' },
    { id: 'healthBars', label: 'Barre della vita', target: FX, key: 'showHealthBars' },
  ],
};

// Salvataggio della partita sul telefono (core/save.js): dove sta e la versione del suo formato, che sale quando il
// formato cambia (2: il cammino sulla strada con l'area e il posto nell'area). Le impostazioni hanno il loro
// salvataggio (SETTINGS) e restano anche cancellando questo
export const SAVE = {
  storageKey: 'fall-out.save',
  version: 2,
};
