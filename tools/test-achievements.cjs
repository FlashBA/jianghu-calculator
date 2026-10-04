const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { validBundle, splitPayload, joinParts } = require('../web/content-schema.js');
const web = path.resolve(__dirname, '../web');
const bundle = JSON.parse(fs.readFileSync(path.join(web, 'content_bundle.json')));
const key = 'jianghu-stat-simulator:achievements:v1';

async function open(progress = '{}') {
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://example.test/#achievements', runScripts: 'dangerously', virtualConsole: vc });
  const w = dom.window;
  w.JianghuContent = { ready: Promise.resolve(bundle) };
  w.localStorage.setItem(key, progress);
  w.eval(fs.readFileSync(path.join(web, 'v03-ui.js'), 'utf8'));
  await w.JianghuContent.ready;
  await Promise.resolve();
  return { dom, w, doc: w.document, errors };
}

(async () => {
  assert(validBundle(bundle));
  assert.deepEqual(joinParts(splitPayload(bundle.data)).achievements, bundle.data.achievements);
  const invalid = structuredClone(bundle);
  invalid.data.achievements.records.push(invalid.data.achievements.records[0]);
  assert(!validBundle(invalid), 'Duplicate IDs must not overwrite completion state');
  const legacy = structuredClone(bundle);
  delete legacy.data.achievements;
  assert(validBundle(legacy), 'Older cached bundles remain readable');
  assert.equal(bundle.data.achievements.records.length, 305);
  let app = await open('{"historical-record":true}');
  let saved;
  try {
    const { doc, w } = app;
    assert.equal(doc.getElementById('achievements-count').textContent, '0 / 301 已收集');
    assert.equal(doc.querySelectorAll('[data-achievement-id]').length, 40);
    doc.getElementById('achievements-more').click();
    assert.equal(doc.querySelectorAll('[data-achievement-id]').length, 80);
    assert([...doc.querySelectorAll('[data-achievement-id]')].slice(0, 4).every((input) => input.disabled), 'Unavailable items sort first');
    const category = doc.getElementById('achievements-categories');
    category.value = 'sword'; category.dispatchEvent(new w.Event('change'));
    const search = doc.getElementById('achievements-search');
    search.value = '辟魔剑法'; search.dispatchEvent(new w.Event('input'));
    const checks = [...doc.querySelectorAll('[data-achievement-id]')];
    assert.equal(checks.length, 2);
    assert.notEqual(checks[0].dataset.achievementId, checks[1].dataset.achievementId);
    checks[0].click();
    assert.equal(doc.querySelector('[data-achievement-id]').checked, false, 'Uncollected items precede collected items');
    assert.equal(doc.querySelectorAll('[data-achievement-id]')[1].checked, true);
    assert.equal(doc.querySelectorAll('[data-achievement-id]:checked').length, 1);
    assert.equal(doc.getElementById('home-achievements-count').textContent, '1 / 301 已收集');
    saved = w.localStorage.getItem(key);
    assert(JSON.parse(saved)['historical-record']);
    const next = structuredClone(bundle);
    const completed = JSON.parse(saved);
    const record = next.data.achievements.records.find((item) => completed[item.id]);
    record.title = '修订名称';
    next.data.achievements.records.push({ id: 'new-record', title: '新增条目', category: 'sword', rank: 'S', access: '测试', available: true });
    w.dispatchEvent(new w.CustomEvent('jianghu-content-updated', { detail: next }));
    search.value = ''; search.dispatchEvent(new w.Event('input'));
    const filter = doc.getElementById('achievements-status');
    filter.value = 'complete'; filter.dispatchEvent(new w.Event('change'));
    assert.equal(doc.querySelectorAll('[data-achievement-id]').length, 1);
    assert.match(doc.getElementById('achievements-list').textContent, /修订名称/);
    assert.equal(doc.getElementById('achievements-count').textContent, '1 / 302 已收集');
    filter.value = 'unavailable'; filter.dispatchEvent(new w.Event('change'));
    category.value = ''; category.dispatchEvent(new w.Event('change'));
    assert.equal(doc.querySelectorAll('[data-achievement-id]:disabled').length, 4);
    filter.value = 'remaining'; filter.dispatchEvent(new w.Event('change'));
    const originalSet = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    doc.querySelector('[data-achievement-id]:not(:disabled)').click();
    assert.match(doc.getElementById('achievements-feedback').textContent, /未能保存/);
    w.Storage.prototype.setItem = originalSet;
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
  app = await open(saved);
  try {
    assert.equal(app.doc.getElementById('achievements-count').textContent, '1 / 301 已收集');
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
  console.log('PASS: 305 records, 4 unavailable, paging, duplicate names, completion filters, persistent progress, data update preservation, storage failure feedback and schema compatibility');
})().catch((error) => { console.error(error); process.exitCode = 1; });
