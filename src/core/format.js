import { HUD } from '../config/balance.js';

// Come si scrivono i numeri, senza disegno: li usano le scene, le scritte della vista, il simulatore e gli strumenti
// di sviluppo

const PERCENT = 100;

// Il segno meno, più lungo del trattino: "−30%", "−2"
export const MINUS = '−';

// Una quota (0.25) in punti percentuali interi (25)
export function percentPoints(share) {
  return Math.round(share * PERCENT);
}

// Una quota come percentuale intera, con un segno davanti se serve: "25%", "+10%", "−30%"
export function percentText(share, sign = '') {
  return `${sign}${percentPoints(share)}%`;
}

// Un numero con al massimo HUD.decimals decimali e la virgola: "1,24", "1,5", "2"
export function decimalText(value) {
  const scale = 10 ** HUD.decimals;
  return String(Math.round(value * scale) / scale).replace('.', ',');
}

// Un numero con sempre digits decimali e la virgola: "1,50", "2,00"
export function fixedText(value, digits) {
  return value.toFixed(digits).replace('.', ',');
}
