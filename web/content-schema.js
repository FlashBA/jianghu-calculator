(function (root) {
  'use strict';
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const text = (value) => typeof value === 'string';
  const records = (value, test) => Array.isArray(value) && value.every((item) => object(item) && test(item));

  function validPayload(data) {
    if (!object(data) || !object(data.encyclopedia)) return false;
    const encyclopedia = data.encyclopedia;
    if (!['characters', 'techniques', 'inner_skills', 'martial_arts', 'equipment', 'dungeon_drops']
      .every((key) => records(encyclopedia[key], () => true))) return false;
    if (!encyclopedia.characters.length || !encyclopedia.martial_arts.length) return false;
    if (!object(data.directory) || !records(data.directory.pitfalls, (item) => text(item.title) && text(item.text))) return false;
    if (!records(data.guideNotes, (item) => text(item.title) && text(item.text))) return false;
    if (!object(data.tables) || !Object.values(data.tables).every((table) => object(table)
      && Array.isArray(table.columns) && table.columns.every(text)
      && Array.isArray(table.rows) && table.rows.every(Array.isArray))) return false;
    if (!Array.isArray(data.followers) || !data.followers.every((row) => Array.isArray(row)
      && text(row[0]) && Array.isArray(row[1]) && Array.isArray(row[2]))) return false;
    if (!records(data.lineups, (item) => text(item.title) && Array.isArray(item.rows)
      && item.rows.every((row) => Array.isArray(row) && row.length === 7 && row.every(text)))) return false;
    if (!records(data.searchIndex?.records, (item) => text(item.id) && text(item.text))) return false;
    if (!records(data.strategyGuides?.guides, (guide) => text(guide.id) && text(guide.title)
      && records(guide.sections, (section) => text(section.id) && text(section.title)
        && ['image', 'text', 'table'].includes(section.type)
        && (section.type !== 'text' || text(section.text))
        && (section.type !== 'table' || (Array.isArray(section.columns) && section.columns.every(text)
          && (Array.isArray(section.rows) ? section.rows.every(Array.isArray) : records(section.items, () => true))))))) return false;
    const ids = data.strategyGuides.guides.map((item) => item.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => ['pitfalls', 'recipes', 'original-search', 'update-logs', 'version-notes'].includes(id))) return false;
    return Array.isArray(data.recipeData?.recipes) && object(data.strategyText?.sections)
      && Array.isArray(data.updateLogs?.logs);
  }

  function validBundle(bundle) {
    return object(bundle) && bundle.schemaVersion === 1 && Number.isSafeInteger(bundle.revision)
      && bundle.revision > 0 && Number.isFinite(Date.parse(bundle.generatedAt)) && validPayload(bundle.data);
  }

  function validManifest(manifest) {
    return object(manifest) && manifest.schemaVersion === 1 && Number.isSafeInteger(manifest.revision)
      && manifest.revision > 0 && manifest.file === 'content_bundle.json'
      && /^[a-f0-9]{64}$/.test(manifest.sha256);
  }

  const partIds = ['encyclopedia', 'dungeons', 'pitfalls', 'guides', 'search', 'recipes', 'strategy', 'logs'];
  function splitPayload(data) {
    const { encyclopedia, directory, searchIndex, recipeData, strategyText, updateLogs, ...guides } = data;
    const { dungeon_drops, ...catalogue } = encyclopedia;
    const { pitfalls, pitfallsSource, pitfallsNotice, ...otherDirectory } = directory;
    return { encyclopedia: catalogue, dungeons: dungeon_drops,
      pitfalls: { pitfalls, pitfallsSource, pitfallsNotice },
      guides: { ...guides, directory: otherDirectory }, search: searchIndex,
      recipes: recipeData, strategy: strategyText, logs: updateLogs };
  }
  function joinParts(parts) {
    return { ...parts.guides, encyclopedia: { ...parts.encyclopedia, dungeon_drops: parts.dungeons },
      directory: { ...parts.guides.directory, ...parts.pitfalls }, searchIndex: parts.search,
      recipeData: parts.recipes, strategyText: parts.strategy, updateLogs: parts.logs };
  }
  function validPartsManifest(manifest) {
    return object(manifest) && manifest.schemaVersion === 2 && Number.isSafeInteger(manifest.revision)
      && manifest.revision > 0 && Number.isFinite(Date.parse(manifest.generatedAt))
      && object(manifest.parts) && Object.keys(manifest.parts).length === partIds.length
      && partIds.every((id) => {
        const part = manifest.parts[id];
        return object(part) && /^[a-f0-9]{64}$/.test(part.sha256)
          && part.file === `content-parts/${id}-${part.sha256}.json`;
      });
  }

  const api = { validPayload, validBundle, validManifest, validPartsManifest, partIds, splitPayload, joinParts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JianghuContentSchema = api;
})(typeof window === 'undefined' ? globalThis : window);
