import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

// Controllo dello stile (npm run lint): le regole del CLAUDE.md che si possono verificare da soli. Righe di al massimo
// 120 caratteri, niente variabili inutilizzate (niente codice morto), casualità solo da core/rng.js, l'ora solo da
// core/clock.js; la logica senza grafica (core, config, data, systems, meta, sim, fx, i trucchi di prova) non importa
// Phaser, così gira anche nel simulatore e nelle prove
const HEADLESS = [
  'src/{core,config,data,systems,meta,sim,fx}/**/*.js',
  'src/view/{iso,words,worldWords}.js',
  'src/debug/cheats.js',
];
const RANDOM = { object: 'Math', property: 'random', message: 'Usa core/rng.js' };
const CLOCK = { object: 'Date', property: 'now', message: 'Usa now() di core/clock.js' };
// new Date() senza argomenti è l'ora di adesso, come Date.now()
const NEW_DATE = { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: CLOCK.message };

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
      'no-restricted-properties': ['error', RANDOM, CLOCK],
      'no-restricted-syntax': ['error', NEW_DATE],
    },
  },
  { files: HEADLESS, rules: { 'no-restricted-imports': ['error', { paths: ['phaser', 'tweakpane'] }] } },
  { files: ['src/sim/**', 'tests/**', '*.config.js'], languageOptions: { globals: globals.node } },
  // L'ora vera la legge solo l'orologio; le prove la usano per i loro tempi
  {
    files: ['src/core/clock.js', 'tests/**'],
    rules: { 'no-restricted-properties': ['error', RANDOM], 'no-restricted-syntax': 'off' },
  },
  // Le scritte dei controlli raccontano quello che misurano: possono superare la riga
  {
    files: ['tests/**'],
    rules: { '@stylistic/max-len': ['error', { code: 120, ignoreTemplateLiterals: true, ignoreStrings: true }] },
  },
];
