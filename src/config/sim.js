// Simulatore di bilanciamento (src/sim, si avvia con npm run sim): un bot gioca games partite per il livello com'è
// e per ogni punto di sweeps, dai semi firstSeed in su, a fps frame al secondo fissi, al massimo maxSeconds di gioco
// a partita; ogni processo gioca chunk partite di un punto.
// bot (sim/bot.js): sceglie dove andare ogni thinkMs. Guarda i nemici fino a lookAhead oltre la gittata del fucile
// e ognuno vale la sua vita, il boss bossValue e una pedina dello sciame swarmValue; i cancelli fino a gateLookAhead,
// e valgono gateWeight a soldato; gli scrigni valgono
// chestWeight per rewardValue del suo effetto per il value della ricompensa (in soldati per un +10% di danno; lo
// scrigno d'arma niente). Più lontano, meno vale:
// diviso per 1 + distanza / distanceScale. Dai colpi nemici si tiene a shotMargin in più del necessario.
// sweeps: i modi di cambiare il rapporto di potenza, con i loro valori (per la vita e il danno un fattore, per i
// soldati quanti in più). flags, quando il resoconto segnala qualcosa: lossJump, un tratto in cui si perde
// almeno questa parte di partite in più del tratto prima; flatLoss e flatHurt, un tratto dopo il primo in cui si
// perde meno di flatLoss e l'esercito perde meno di flatHurt soldati per minuto; idleSeconds, secondi in media
// senza niente a tiro in un tratto; firstTargetSeconds, secondi prima del primo bersaglio a tiro; bossSeconds, un
// boss più breve o più lungo; flatSweep, un modo di cambiare la potenza che sposta le vittorie meno di così da un
// capo all'altro; confidenceZ, ampiezza dell'intervallo di confidenza delle vittorie (1,96 = 95%)
export const SIM = {
  games: 200,
  firstSeed: 1,
  fps: 60,
  maxSeconds: 400,
  chunk: 25,
  bot: {
    thinkMs: 500,
    lookAhead: 300,
    bossValue: 40,
    swarmValue: 3,
    gateLookAhead: 1100,
    gateWeight: 0.3,
    chestWeight: 1,
    rewardValue: { damage: 15, fireRate: 15, heal: 15, weapon: 0, elite: 15 },
    distanceScale: 500,
    shotMargin: 10,
  },
  sweeps: [
    { id: 'enemyHp', label: 'Vita dei nemici', unit: '×', values: [0.5, 0.6, 0.7, 0.8, 0.9, 1.15, 1.3, 1.5, 1.8, 2.1] },
    { id: 'heroDamage', label: 'Danno degli eroi', unit: '×', values: [0.5, 0.75, 1.5, 2, 3] },
    { id: 'heroHp', label: 'Vita degli eroi', unit: '×', values: [0.5, 1.5, 2, 3] },
    { id: 'startSoldiers', label: 'Soldati di partenza', unit: '+', values: [5, 10, 20, 40] },
  ],
  flags: {
    lossJump: 0.15,
    flatLoss: 0.02,
    flatHurt: 10,
    idleSeconds: 5,
    firstTargetSeconds: 3,
    bossSeconds: { min: 8, max: 30 },
    flatSweep: 0.05,
    confidenceZ: 1.96,
  },
};
