import { SOLDIER_TYPES } from '../data/units.js';

// La caserma (data/village.js barracks): quali tipi di soldati (data/units.js SOLDIER_TYPES) addestra a ogni livello

// I tipi di soldati che la caserma al livello level addestra, nell'ordine dei dati (nessuno se non è costruita)
export function trainableTypes(level) {
  return Object.keys(SOLDIER_TYPES).filter((id) => SOLDIER_TYPES[id].barracks <= level);
}

// I tipi che la caserma comincia ad addestrare proprio al livello level
export function typesFrom(level) {
  return Object.keys(SOLDIER_TYPES).filter((id) => SOLDIER_TYPES[id].barracks === level);
}
