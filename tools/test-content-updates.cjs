const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { splitPayload } = require('../web/content-schema.js');
const web = path.resolve(__dirname, '../web');
const bundle = JSON.parse(fs.readFileSync(path.join(web, 'content_bundle.json')));
const initialGuideCount = bundle.data.strategyGuides.guides.length + 4;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const database = new IDBFactory();
const errors = [];
const requests = [];
const downloads = [];
let missingPart = null;
let corruptPart = null;
let remote = structuredClone(bundle);
let mode = 'normal';
let storageFails = false;

async function wait(predicate) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for app: ' + errors.join('; '));
}

async function open(savedFavorites, lastCheck) {
  const console = new VirtualConsole();
  console.on('jsdomError', (error) => errors.push(error.message));
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://appassets.androidplatform.net/assets/index.html', runScripts: 'dangerously', virtualConsole: console });
  const w = dom.window;
  w.TextEncoder = TextEncoder;
  w.AbortController = AbortController;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(w.crypto, 'subtle', { value: crypto.webcrypto.subtle });
  if (savedFavorites) w.localStorage.setItem('jianghu-stat-simulator:guide:favorites:v1', savedFavorites);
  if (lastCheck) w.localStorage.setItem('jianghu-content:last-check:v1', String(lastCheck));
  w.fetch = async (input, options) => {
    const url = new URL(input, w.location.href);
    if (url.hostname === 'appassets.androidplatform.net') return new Response(fs.readFileSync(path.join(web, path.basename(url.pathname)), 'utf8'));
    requests.push(url.hostname);
    if (mode === 'offline' || (mode === 'fallback' && url.hostname === '47.95.250.113')) throw new Error('Network unavailable');
    if (mode === 'timeout' && url.hostname === '47.95.250.113') return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))));
    const files = {};
    const parts = {};
    const original = splitPayload(bundle.data);
    for (const [id, value] of Object.entries(splitPayload(remote.data))) {
      const bytes = JSON.stringify(value) === JSON.stringify(original[id])
        ? fs.readFileSync(path.join(web, `content-parts/${id}-${bundle.partHashes[id]}.json`), 'utf8')
        : JSON.stringify(value) + '\n';
      const sha256 = hash(bytes);
      const file = `content-parts/${id}-${sha256}.json`;
      files[file] = bytes;
      parts[id] = { file, sha256 };
    }
    const manifest = { schemaVersion: 2, revision: remote.revision, generatedAt: remote.generatedAt, parts };
    if (url.pathname.endsWith('content_manifest_v2.json')) return new Response(JSON.stringify(manifest));
    const file = url.pathname.slice(url.pathname.indexOf('content-parts/'));
    const id = Object.keys(parts).find((key) => parts[key].file === file);
    downloads.push({ id, host: url.hostname });
    if (!id || id === missingPart) return new Response('', { status: 404 });
    return new Response(mode === 'corrupt' || id === corruptPart ? '{}' : files[file]);
  };
  w.indexedDB = { open(...args) {
    const request = database.open(...args);
    request.addEventListener('success', () => {
      const db = request.result;
      const transaction = db.transaction.bind(db);
      db.transaction = (...params) => {
        if (storageFails && params[1] === 'readwrite') throw new Error('QuotaExceededError');
        return transaction(...params);
      };
    });
    return request;
  } };
  for (const name of ['content-schema.js', 'content-updates.js', 'app.js', 'v03-ui.js']) w.eval(fs.readFileSync(path.join(web, name), 'utf8'));
  await w.JianghuContent.ready;
  await wait(() => w.document.getElementById('data-update-button').getAttribute('aria-busy') === 'false');
  return dom;
}

(async () => {
  let dom = await open();
  try {
    let w = dom.window;
    let doc = w.document;
    assert.equal(doc.getElementById('data-update-status').textContent, '数据已是最新');
    assert.equal(requests[0], '47.95.250.113');
    assert.equal(downloads.length, 0, 'Unchanged version only fetches manifest');
    assert.equal(w.displayMartialRank(' ？ '), '?');
    assert.equal(w.displayMartialRank('?'), '?');
    assert.equal(w.displayMartialRank('12S'), 'S');
    doc.getElementById('encyclopedia-type').value = 'martial_arts';
    doc.getElementById('encyclopedia-martial-rank-filter').value = '?';
    doc.getElementById('encyclopedia-martial-rank-filter').dispatchEvent(new w.Event('change'));
    const unknownMartials = bundle.data.encyclopedia.martial_arts.filter((item) => ['?', '？'].includes(item.rank.trim()));
    assert(unknownMartials.length > 0);
    for (const item of unknownMartials) assert(doc.getElementById('encyclopedia-list').textContent.includes(item.name));
    assert(!doc.getElementById('encyclopedia-list').textContent.includes('光明拳'));
    doc.getElementById('encyclopedia-martial-rank-filter').value = '';
    assert.equal(doc.querySelectorAll('#guide-directory [data-guide-id]').length, initialGuideCount);
    doc.querySelector('[data-guide-id="calculation-details"]').click();
    const calculationGuide = bundle.data.strategyGuides.guides.find((guide) => guide.id === 'calculation-details');
    for (const section of calculationGuide.sections) {
      assert(doc.getElementById('guide-detail-content').textContent.includes(section.title));
      assert(doc.getElementById('guide-detail-content').textContent.includes(section.text));
    }
    doc.querySelector('[data-guide-id="miegu-lineup-summary"]').click();
    assert.equal(doc.querySelectorAll('.v03-lineup-directory').length, 31);
    doc.querySelector('[data-guide-favorite="guide:miegu-lineup-summary"]').click();
    const favorites = w.localStorage.getItem('jianghu-stat-simulator:guide:favorites:v1');
    doc.getElementById('technique-hp').dataset.mode = 'auto';
    for (const checkbox of doc.querySelectorAll('.technique-option')) checkbox.checked = false;
    doc.querySelector('.technique-option').dispatchEvent(new w.Event('change', { bubbles: true }));
    remote.revision += 1;
    remote.data.encyclopedia.techniques.find((x) => x.name === '佛法禅理').effect = '更新测试';
    remote.data.encyclopedia.techniques.find((x) => x.name === '佛法禅理').hp_percent = 27;
    remote.data.lineups[0].title = '更新测试阵容';
    const fluteBefore = remote.data.encyclopedia.techniques.find((x) => x.name === '音律');
    const fluteAfter = JSON.parse(execFileSync('python3', ['-c',
      'import sys,json; sys.path.insert(0,sys.argv[1]); import technique_sync; old=json.load(sys.stdin); new=dict(old,effect="7%闪避，8速度，9%攻击"); technique_sync.linked_update(old,new); print(json.dumps(new))',
      __dirname], { input: JSON.stringify(fluteBefore), encoding: 'utf8' }));
    Object.assign(fluteBefore, fluteAfter);
    remote.data.strategyGuides.guides.push({ id: 'test-new-guide', title: '新增攻略测试', author: '测试', summary: '', sections: [{ id: 'body', title: '新增文本', type: 'text', text: '无需新包的攻略内容' }] });
    mode = 'fallback';
    doc.getElementById('data-update-button').click();
    await wait(() => doc.getElementById('data-update-status').textContent === '数据更新成功');
    assert(requests.includes('flashba.github.io'));
    assert.match(doc.getElementById('technique-options').textContent, /27%血/);
    const fluteStats = w.techniqueStats(fluteAfter);
    assert.equal(fluteStats.attack, 9);
    assert.equal(fluteStats.secondary.speed, 8);
    assert.equal(fluteStats.secondary.dodge, 7);
    assert.equal(doc.getElementById('technique-hp').dataset.mode, 'auto');
    assert.equal(doc.querySelectorAll('.technique-option:checked').length, 0);
    assert.equal(doc.querySelectorAll('#guide-directory [data-guide-id]').length, initialGuideCount + 1);
    assert.match(doc.querySelector('.v03-lineup-directory summary').textContent, /更新测试阵容/);
    doc.querySelector('[data-guide-id="test-new-guide"]').click();
    assert.match(doc.getElementById('guide-detail-content').textContent, /无需新包的攻略内容/);
    assert.deepEqual(downloads.map((item) => item.id).sort(), ['encyclopedia', 'guides'], 'Only changed groups are downloaded');
    mode = 'offline';
    dom.window.close();
    dom = await open(favorites);
    w = dom.window;
    doc = w.document;
    assert.equal(w.JianghuContent.current.revision, remote.revision);
    assert.equal(doc.querySelectorAll('#guide-directory [data-guide-id]').length, initialGuideCount + 1);
    assert(w.localStorage.getItem('jianghu-stat-simulator:guide:favorites:v1').includes('guide:miegu-lineup-summary'));
    const goodRevision = remote.revision;
    for (const failure of ['corrupt', 'invalid', 'old', 'storage']) {
      mode = failure === 'corrupt' ? 'corrupt' : 'normal';
      remote.revision = failure === 'old' ? bundle.revision : goodRevision + 1;
      remote.data.lineups = failure === 'invalid' ? null : bundle.data.lineups;
      storageFails = failure === 'storage';
      assert.equal(await w.JianghuContent.checkForUpdates(), failure === 'old' ? 'ahead' : 'failed', failure);
      if (failure === 'old') assert.equal(doc.getElementById('data-update-status').textContent, '当前数据比线上版本更新，已保留');
      assert.equal(w.JianghuContent.current.revision, goodRevision, failure);
    }
    storageFails = false;
    mode = 'normal';
    remote.revision = goodRevision + 2;
    remote.data.lineups = bundle.data.lineups;
    remote.data.updateLogs.logs.push({ title: '分包日志测试', text: '新增日志' });
    const beforePartial = w.JianghuContent.current.revision;
    missingPart = 'logs';
    downloads.length = 0;
    assert.equal(await w.JianghuContent.checkForUpdates(), 'failed');
    assert.equal(w.JianghuContent.current.revision, beforePartial, 'Missing part must not partially commit');
    assert.equal(downloads.filter((item) => item.id === 'guides').length, 1, 'Verified parts reused across fallback sources');
    missingPart = null;
    corruptPart = 'logs';
    assert.equal(await w.JianghuContent.checkForUpdates(), 'failed');
    assert.equal(w.JianghuContent.current.revision, beforePartial);
    corruptPart = null;
    assert.equal(await w.JianghuContent.checkForUpdates(), 'updated');
    remote.revision += 1;
    remote.data.updateLogs.logs.push({ title: '仅改日志', text: '不下载其他包' });
    downloads.length = 0;
    assert.equal(await w.JianghuContent.checkForUpdates(), 'updated');
    assert.deepEqual(downloads.map((item) => item.id), ['logs']);
    mode = 'timeout';
    const started = Date.now();
    assert.equal(await w.JianghuContent.checkForUpdates(), 'current');
    assert(Date.now() - started >= 14900 && Date.now() - started < 19000);
    mode = 'normal';
    const first = w.JianghuContent.checkForUpdates();
    const second = w.JianghuContent.checkForUpdates();
    assert.equal(first, second);
    await first;
    dom.window.close();
    requests.length = 0;
    dom = await open(favorites, Date.now());
    w = dom.window;
    assert.equal(requests.length, 1, 'Every launch checks even with a stale daily-limit preference');
    Object.defineProperty(w.document, 'visibilityState', { value: 'visible', configurable: true });
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    assert.equal(requests.length, 1, 'Immediate foreground does not duplicate startup check');
    assert.equal(await w.JianghuContent.checkForUpdates(), 'current', 'Manual check always available');
    assert.equal(requests.length, 2);
    dom.window.close();
    requests.length = 0;
    dom = await open(favorites, Date.now() - 86400001);
    assert.equal(requests.length, 1, 'Every launch checks with old cache too');
    assert.deepEqual(errors, []);
    console.log('PASS: split updates, unchanged/changed-only downloads, partial failure rollback, fallback reuse, startup/manual updates, priority/fallback/timeout, new guides, live calculator data, 31 lineups, offline reload, favorites, hash/schema rejection, storage failure, rollback prevention, duplicate clicks');
  } finally { dom.window.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
