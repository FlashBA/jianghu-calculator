const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { validPayload, validBundle, validManifest } = require('../web/content-schema.js');
const web = path.resolve(__dirname, '../web');
if (process.argv.includes('--sync-sources')) {
  if (process.argv.includes('--check')) throw new Error('Use --sync-sources separately from --check');
  execFileSync('python3', [path.join(__dirname, 'sync_tencent_pitfalls.py')], { stdio: 'inherit' });
}
const read = (name) => JSON.parse(fs.readFileSync(path.join(web, name), 'utf8'));
const pitfalls = read('tencent_pitfalls.json');
if (pitfalls.source?.document_url !== 'https://docs.qq.com/sheet/DSWJSVEVGc1Z6Q21E'
  || pitfalls.source?.sheet_id !== 'jnxb02' || !Array.isArray(pitfalls.items) || !pitfalls.items.length
  || !pitfalls.items.every((item, index) => item.order === index + 1 && typeof item.text === 'string' && item.text.trim())) {
  throw new Error('Invalid bound pitfalls source');
}
const isWarning = (item) => item.text.includes('武道感悟') && item.text.includes('不要直接使用');
const orderedPitfalls = [...pitfalls.items.filter(isWarning), ...pitfalls.items.filter((item) => !isWarning(item))];
const wiki = read('wiki_content.json');
const data = {
  ...wiki,
  directory: { ...wiki.directory,
    pitfalls: orderedPitfalls.map((item) => ({
      title: isWarning(item) ? '武道感悟' : item.label,
      text: item.text,
      source_label: item.label,
      source_cell: item.text_cell,
      ...(isWarning(item) ? { warning: '不要直接使用！' } : {}),
    })),
    pitfallsSource: pitfalls.source,
    pitfallsNotice: pitfalls.notice,
  },
  encyclopedia: read('whiterabbit_data.json'),
  searchIndex: read('guide_search_index.json'),
  strategyGuides: read('strategy_guides.json'),
  achievements: read('achievements.json'),
  recipeData: read('tencent_recipe_data.json'),
  strategyText: read('strategy_ocr_data.json'),
  updateLogs: read('update_logs.json'),
};
if (!validPayload(data)) throw new Error('Invalid content sources; bundle not written');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
let previous;
try { previous = read('content_bundle.json'); } catch { /* First build. */ }
if (process.argv.includes('--check')) {
  const manifest = read('content_manifest.json');
  if (!validBundle(previous) || !validManifest(manifest)
    || JSON.stringify(previous.data) !== JSON.stringify(data)
    || manifest.revision !== previous.revision
    || manifest.sha256 !== digest(fs.readFileSync(path.join(web, manifest.file)))) {
    throw new Error('Content bundle is stale or invalid; run node tools/build-content-bundle.cjs');
  }
  console.log('Content bundle and sources match');
} else {
  const unchanged = validBundle(previous) && JSON.stringify(previous.data) === JSON.stringify(data);
  const revision = unchanged ? previous.revision : Math.max(Date.now(), (previous?.revision || 0) + 1);
  const bundle = { schemaVersion: 1, revision, generatedAt: new Date(revision).toISOString(), data };
  const bytes = JSON.stringify(bundle) + '\n';
  const manifest = { schemaVersion: 1, revision, file: 'content_bundle.json', sha256: digest(bytes) };
  fs.writeFileSync(path.join(web, 'content_bundle.json'), bytes);
  fs.writeFileSync(path.join(web, 'content_manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Content revision ${revision}: ${Buffer.byteLength(bytes)} bytes`);
}
execFileSync('python3', [path.join(__dirname, 'content_parts.py'), '--public', web,
  ...(process.argv.includes('--check') ? ['--check'] : [])], { stdio: 'inherit' });
