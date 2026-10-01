(() => {
  'use strict';
  const { validBundle, validPartsManifest, partIds, splitPayload, joinParts } = window.JianghuContentSchema;
  const sources = [
    'https://47.95.250.113/jianghu/',
    'https://flashba.github.io/jianghu-calculator/',
    'https://cdn.jsdelivr.net/gh/FlashBA/jianghu-calculator@main/web/',
    'https://raw.githubusercontent.com/FlashBA/jianghu-calculator/main/web/',
  ];
  let current = null;
  let pending = null;
  let initialized = false;
  let lastCheck = 0;

  async function request(url, timeoutMs = 40000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  const database = new Promise((resolve, reject) => {
    const open = indexedDB.open('jianghu-content', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('bundles');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('内容缓存被占用'));
  });
  // Local content still works if persistent storage is unavailable.
  database.catch(() => {});

  async function cache(value) {
    const db = await database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bundles', value ? 'readwrite' : 'readonly');
      const store = tx.objectStore('bundles');
      const operation = value ? store.put(value, 'current') : store.get('current');
      tx.oncomplete = () => resolve(operation.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('内容保存失败'));
    });
  }

  const ready = (async () => {
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
  })();

  async function downloadParts(base, manifest, staged) {
    const parts = splitPayload(current.data);
    // Bounded parallelism avoids opening a request for every part at once.
    const queue = partIds.filter((id) => current.partHashes?.[id] !== manifest.parts[id].sha256);
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const id = queue[cursor++];
        const descriptor = manifest.parts[id];
        if (!staged.has(descriptor.sha256)) {
          const bytes = await request(`${base}${descriptor.file}`);
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
    if (output) output.textContent = message;
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
    }
  }

  async function check() {
    await ready;
    let reachable = false;
    let newerSeen = false;
    let equalSeen = false;
    let newestRevision = current.revision;
    const staged = new Map();
    for (const base of sources) {
      try {
        const manifest = JSON.parse(await request(`${base}content_manifest_v2.json?t=${Date.now()}`, 15000));
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
        const next = await downloadParts(base, manifest, staged);
        // Commit the complete bundle before exposing any new data to the UI.
        await cache(next);
        current = next;
        window.dispatchEvent(new CustomEvent('jianghu-content-updated', { detail: next }));
        return 'updated';
      } catch (error) {
        console.warn('内容更新源暂不可用', base, error.message);
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

  window.JianghuContent = { ready, checkForUpdates, get current() { return current; } };
  document.getElementById('data-update-button')?.addEventListener('click', () => {
    if (initialized) checkForUpdates();
  });
  window.addEventListener('jianghu-app-ready', () => {
    initialized = true;
    checkForUpdates();
  }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (initialized && document.visibilityState === 'visible' && Date.now() - lastCheck > 3600000) checkForUpdates();
  });
  ready.catch((error) => status(error.message));
})();
