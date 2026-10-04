(() => {
  'use strict';
  const { validBundle, validPartsManifest, partIds, splitPayload, joinParts } = window.JianghuContentSchema;
  const sources = [
    'https://jianghu-baitu.oss-cn-beijing.aliyuncs.com/jianghu/',
    'https://47.95.250.113/jianghu/',
    'https://flashba.github.io/jianghu-calculator/',
    'https://cdn.jsdelivr.net/gh/FlashBA/jianghu-calculator@main/web/',
    'https://raw.githubusercontent.com/FlashBA/jianghu-calculator/main/web/',
  ];
  let current = null;
  let pending = null;
  let initialized = false;
  let lastCheck = 0;
  const MANIFEST_TIMEOUT_MS = 8000;
  const DOWNLOAD_TIMEOUT_MS = 20000;
  const UPDATE_TIMEOUT_MS = 45000;
  const STORAGE_TIMEOUT_MS = 3000;

  function remaining(deadline, limit) {
    const duration = Math.min(limit, deadline - Date.now());
    if (duration <= 0) throw new Error('数据更新超时');
    return duration;
  }

  async function request(url, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.text();
        })(),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('数据请求超时'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  let database = null;
  function getDatabase() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      const open = indexedDB.open('jianghu-content', 1);
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        reject(new Error('内容缓存打开超时'));
      }, STORAGE_TIMEOUT_MS);
      open.onupgradeneeded = () => open.result.createObjectStore('bundles');
      open.onsuccess = () => {
        clearTimeout(timer);
        if (expired) open.result.close();
        else resolve(open.result);
      };
      open.onerror = () => { clearTimeout(timer); reject(open.error); };
      open.onblocked = () => { expired = true; clearTimeout(timer); reject(new Error('内容缓存被占用')); };
    });
    // A failed open must not permanently prevent a later startup retry.
    database.catch(() => { database = null; });
    return database;
  }

  async function cache(value, deadline = Infinity) {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const timeoutMs = remaining(deadline, STORAGE_TIMEOUT_MS);
      const tx = db.transaction('bundles', value ? 'readwrite' : 'readonly');
      const timer = setTimeout(() => {
        try { tx.abort(); } catch {}
        reject(new Error('内容缓存读写超时'));
      }, timeoutMs);
      const store = tx.objectStore('bundles');
      const operation = value ? store.put(value, 'current') : store.get('current');
      tx.oncomplete = () => { clearTimeout(timer); resolve(operation.result); };
      tx.onerror = () => { clearTimeout(timer); reject(tx.error); };
      tx.onabort = () => { clearTimeout(timer); reject(tx.error || new Error('内容保存失败')); };
    });
  }

  async function loadContent() {
    // Reuse the saved snapshot without downloading the full web bundle on every visit.
    const saved = await cache().catch(() => null);
    if (validBundle(saved)) {
      current = saved;
      return current;
    }
    const local = await request(`${window.APP_DATA_BASE || './'}content_bundle.json`).then(JSON.parse);
    if (!validBundle(local)) throw new Error('内容读取失败，请重新打开应用');
    current = local;
    await cache(current).catch(() => {});
    return current;
  }
  let ready = loadContent();
  let retryPending = null;

  function retryLoad() {
    if (current) return Promise.resolve(current);
    if (retryPending) return retryPending;
    ready = loadContent();
    retryPending = ready.then((bundle) => {
      window.dispatchEvent(new CustomEvent('jianghu-content-ready', { detail: bundle }));
      return bundle;
    }).finally(() => { retryPending = null; });
    return retryPending;
  }

  async function downloadParts(base, manifest, staged, deadline) {
    const parts = splitPayload(current.data);
    // Bounded parallelism avoids opening a request for every part at once.
    const queue = partIds.filter((id) => current.partHashes?.[id] !== manifest.parts[id].sha256);
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const id = queue[cursor++];
        const descriptor = manifest.parts[id];
        if (!staged.has(descriptor.sha256)) {
          const bytes = await request(`${base}${descriptor.file}`, remaining(deadline, DOWNLOAD_TIMEOUT_MS));
          const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bytes));
          const hex = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
          if (hex !== descriptor.sha256) throw new Error('内容校验失败');
          staged.set(descriptor.sha256, JSON.parse(bytes));
        }
        parts[id] = staged.get(descriptor.sha256);
      }
    }
    const results = await Promise.allSettled(Array.from({ length: Math.min(3, queue.length) }, worker));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    const next = { schemaVersion: 1, revision: manifest.revision, generatedAt: manifest.generatedAt,
      partHashes: Object.fromEntries(partIds.map((id) => [id, manifest.parts[id].sha256])), data: joinParts(parts) };
    if (!validBundle(next)) throw new Error('内容格式不兼容');
    return next;
  }

  function status(message, busy = false) {
    const output = document.getElementById('data-update-status');
    const button = document.getElementById('data-update-button');
    if (output) output.textContent = window.jianghuApp?.startupError
      ? `${window.jianghuApp.startupError} ${message}` : message;
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
    }
  }

  async function check() {
    await ready;
    const deadline = Date.now() + UPDATE_TIMEOUT_MS;
    let reachable = false;
    let newerSeen = false;
    let equalSeen = false;
    let newestRevision = current.revision;
    const staged = new Map();
    for (const base of sources) {
      try {
        const manifest = JSON.parse(await request(`${base}content_manifest_v2.json?t=${Date.now()}`, remaining(deadline, MANIFEST_TIMEOUT_MS)));
        if (!validPartsManifest(manifest)) throw new Error('内容格式不兼容');
        reachable = true;
        if (manifest.revision < newestRevision) continue;
        if (manifest.revision < current.revision) continue;
        if (manifest.revision === current.revision) {
          equalSeen = true;
          if (!newerSeen) return 'current';
          continue;
        }
        newerSeen = true;
        newestRevision = manifest.revision;
        const next = await downloadParts(base, manifest, staged, deadline);
        // Commit the complete bundle before exposing any new data to the UI.
        remaining(deadline, STORAGE_TIMEOUT_MS);
        await cache(next, deadline);
        current = next;
        window.dispatchEvent(new CustomEvent('jianghu-content-updated', { detail: next }));
        return 'updated';
      } catch (error) {
        console.warn('内容更新源暂不可用', base, error.message);
        if (Date.now() >= deadline) break;
      }
    }
    if (!reachable || newerSeen) throw new Error('暂未取得有效更新信息，已保留当前数据');
    return equalSeen ? 'current' : 'ahead';
  }

  function checkForUpdates() {
    if (pending) return pending;
    status('正在检查数据更新…', true);
    pending = check().then((result) => {
      lastCheck = Date.now();
      status(result === 'updated' ? '数据更新成功' : result === 'ahead' ? '当前数据比线上版本更新，已保留' : '数据已是最新');
      return result;
    }).catch((error) => {
      status(error.message === '内容读取失败，请重新打开应用' ? error.message : '更新未完成，请重试；当前数据已保留');
      return 'failed';
    }).finally(() => { pending = null; });
    return pending;
  }

  window.JianghuContent = { get ready() { return ready; }, retryLoad, checkForUpdates,
    showStartupStatus: (message, busy = false) => status(message, busy || Boolean(pending)),
    readJsonAsset: async (url) => JSON.parse(await request(url)),
    get current() { return current; } };
  document.getElementById('data-update-button')?.addEventListener('click', () => {
    if (window.jianghuApp && !window.jianghuApp.initialized) {
      window.jianghuApp.retryStartup().then((success) => { if (success || current) checkForUpdates(); });
    } else if (initialized) checkForUpdates();
  });
  window.addEventListener('jianghu-encyclopedia-ready', () => {
    initialized = true;
    checkForUpdates();
  }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (initialized && document.visibilityState === 'visible' && Date.now() - lastCheck > 3600000) checkForUpdates();
  });
  ready.catch((error) => status(error.message));
})();
