import { test } from 'node:test';
import { checker } from '../support/check.js';
import { HUD } from '../../src/config/balance.js';
import { RECRUIT } from '../../src/data/growth.js';
import { HEROES, RARITIES } from '../../src/data/heroes.js';
import { VILLAGE } from '../../src/data/village.js';
import { CATALOG_FILTERS, catalogEntries } from '../../src/meta/catalog.js';
import { createProfile } from '../../src/meta/profile.js';
import { freeSpot } from '../../src/meta/village.js';
import { entryLines, entryNeeds, entryTitle } from '../../src/view/catalogWords.js';

// Il Catalogo (meta/catalog.js, view/catalogWords.js): gli stati delle voci letti dal profilo e dai dati, i filtri,
// da dove arrivano le scorte e a cosa servono, i requisiti scritti con ✓ e ✗

// Un profilo con la fattoria e la caserma al livello 1, già messe, e le scorte che bastano per il centro al 2
function grown() {
  const profile = createProfile();
  for (const id of ['farm', 'barracks']) {
    profile.village.levels[id] = 1;
    profile.village.positions[id] = freeSpot(profile.village.positions, id, 0);
  }
  Object.assign(profile.resources, { wood: 200, stone: 200, gears: 50 });
  return profile;
}

const states = (entries) => entries.map((entry) => `${entry.id} ${entry.state}`).join(', ');
const ids = (entries) => entries.map((entry) => entry.id).join(',');

test('Catalogo: gli edifici sono posseduti, potenziabili, ottenibili o bloccati, e i filtri li scelgono', (t) => {
  const check = checker(t);
  const fresh = catalogEntries(createProfile(), 'buildings');
  const profile = grown();
  const all = catalogEntries(profile, 'buildings');
  const filtered = Object.fromEntries(
    Object.keys(CATALOG_FILTERS).map((filter) => [filter, ids(catalogEntries(profile, 'buildings', filter))]),
  );
  const busy = grown();
  busy.village.sites = [{ building: 'farm', endsAt: 1e15, challenged: false }];
  const center = catalogEntries(busy, 'buildings').find((entry) => entry.id === 'center');
  check(
    `da zero: ${states(fresh)}; con fattoria e caserma al liv. 1: ${states(all)}; filtri ${JSON.stringify(filtered)}; con il posto cantiere occupato il centro ${center.state}`,
    states(fresh) === 'center owned, lodge locked, farm obtainable, barracks obtainable, forge obtainable' &&
      states(all) === 'center upgradable, lodge locked, farm owned, barracks owned, forge obtainable' &&
      filtered.all === 'center,lodge,farm,barracks,forge' &&
      filtered.owned === 'center,farm,barracks' &&
      filtered.obtainable === 'forge' &&
      filtered.upgradable === 'center' &&
      center.state === 'owned',
  );
  check.done();
});

// Gli eroi posseduti salgono di stella con i frammenti; gli altri si reclutano con le piastrine, o, se il reclutamento
// non li dà (i mitici), si ottengono con i loro frammenti: bloccati finché non bastano
test('Catalogo: gli eroi posseduti salgono di stella, gli altri si reclutano o si ottengono con i frammenti', (t) => {
  const check = checker(t);
  const profile = createProfile();
  profile.heroes.rifleman.fragments = 999;
  profile.heroes.phoenix.fragments = RECRUIT.assemble;
  const entries = catalogEntries(profile, 'heroes');
  const owned = Object.values(HEROES)
    .filter((hero) => profile.heroes[hero.id].owned)
    .map((hero) => hero.id);
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  const assembled = (entry) => RARITIES[HEROES[entry.id].rarity].chance === 0;
  const others = entries.filter((entry) => !owned.includes(entry.id));
  const mythics = others.filter((entry) => assembled(entry) && entry.id !== 'phoenix');
  check(
    `eroi: ${states(entries)}; fenice con ${RECRUIT.assemble} frammenti ${byId.phoenix.state}`,
    entries.length === Object.keys(HEROES).length &&
      byId.rifleman.state === 'upgradable' &&
      owned.filter((id) => id !== 'rifleman').every((id) => byId[id].state === 'owned') &&
      others
        .filter((entry) => !assembled(entry))
        .every((entry) => entry.state === 'obtainable' && entry.tags.need === RECRUIT.cost) &&
      mythics.every((entry) => entry.state === 'locked' && entry.fragments.need === RECRUIT.assemble) &&
      byId.phoenix.state === 'obtainable',
  );
  check.done();
});

test('Catalogo: ogni scorta dice da dove arriva e a cosa serve, letto dai dati', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const entries = catalogEntries(profile, 'resources');
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  const from = (id) => byId[id].sources.map((source) => (source.enemies ? `enemies(${source.enemies})` : source.id));
  const uses = (id) => byId[id].uses.map((use) => use.building ?? use.id);
  const wood = from('wood').join(' ');
  const circuits = from('circuits').join(' ');
  check(
    `scorte ${ids(entries)}; legno da ${wood}, per ${uses('wood')}; circuiti da ${circuits}, per ${uses('circuits')}; razioni da ${from('rations')}, per ${uses('rations')}; piastrine per ${uses('dogTags')}; esperienza da ${from('xp')}, per ${uses('xp')}`,
    ids(entries) === [...Object.keys(VILLAGE.start), 'dogTags', 'xp'].join(',') &&
      wood === 'enemies(grunt,fast,swarm,boss) victory collect' &&
      uses('wood').join() === 'center,lodge,farm,barracks,forge,train' &&
      from('xp').join() === 'enemies(elite,boss),victory,consolation' &&
      uses('xp').join() === 'train' &&
      circuits === 'conquest' &&
      uses('circuits').join() === 'center' &&
      from('rations').join() === 'collect,farm,center' &&
      uses('rations').join() === 'battles' &&
      uses('dogTags').join() === 'recruit' &&
      byId.circuits.state === 'obtainable' &&
      byId.wood.state === 'owned',
  );
  check.done();
});

test('Catalogo: titoli, righe e requisiti scritti, con ✓ e ✗ e quello che si ha se non basta', (t) => {
  const check = checker(t);
  const { labels } = HUD.catalog;
  const profile = createProfile();
  const entries = catalogEntries(profile, 'buildings');
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  const needs = (id, p = profile) => entryNeeds(byId[id], p).map((need) => `${need.ok ? '✓' : '✗'} ${need.text}`);
  const centerNeeds = needs('center');
  const lodgeNeeds = needs('lodge');
  profile.resources.wood = 3;
  const poor = catalogEntries(profile, 'buildings').find((entry) => entry.id === 'farm');
  const poorNeeds = entryNeeds(poor, profile).map((need) => `${need.ok ? '✓' : '✗'} ${need.text}`);
  const resource = catalogEntries(profile, 'resources').find((entry) => entry.id === 'stone');
  const lines = entryLines(resource, profile);
  check(
    `centro «${entryTitle(byId.center)}» ${entryLines(byId.center, profile).join(' | ')}: ${centerNeeds.join(', ')}; Capanno: ${lodgeNeeds.join(', ')}; fattoria con 3 legno: ${poorNeeds.join(', ')}; pietra: ${lines.join(' | ')}`,
    entryTitle(byId.center) === `Centro città · ${labels.level} 1` &&
      centerNeeds.slice(0, 2).join() === '✗ Fattoria liv. 1,✗ Caserma liv. 1' &&
      lodgeNeeds[0] === '✗ Centro città liv. 2' &&
      poorNeeds[0] === `✗ 7 legno (${labels.have} 3)` &&
      poorNeeds[1] === '✓ 3 pietra' &&
      lines[0].startsWith(`${labels.from}: nemici (corazzati, tiratori, élite, boss)`) &&
      lines[1] === `${labels.usedFor}: Centro città, Capanno dei mastri, Fattoria, Caserma, Fucina`,
  );
  check.done();
});
