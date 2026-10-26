// Le soglie delle prove lunghe con il bot, guardate con il rumore del loro campione. I conti tornano identici a ogni
// giro (semi fissi), ma un ritocco del bilanciamento che lascia le cose come sono sposta i risultati quanto il rumore
// di un campione di quella grandezza (su 100 partite qualche vittoria): una soglia guardata senza margine fallirebbe a
// caso al ritocco dopo, e con lei la pubblicazione. Come per le vittorie nelle fasce, il margine è z volte lo scarto
// (z: SIM.flags.confidenceZ)

// Il margine della differenza tra due parti (share, su count partite): z volte il suo scarto
export function differenceMargin(z, [share, count], [other, otherCount]) {
  if (count === 0 || otherCount === 0) return 0;
  return z * Math.sqrt((share * (1 - share)) / count + (other * (1 - other)) / otherCount);
}

// Quanti tratti perdono almeno jump partite in più del tratto prima anche togliendo il margine: lost, la parte di
// partite perse in ogni tratto; reached, quante partite ci sono arrivate
export function lossJumps(lost, reached, z, jump) {
  const margin = (index) => differenceMargin(z, [lost[index], reached[index]], [lost[index - 1], reached[index - 1]]);
  return lost.filter((share, index) => index > 0 && share - lost[index - 1] - margin(index) >= jump).length;
}

// Le vittorie in più (after contro before, su count partite) sono almeno least, a meno del margine, e ci sono
export function gainHolds(after, before, count, z, least) {
  const margin = count * differenceMargin(z, [after / count, count], [before / count, count]);
  return after > before && after - before + margin >= least;
}
