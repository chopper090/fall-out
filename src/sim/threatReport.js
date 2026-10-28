import { SIM } from '../config/balance.js';
import { MINUS, fixedText, percentPoints, percentText } from '../core/format.js';
import { CATEGORIES } from '../data/heroes.js';
import { table } from './report.js';
import { THREAT_HEROES, threatEffect } from './threats.js';

// Resoconto della prova eroe contro minaccia (sim/threats.js), in testo: per ogni categoria (con il suo eroe comune) e
// ogni minaccia di SIM.threats.list, i punti di vittorie in più con il potere acceso rispetto a spento, poi la parte di
// soldati persi in meno; con * le minacce a cui la categoria risponde (answers). In fondo le vittorie con il potere
// spento, in media sulle categorie. of(threat, category, powered): le battaglie di quella cella (threatBattles); games:
// partite a cella, dai semi firstSeed in su; seconds: quanto ci ha messo il simulatore
export function formatThreatReport({ of, games, firstSeed, seconds }) {
  const { list, type } = SIM.threats;
  const categories = Object.keys(CATEGORIES);
  const effect = (threat, category) => threatEffect(of(threat, category, true), of(threat, category, false));
  const signed = (value) => (value < 0 ? `${MINUS}${-percentPoints(value)}` : `+${percentPoints(value)}`);
  const mark = (threat, category) => (list[threat].answers.includes(category) ? '*' : ' ');
  const rows = (valueOf) =>
    categories.map((category) => [
      `${CATEGORIES[category].role} (${THREAT_HEROES[category].name})`,
      ...list.map((_, threat) => `${valueOf(effect(threat, category))}${mark(threat, category)}`),
    ]);
  const won = (battles) => battles.filter((battle) => battle.won).length / battles.length;
  const spent = list.map((_, threat) => {
    const total = categories.reduce((sum, category) => sum + won(of(threat, category, false)), 0);
    return percentText(total / categories.length);
  });
  const header = ['Categoria', ...list.map(({ label }) => label)];
  const align = ['l', ...list.map(() => 'r')];
  return [
    'FALL-OUT · eroe contro minaccia',
    `Battaglia ${type} · ${games} partite a cella dal seme ${firstSeed} · in ${fixedText(seconds, 0)} s`,
    '* la minaccia a cui la categoria risponde',
    '',
    'Punti di vittorie in più con il potere acceso, contro spento',
    ...table(header, [...rows(({ gain }) => signed(gain)), ['Vinte spento (media)', ...spent]], align),
    '',
    'Soldati persi in meno con il potere acceso, in percentuale di quelli persi a potere spento',
    ...table(
      header,
      rows(({ cut }) => signed(cut)),
      align,
    ),
  ].join('\n');
}
