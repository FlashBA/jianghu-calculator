const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const web = path.resolve(__dirname, '../web');
const bundle = JSON.parse(fs.readFileSync(path.join(web, 'content_bundle.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(web, 'content_manifest_v2.json')));
const script = fs.readFileSync(path.join(web, 'content-updates.js'), 'utf8')
  .replace('MANIFEST_TIMEOUT_MS = 8000', 'MANIFEST_TIMEOUT_MS = 80')
  .replace('DOWNLOAD_TIMEOUT_MS = 20000', 'DOWNLOAD_TIMEOUT_MS = 200')
  .replace('UPDATE_TIMEOUT_MS = 45000', 'UPDATE_TIMEOUT_MS = 450')
  .replace('STORAGE_TIMEOUT_MS = 3000', 'STORAGE_TIMEOUT_MS = 30');

async function open(storage = 'normal') {
  const dom = new JSDOM('<button id="data-update-button"></button><p id="data-update-status"></p>', {
    url: 'https://appassets.androidplatform.net/assets/', runScripts: 'dangerously', virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  w.AbortController = AbortController;
  w.indexedDB = storage === 'blocked' ? { open: () => ({}) } : new IDBFactory();
  let mode = 'normal';
  let aborted = 0;
  let partRequests = 0;
  w.fetch = async (url, options) => {
    if (String(url).endsWith('content_bundle.json')) return new Response(JSON.stringify(bundle));
    if (mode === 'manifest-hang') return new Promise(() => {});
    if (String(url).includes('content_manifest_v2.json')) {
      const next = structuredClone(manifest);
      next.revision = mode === 'parts-hang' ? bundle.revision + 1 : bundle.revision;
      if (mode === 'parts-hang') {
        for (const part of Object.values(next.parts)) {
          part.sha256 = 'a'.repeat(64);
          part.file = part.file.replace(/[a-f0-9]{64}/, part.sha256);
        }
      }
      return new Response(JSON.stringify(next));
    }
    partRequests += 1;
    options.signal.addEventListener('abort', () => { aborted += 1; });
    // A stalled body deliberately ignores AbortSignal, as some bridges can do.
    return { ok: true, text: () => new Promise(() => {}) };
  };
  w.eval(fs.readFileSync(path.join(web, 'content-schema.js'), 'utf8'));
  w.eval(script);
  await w.JianghuContent.ready;
  return { dom, w, setMode: (value) => { mode = value; }, stats: () => ({ aborted, partRequests }) };
}

(async () => {
  const blocked = await open('blocked');
  assert.equal(blocked.w.JianghuContent.current.revision, bundle.revision, 'Blocked storage falls back to bundled content');
  blocked.dom.window.close();
  const { dom, w, setMode, stats } = await open();
  try {
    const original = w.JianghuContent.current;
    let updates = 0;
    w.addEventListener('jianghu-content-updated', () => { updates += 1; });
    for (const mode of ['manifest-hang', 'parts-hang']) {
      setMode(mode);
      const started = Date.now();
      const pending = w.JianghuContent.checkForUpdates();
      assert.equal(w.JianghuContent.current, original, 'Downloading must keep the existing data');
      assert.equal(await pending, 'failed');
      assert(Date.now() - started < 900, 'The whole check must stop within its time budget');
      assert.equal(w.JianghuContent.current, original, 'A timeout must not replace data');
      assert.equal(updates, 0);
      assert.equal(w.document.getElementById('data-update-button').disabled, false);
      assert.match(w.document.getElementById('data-update-status').textContent, /当前数据已保留/);
    }
    assert(stats().partRequests > 0, 'Exercise stalled response bodies');
    assert(stats().aborted > 0, 'Timed out downloads are cancelled');
    setMode('normal');
    assert.equal(await w.JianghuContent.checkForUpdates(), 'current', 'A timed out check can be retried');
    console.log('PASS: blocked cache fallback, stalled fetch/body deadlines, old data retained, no update event, button recovery and retry');
  } finally {
    dom.window.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
