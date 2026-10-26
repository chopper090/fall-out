// Missioni e sfide del giorno (meta/daily.js), il modo di guadagnare gemme giocando. Il giorno cambia a mezzanotte, con
// l'ora del telefono. Missioni: ogni giorno count missioni diverse, pescate con il seme seed più il numero del giorno
// tra quelle di pool che si possono finire (meta/daily.js); ognuna chiede target volte la sua cosa (label la dice, con
// il numero), e finita si ritira per gems gemme; ritirate tutte, allBonus gemme in più. Cosa conta (meta/daily.js):
// battles le battaglie della strada vinte, bosses i boss d'area battuti, wood e stone quelli presi in battaglia
// (tenuti), chests gli scrigni aperti, flips le porte negative girate e prese, kills i nemici abbattuti, builds i
// cantieri aperti, recruits i tiri del reclutamento, harvests le raccolte della fattoria, dailyWins le sfide del giorno
// vinte. Sfide del giorno: una battaglia ciascuna, una volta al giorno (si spende partendo, come la sfida di un
// cantiere), tarata su dove si è arrivati sulla strada (la prossima battaglia) ma più dura: la squadra che ci si
// aspetta lì ha il rapporto ratio, con type il tipo della battaglia (senza, quello della prossima), countScale volte
// gli arrivi e specials più spesso i tipi speciali scritti; text dice cosa ha di diverso. Vinta dà gems gemme (al posto
// del premio della vittoria); il bottino come sempre
export const DAILY = {
  seed: 9001,
  missions: {
    count: 3,
    gems: 2,
    allBonus: 3,
    pool: {
      battles: { target: 3, label: 'Vinci 3 battaglie della strada' },
      bosses: { target: 1, label: "Batti il boss di un'area" },
      wood: { target: 30, label: 'Prendi 30 legno in battaglia' },
      stone: { target: 20, label: 'Prendi 20 pietra in battaglia' },
      chests: { target: 6, label: 'Apri 6 scrigni' },
      flips: { target: 3, label: 'Gira 3 porte negative e prendile' },
      kills: { target: 400, label: 'Abbatti 400 nemici' },
      builds: { target: 2, label: 'Apri 2 cantieri' },
      recruits: { target: 1, label: 'Recluta un eroe' },
      harvests: { target: 2, label: 'Raccogli 2 volte le razioni della fattoria' },
      dailyWins: { target: 1, label: 'Vinci una sfida del giorno' },
    },
  },
  challenges: {
    horde: { name: 'Orda', gems: 3, ratio: 0.9, countScale: 1.5, text: 'molti più nemici' },
    armored: { name: 'Corazzati', gems: 3, ratio: 0.9, specials: { armored: 3, elite: 2 }, text: 'corazzati ed élite' },
    bosses: { name: 'Due boss', gems: 5, ratio: 0.85, type: 'double', text: 'due boss insieme' },
  },
};
