import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

// Controllo dello stile (npm run lint): le regole del CLAUDE.md che si possono verificare da soli. Righe di al massimo
// 120 caratteri, niente variabili inutilizzate (niente codice morto), casualità solo da core/rng.js; la logica senza
// grafica (core, config, data, systems, meta, sim, fx) non importa Phaser, così gira anche nel simulatore
const HEADLESS = ['src/{core,config,data,systems,meta,sim,fx}/**/*.js', 'src/view/{iso,words,worldWords}.js'];

export default [
  { ignores: ['dist/', 'node_modules/', 'docs/', 'tests/e2e/out/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/max-len': ['error', { code: 120, ignoreUrls: true }],
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Usa core/rng.js' }],
    },
  },
  { files: HEADLESS, rules: { 'no-restricted-imports': ['error', { paths: ['phaser', 'tweakpane'] }] } },
  { files: ['src/sim/**', 'tests/**', '*.config.js'], languageOptions: { globals: globals.node } },
  // Le scritte dei controlli raccontano quello che misurano: possono superare la riga
  {
    files: ['tests/**'],
    rules: { '@stylistic/max-len': ['error', { code: 120, ignoreTemplateLiterals: true, ignoreStrings: true }] },
  },
];
