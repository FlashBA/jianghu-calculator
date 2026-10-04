const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const web = path.resolve(__dirname, '../web');
const bundle = JSON.parse(fs.readFileSync(path.join(web, 'content_bundle.json')));
const configKey = 'jianghu-stat-simulator:character:v6';
const savedConfig = JSON.stringify({ personName: '主角', level: '30', achievementHp: '123', achievementAttack: '77' });

async function wait(predicate) {
  for (let i = 0; i < 500; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('App did not settle');
}

async function open({ db = new IDBFactory(), failBase = false, failBundle = false } = {}) {
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://appassets.androidplatform.net/assets/index.html', runScripts: 'dangerously', virtualConsole: vc });
  const w = dom.window;
  w.TextEncoder = TextEncoder;
  w.AbortController = AbortController;
  w.indexedDB = db;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle });
  w.localStorage.setItem(configKey, savedConfig);
  let baseRequests = 0;
  w.fetch = async (input) => {
    const url = new URL(input, w.location.href);
    if (url.hostname !== 'appassets.androidplatform.net') throw new Error('offline');
    const filename = path.basename(url.pathname);
    if (filename === 'uc540_doc.json') {
      baseRequests += 1;
      if (failBase) throw new Error('base asset unavailable');
    }
    if (filename === 'content_bundle.json' && failBundle) throw new Error('content asset unavailable');
    return new Response(fs.readFileSync(path.join(web, filename), 'utf8'));
  };
  for (const file of ['content-schema.js', 'content-updates.js', 'app.js', 'v03-ui.js']) w.eval(fs.readFileSync(path.join(web, file), 'utf8'));
  await w.init();
  await wait(() => w.document.getElementById('data-update-button').getAttribute('aria-busy') === 'false');
  return { dom, w, errors, baseRequests: () => baseRequests, recover: () => { failBase = false; failBundle = false; } };
}

function formationChecks(w) {
  const doc = w.document;
  const set = (id, value) => { doc.getElementById(id).value = String(value); };
  w.restoreConfig({ equipmentSlots: [{}, { id: 'custom-equipment:1', name: '测试护甲', hpFlat: 300, attackFlat: 40 }] });
  assert.equal(w.currentConfig().equipmentSlots[1].hpFlat, 300);
  set('person-name', '主角');
  set('achievement-hp', 1000);
  set('achievement-attack', 100);
  const weaponTotals = w.weaponAffixTotals;
  w.weaponAffixTotals = () => ({ hpFlat: 200, hpPercent: 0, attackFlat: 80, attackPercent: 0, secondary: w.emptySecondaryStats() });
  const harem = w.renderHaremBonusControl;
  w.renderHaremBonusControl = () => false;
  set('formation-select', '');
  const plain = w.calculate({ commit: true });
  set('formation-select', 'baxu');
  let result = w.calculate({ commit: true });
  assert.equal(result.hp, Math.round(plain.hp * 1.24), 'Formation multiplies total HP including achievement and weapon flats');
  assert.equal(result.attack, Math.trunc(plain.attack * 1.24), 'Formation multiplies total attack including achievement');
  set('formation-select', 'jiugong');
  result = w.calculate({ commit: true });
  assert.equal(result.hp, Math.round(plain.hp * 0.8));
  assert.equal(result.attack, Math.trunc(plain.attack * 0.8));
  set('person-name', '自定义角色');
  set('formation-select', '');
  const follower = w.calculate({ commit: true });
  set('formation-select', 'baxu');
  set('formation-position', 2);
  result = w.calculate({ commit: true });
  assert.equal(result.hp, Math.round(follower.hp * 0.93));
  assert.equal(result.attack, Math.trunc(follower.attack * 0.93));
  set('person-name', '主角');
  w.renderHaremBonusControl = () => true;
  set('formation-select', '');
  const withHarem = w.calculate({ commit: true });
  set('formation-select', 'baxu');
  result = w.calculate({ commit: true });
  assert.equal(result.attack, Math.trunc(withHarem.attack * 1.24), 'Formation is applied after other multipliers and fixed bonuses');
  w.weaponAffixTotals = weaponTotals;
  w.renderHaremBonusControl = harem;
}

(async () => {
  const db = new IDBFactory();
  const initial = await open({ db });
  try { formationChecks(initial.w); assert.deepEqual(initial.errors, []); }
  finally { initial.dom.window.close(); }

  // The bundled content and calculator base both fail; only the saved content survives.
  const cached = await open({ db, failBase: true, failBundle: true });
  try {
    const { w } = cached;
    const doc = w.document;
    assert.equal(w.jianghuApp.initialized, false);
    assert.equal(w.encyclopediaRecords('characters').length, bundle.data.encyclopedia.characters.length);
    doc.querySelector('[data-view="encyclopedia"]').click();
    assert(doc.querySelectorAll('#encyclopedia-list [data-encyclopedia-record-id]').length > 0);
    doc.getElementById('encyclopedia-type').value = 'martial_arts';
    doc.getElementById('encyclopedia-type').dispatchEvent(new w.Event('change'));
    assert(doc.querySelector('#encyclopedia-list [data-martial-detail]'));
    doc.querySelector('#encyclopedia-list [data-encyclopedia-favorite]').click();
    assert.equal(w.jianghuEncyclopedia.getFavoriteEntries().length, 1);
    assert.equal(w.localStorage.getItem(configKey), savedConfig, 'Degraded browsing must not overwrite calculator saves');
    assert.match(doc.getElementById('data-update-status').textContent, /计算器加载失败/);
    doc.getElementById('data-update-button').click();
    await wait(() => !doc.getElementById('data-update-button').disabled);
    assert.equal(w.jianghuApp.initialized, false, 'Repeated failure leaves a retryable state');
    assert.equal(w.localStorage.getItem(configKey), savedConfig);
    cached.recover();
    doc.getElementById('data-update-button').click();
    await wait(() => w.jianghuApp.initialized && !doc.getElementById('data-update-button').disabled);
    assert.equal(doc.getElementById('achievement-hp').value, '123', 'Retry restores the original configuration');
    assert.equal(cached.baseRequests(), 3);
    doc.querySelector('#encyclopedia-list [data-encyclopedia-favorite]').click();
    assert.equal(w.jianghuEncyclopedia.getFavoriteEntries().length, 0, 'Retry must not duplicate favorite handlers');
    assert.deepEqual(cached.errors, []);
  } finally { cached.dom.window.close(); }

  const cold = await open({ failBundle: true });
  try {
    const { w } = cold;
    assert.equal(w.jianghuApp.initialized, false);
    assert.equal(w.localStorage.getItem(configKey), savedConfig);
    cold.recover();
    w.document.getElementById('data-update-button').click();
    await wait(() => w.jianghuApp.initialized && !w.document.getElementById('data-update-button').disabled);
    assert.equal(cold.baseRequests(), 1, 'Retry reuses a successfully loaded base asset');
    w.document.querySelector('[data-guide-id="calculation-details"]').click();
    assert(!w.document.getElementById('guide-detail-content').textContent.includes('加载失败'));
    assert(w.encyclopediaRecords('characters').length > 0);
    assert.deepEqual(cold.errors, []);
  } finally { cold.dom.window.close(); }
  console.log('PASS: cached encyclopedia without base/assets/network, independent filters/favorites, no save overwrite, same-button retry, guide recovery, no duplicate handlers, formation after fixed bonuses and other multipliers');
})().catch((error) => { console.error(error); process.exitCode = 1; });
