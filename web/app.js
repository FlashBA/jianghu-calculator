const STORAGE_KEY = 'jianghu-stat-simulator:character:v6';
const BASE_SPEED_DEFAULTS_VERSION = 2;
const BASE_CRIT_DEFAULTS_VERSION = 1;
const CHARACTER_BASE_DEFAULTS_VERSION = 1;
const LEGACY_STORAGE_KEYS = [
  'jianghu-stat-simulator:character:v5',
  'jianghu-stat-simulator:character:v4',
  'jianghu-stat-simulator:character:v3',
  'jianghu-stat-simulator:character:v2',
];

const SECONDARY_STAT_DEFS = [
  { key: 'speed', label: '速度', format: 'number', aliases: ['速度'] },
  { key: 'mitigation', label: '免伤', aliases: ['免伤'] },
  { key: 'crit', label: '暴击', aliases: ['暴击率', '暴击'], exclude: '伤害|率' },
  { key: 'dodge', label: '闪避', aliases: ['闪避'] },
  { key: 'lifesteal', label: '吸血', aliases: ['吸血'] },
  { key: 'critDamage', label: '爆伤', aliases: ['暴击伤害', '爆伤'] },
  { key: 'block', label: '格挡', aliases: ['格挡', '招架'] },
  { key: 'reflect', label: '反伤', aliases: ['反伤'] },
  { key: 'recovery', label: '回复', format: 'number', aliases: ['回复', '恢复', '疗伤'] },
];
const SECONDARY_KEYS = SECONDARY_STAT_DEFS.map((stat) => stat.key);
const CHARACTER_BASE_STAT_FIELDS = {
  speed: 'base-speed',
  mitigation: 'base-mitigation',
  crit: 'base-crit',
  dodge: 'base-dodge',
  lifesteal: 'base-lifesteal',
  critDamage: 'base-crit-damage',
  block: 'base-block',
  reflect: 'base-reflect',
  recovery: 'base-recovery',
};
const DEFAULT_CHARACTER_BASE_STATS = {
  speed: 0,
  mitigation: 0,
  crit: 10,
  dodge: 0,
  lifesteal: 0,
  critDamage: 0,
  block: 0,
  reflect: 0,
  recovery: 0,
};
const MAX_COMPARISON_SNAPSHOTS = 20;
const INNER_MANUAL_FIELD_IDS = ['neigong-hp', 'neigong-attack', ...SECONDARY_KEYS.map((key) => (
  `neigong-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
))];
const WEAPON_ATTRIBUTE_OPTIONS = [
  { key: 'hp', label: '生命' },
  { key: 'attack', label: '攻击' },
  ...SECONDARY_STAT_DEFS.map((stat) => ({ key: stat.key, label: stat.label })),
];
const FORMATION_OPTIONS = [
  { key: '', label: '不布阵' },
  { key: 'jiugong', label: '九宫八卦阵' },
  { key: 'baxu', label: '八枢汇极阵' },
];
const FORMATION_POSITION_OPTIONS = Array.from({ length: 9 }, (_, index) => ({
  key: String(index + 1),
  label: `${index + 1}号位`,
}));
const MARTIAL_STYLE_KEYS = ['拳法', '剑法', '刀法', '棍法'];

const EMPTY_EQUIPMENT = () => ({
  id: null, name: '', hp: 0, attack: 0, hpFlat: 0, attackFlat: 0,
  secondary: emptySecondaryStats(), extra: '',
});
const EMPTY_WEAPON_AFFIX = () => ({ key: '', mode: 'flat', value: 0 });
const state = {
  data: null,
  whiteRabbit: null,
  equipmentSlots: [EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT()],
  weaponName: '',
  weaponAffixes: [EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX()],
};
let resultGenerated = false;
let currentResult = null;
let comparisonSnapshots = [];
let comparisonPair = [0, 1];
let activeComparisonIndex = null;
let techniqueSelectionCustomized = false;

const $ = (id) => document.getElementById(id);

function trunc(value) { return Math.trunc(value); }
function formatNumber(value) { return Number(value).toLocaleString('zh-CN'); }
function formatPercent(value) {
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}
function numberValue(id, fallback = 0) {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : fallback;
}
function numberValueFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function emptySecondaryStats() {
  return Object.fromEntries(SECONDARY_KEYS.map((key) => [key, 0]));
}
function emptyStylePower() {
  return Object.fromEntries(MARTIAL_STYLE_KEYS.map((style) => [style, 0]));
}
function addStylePower(target, source) {
  MARTIAL_STYLE_KEYS.forEach((style) => { target[style] += numberValueFrom(source?.[style]); });
  return target;
}
function stylePowerFromText(text) {
  const totals = emptyStylePower();
  const normalized = String(text || '').replaceAll('\n', '，');
  const beforeStyle = /(\d+(?:\.\d+)?)\s*%{1,2}[^\n，。；;]*?(拳脚|拳掌|拳法|剑法|刀法|棍法)[^\n，。；;]*?(?:威力|伤害)/g;
  const afterStyle = /(拳脚|拳掌|拳法|剑法|刀法|棍法)[^\n，。；;]*?(\d+(?:\.\d+)?)\s*%{1,2}[^\n，。；;]*?(?:威力|伤害)/g;
  let match;
  while ((match = beforeStyle.exec(normalized))) {
    const style = match[2] === '拳脚' || match[2] === '拳掌' ? '拳法' : match[2];
    totals[style] += Number(match[1]);
  }
  while ((match = afterStyle.exec(normalized))) {
    const style = match[1] === '拳脚' || match[1] === '拳掌' ? '拳法' : match[1];
    totals[style] += Number(match[2]);
  }
  return totals;
}
function stylePowerFromEffect(effect) {
  const text = String(effect?.desp || '');
  const rendered = Number.isFinite(Number(effect?.v)) && /%d/.test(text)
    ? text.replaceAll('%d', String(effect.v))
    : text;
  return stylePowerFromText(rendered);
}
function addSecondaryStats(target, source) {
  SECONDARY_KEYS.forEach((key) => { target[key] += numberValueFrom(source?.[key]); });
  return target;
}
function secondaryStatsFromRecord(record) {
  return {
    speed: Number(record?.speed) || 0,
    mitigation: Number(record?.mitigation_percent) || 0,
    crit: Number(record?.crit_percent) || 0,
    dodge: Number(record?.dodge_percent) || 0,
    lifesteal: Number(record?.lifesteal_percent) || 0,
    critDamage: Number(record?.crit_damage_percent) || 0,
    block: Number(record?.block) || 0,
    reflect: Number(record?.reflect_percent) || 0,
    recovery: Number(record?.heal_percent) || 0,
  };
}
function formatSecondaryValue(key, value) {
  return SECONDARY_STAT_DEFS.find((stat) => stat.key === key)?.format === 'number'
    ? formatNumber(Math.round(Number(value) || 0))
    : formatPercent(value);
}
function secondaryStatsFromText(text) {
  const stats = emptySecondaryStats();
  const statMap = {
    速度: 'speed', 免伤: 'mitigation', 闪避: 'dodge', 吸血: 'lifesteal',
    暴击率: 'crit', 暴击: 'crit', 暴击伤害: 'critDamage', 爆伤: 'critDamage',
    格挡: 'block', 招架: 'block', 反伤: 'reflect', 回复: 'recovery',
    恢复: 'recovery', 疗伤: 'recovery',
  };
  const pattern = /(降低|减少)?\s*(\d+(?:\.\d+)?)\s*%?\s*(暴击伤害|暴击率|暴击|免伤|闪避|吸血|反伤|格挡|招架|回复|恢复|疗伤|速度)/g;
  let match;
  while ((match = pattern.exec(String(text || '').replaceAll('\n', '，')))) {
    const key = statMap[match[3]];
    if (key) stats[key] += (match[1] ? -1 : 1) * Number(match[2]);
  }
  return stats;
}
function secondaryStatsSummary(stats) {
  return SECONDARY_STAT_DEFS
    .map((definition) => {
      const value = Number(stats?.[definition.key]) || 0;
      return value ? formatSecondaryValue(definition.key, value) + definition.label : '';
    })
    .filter(Boolean)
    .join(' · ');
}
function innerStatsSummary(stats) {
  if (!stats) return '无属性';
  const primary = [
    stats.hp ? `${formatPercent(stats.hp)}血` : '',
    stats.attack ? `${formatPercent(stats.attack)}攻` : '',
  ].filter(Boolean);
  const secondary = secondaryStatsSummary(stats.secondary);
  if (secondary) primary.push(secondary);
  return primary.join(' / ') || '无属性';
}
function formationStats() {
  const formation = $('formation-select')?.value || '';
  if (!formation) return { name: '不布阵', position: 0, hp: 0, attack: 0, secondary: emptySecondaryStats(), note: '' };
  const roleName = $('person-name').value.trim() || '自定义角色';
  const position = roleName === '主角' ? 1 : Math.max(1, Math.min(9, Math.round(numberValue('formation-position', 1))));
  const secondary = emptySecondaryStats();
  const result = {
    name: formation === 'jiugong' ? '九宫八卦阵' : '八枢汇极阵',
    position,
    hp: 0,
    attack: 0,
    secondary,
    note: '',
  };
  if (formation === 'jiugong') {
    const slots = {
      1: { hp: -20, attack: -20, mitigation: -12, note: '中宫，负责维持阵法' },
      2: { lifesteal: 10, dodge: 12, note: '坎位' },
      3: { hp: 10, mitigation: 5, note: '坤位' },
      4: { speed: 15, crit: 8, note: '震位' },
      5: { speed: 12, dodge: 12, note: '巽位' },
      6: { note: '乾位' },
      7: { crit: 10, lifesteal: 10, note: '兑位' },
      8: { block: 15, reflect: 50, note: '艮位' },
      9: { crit: 10, critDamage: 50, note: '离位' },
    };
    const slot = slots[position];
    result.hp = slot.hp || 0;
    result.attack = slot.attack || 0;
    addSecondaryStats(secondary, slot);
    result.note = slot.note;
    return result;
  }
  if (position === 1) {
    const scale = 1;
    result.hp = 24 * scale;
    result.attack = 24 * scale;
    addSecondaryStats(secondary, {
      lifesteal: 24 * scale,
      crit: 24 * scale,
      critDamage: 48 * scale,
      speed: 24 * scale,
      mitigation: 24 * scale,
      dodge: 24 * scale,
      block: 24 * scale,
    });
    result.note = '1号位初始效果 100%';
  } else {
    result.hp = -7;
    result.attack = -7;
    addSecondaryStats(secondary, {
      mitigation: -7,
      speed: -7,
      dodge: -7,
      block: -7,
      crit: -7,
      critDamage: -14,
      lifesteal: -7,
    });
    result.note = '2-9号位负面效果';
  }
  return result;
}
const WEAPON_TYPES = new Set([1, 2, 3]);
function isWeapon(item) { return WEAPON_TYPES.has(Number(item?.type)); }
function isSEquipment(item) {
  return item?.source === 'white'
    ? isSOrUnknownRank(item.rank)
    : Number(item?.star) >= 6;
}
function isSOrUnknownRank(value) {
  const rank = String(value || '').trim().toUpperCase();
  return rank.endsWith('S') || rank === '?' || rank === '？';
}
function getWhiteEquipment(id) {
  return state.whiteRabbit?.equipment?.find((item) => String(item.id) === String(id));
}
function normalizedDataName(value) {
  return String(value || '').replace(/\s+/g, '');
}
function findWhiteEquipmentByName(name) {
  const target = normalizedDataName(name);
  if (!target) return null;
  return state.whiteRabbit?.equipment?.find((item) => normalizedDataName(item.name || item.nick) === target) || null;
}
function findWhiteInnerIndexByName(name) {
  const target = normalizedDataName(name);
  return (state.whiteRabbit?.inner_skills || []).findIndex((item) => normalizedDataName(item.name) === target);
}
function findWhiteMartialIndexByName(name) {
  const target = normalizedDataName(name);
  return (state.whiteRabbit?.martial_arts || []).findIndex((item) => normalizedDataName(item.name) === target);
}
function getRawEquipment(id) {
  const key = String(id);
  return key.startsWith('wr-eq-') ? getWhiteEquipment(key) : state.data?.equip?.[key];
}
function getEquipment(id) {
  const item = getRawEquipment(id);
  return isWeapon(item) || !isSEquipment(item) ? null : item;
}
function getWhiteInner(index) {
  const item = state.whiteRabbit?.inner_skills?.[Number(index)];
  return item || null;
}
function getSelectedMartial() {
  const value = $('martial-select')?.value || '';
  if (!value) return null;
  if (value.startsWith('old-skill:')) {
    const item = state.data?.skill?.[value.slice(10)];
    return item ? { source: 'game', item } : null;
  }
  if (value.startsWith('wr-skill:')) {
    const item = state.whiteRabbit?.martial_arts?.[Number(value.slice(9))];
    return item ? { source: 'white', item } : null;
  }
  return null;
}
function martialSpeed(selection = getSelectedMartial()) {
  return Number(selection?.item?.speed) || 0;
}
function martialStyle(item) {
  if (MARTIAL_STYLE_KEYS.includes(item?.style)) return item.style;
  return ({ 1: '拳法', 2: '剑法', 3: '刀法', 4: '棍法' })[Number(item?.type)] || '';
}
function getCharacterProfile(name = $('person-name')?.value) {
  return state.whiteRabbit?.characters?.find((character) => character.name === name) || null;
}
function styleOptionFromMartialStyle(style) {
  return ({ 拳法: '拳主', 剑法: '剑主', 刀法: '刀主', 棍法: '棍主' })[style] || '';
}
function currentMartialStyle() {
  const personName = $('person-name')?.value.trim() || '自定义角色';
  const profile = getCharacterProfile(personName);
  if (personName !== '主角' && profile?.style) {
    return ['全能', '拳剑刀棍'].includes(profile.style) ? '' : profile.style;
  }
  const selectedStyle = $('person-style')?.value || '';
  return ({ 拳主: '拳法', 剑主: '剑法', 刀主: '刀法', 棍主: '棍法' })[selectedStyle] || selectedStyle;
}
function martialStyleEligible(item) {
  const style = currentMartialStyle();
  return !style || style === '全能' || style === '拳剑刀棍' || martialStyle(item) === style;
}
function applyCharacterDefaults({ resetBaseStats = true } = {}) {
  const profile = getCharacterProfile();
  let changed = false;
  const personName = $('person-name').value.trim() || '自定义角色';
  if (resetBaseStats) {
    const baseStats = { ...DEFAULT_CHARACTER_BASE_STATS, ...(profile?.base_stats || {}) };
    Object.entries(CHARACTER_BASE_STAT_FIELDS).forEach(([key, id]) => {
      const value = Number(baseStats[key]) || 0;
      if (Number($(id).value) !== value) {
        $(id).value = value;
        changed = true;
      }
    });
  }
  if (personName !== '自定义角色') {
    const achievementDefault = personName === '主角' ? 292 : 177;
    ['achievement-hp', 'achievement-attack'].forEach((id) => {
      const current = Number($(id).value);
      if (current === 177 || current === 292) {
        if (current !== achievementDefault) {
          $(id).value = achievementDefault;
          changed = true;
        }
      }
    });
  }
  const styleControl = $('person-style');
  if (!profile) {
    styleControl.disabled = false;
    return changed;
  }
  if (Number.isFinite(Number(profile.hp_factor))) {
    $('hp-factor').value = profile.hp_factor;
    changed = true;
  }
  if (Number.isFinite(Number(profile.power_factor))) {
    $('power-factor').value = profile.power_factor;
    changed = true;
  }
  const profileStyle = styleOptionFromMartialStyle(profile.style);
  if (profileStyle) {
    if (styleControl.value !== profileStyle) {
      styleControl.value = profileStyle;
      changed = true;
    }
    styleControl.disabled = true;
  } else {
    styleControl.disabled = false;
  }
  return changed;
}
function populateCharacterPresets() {
  const list = $('person-name');
  if (!list) return;
  const names = new Set(['主角', ...(state.whiteRabbit?.characters || []).map((character) => character.name).filter(Boolean), '自定义角色']);
  list.replaceChildren();
  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    list.appendChild(option);
  });
  list.value = '主角';
  applyCharacterDefaults();
}
function techniqueOptionEntries() {
  const entries = [];
  (state.whiteRabbit?.techniques || []).forEach((technique, index) => {
    if (technique.calculate === false) return;
    if (technique.name === '赌术' || technique.name === '任督二脉') return;
    if (technique.group === 'wolong' && Array.isArray(technique.choices)) {
      technique.choices.forEach((choice, choiceIndex) => {
        entries.push({
          id: `wolong:${index}:${choiceIndex}`,
          ...technique,
          ...choice,
          name: choice.name,
          parentName: technique.name,
          group: 'wolong',
          group_label: technique.group_label || '卧龙心决（三选一）',
        });
      });
      return;
    }
    const inferredGroup = ['拳主', '剑主', '刀主', '棍主'].some((item) => String(technique.scope || '').includes(item))
      ? 'profession'
      : undefined;
    entries.push({ id: String(index), ...technique, group: technique.group || inferredGroup });
  });
  return entries;
}

function getWhiteTechnique(id) {
  return techniqueOptionEntries().find((item) => String(item.id) === String(id)) || null;
}

function effects(record) {
  const values = [];
  ['e1', 'e2'].forEach((key) => { if (record?.[key]) values.push(record[key]); });
  if (Array.isArray(record?.eff)) values.push(...record.eff);
  if (Array.isArray(record?.tx)) values.push(...record.tx);
  return values;
}
function effectSum(record, type) {
  return effects(record).filter((effect) => Number(effect.t) === type)
    .reduce((sum, effect) => sum + Number(effect.v || 0), 0);
}
const EQUIPMENT_SECONDARY_EFFECTS = {
  65536: 'speed',
  4: 'crit',
  16: 'dodge',
  64: 'block',
  524288: 'mitigation',
  2097152: 'lifesteal',
  33554432: 'reflect',
  134217728: 'critDamage',
};
const INNER_SECONDARY_EFFECTS = {
  524288: 'mitigation',
  2097152: 'lifesteal',
  8388608: 'recovery',
  33554432: 'reflect',
};
function innerSecondaryFromEffect(effect) {
  const stats = emptySecondaryStats();
  const text = String(effect?.desp || '');
  const value = Number(effect?.v) || 0;
  if (!value) return stats;
  if (text.includes('转化为气血')) stats.lifesteal += value;
  else if (text.includes('吸收') && text.includes('伤害')) stats.mitigation += value;
  else if (text.includes('反震')) stats.reflect += value;
  else if (text.includes('暴击伤害') || text.includes('爆伤')) stats.critDamage += value;
  else if (text.includes('暴击')) stats.crit += value;
  else if (text.includes('速度')) stats.speed += value;
  else if (text.includes('恢复') || text.includes('回复')) stats.recovery += value;
  else {
    const key = INNER_SECONDARY_EFFECTS[Number(effect?.t)];
    if (key) stats[key] += value;
  }
  return stats;
}
function secondaryStatsFromEquipment(item) {
  const stats = emptySecondaryStats();
  effects(item).forEach((effect) => {
    const key = EQUIPMENT_SECONDARY_EFFECTS[Number(effect.t)];
    if (key) stats[key] += Number(effect.v) || 0;
  });
  return stats;
}
function equipmentStats(item) {
  return {
    hp: Number(item?.hp_percent) || effectSum(item, 2),
    attack: Number(item?.attack_percent) || effectSum(item, 131072),
    hpFlat: Number(item?.hp_flat) || effectSum(item, 1),
    attackFlat: Number(item?.attack_flat) || 0,
    secondary: item?.source === 'white'
      ? secondaryStatsFromRecord(item)
      : secondaryStatsFromEquipment(item),
  };
}
function equipmentName(item) { return item?.nick || item?.name || '未命名装备'; }
function equipmentSummary(item) {
  const stats = equipmentStats(item);
  const parts = [];
  if (stats.hpFlat) parts.push(`${formatNumber(stats.hpFlat)}血`);
  if (stats.hp) parts.push(`${formatPercent(stats.hp)}血`);
  if (stats.attackFlat) parts.push(`${formatNumber(stats.attackFlat)}攻`);
  if (stats.attack) parts.push(`${formatPercent(stats.attack)}攻`);
  SECONDARY_STAT_DEFS.forEach((definition) => {
    const value = stats.secondary[definition.key];
    if (value) parts.push(`${formatSecondaryValue(definition.key, value)}${definition.label}`);
  });
  return parts.join(' ') || '无属性';
}
function innerLevelValue() {
  return Math.max(1, Math.min(9, Math.round(numberValue('neigong-level', 9))));
}
function innerEffectTotals(record, level) {
  const entries = Array.isArray(record?.eff) ? record.eff : effects(record);
  const limit = Math.max(0, Math.min(entries.length, Math.round(Number(level) || 0)));
  return entries.slice(0, limit).reduce((totals, effect) => {
    const type = Number(effect.t);
    if (type === 2) totals.hp += Number(effect.v || 0);
    if (type === 131072) totals.attack += Number(effect.v || 0);
    addStylePower(totals.stylePower, stylePowerFromEffect(effect));
    addSecondaryStats(totals.secondary, innerSecondaryFromEffect(effect));
    return totals;
  }, { hp: 0, attack: 0, stylePower: emptyStylePower(), secondary: emptySecondaryStats() });
}
function setInnerStatsMode(mode) {
  $('neigong-hp').dataset.mode = mode;
  $('neigong-attack').dataset.mode = mode;
}
function innerStatsMode() {
  return $('neigong-hp').dataset.mode === 'manual' ? 'manual' : 'auto';
}
function customInnerStats() {
  const secondary = emptySecondaryStats();
  SECONDARY_KEYS.forEach((key) => {
    const inputId = `neigong-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    secondary[key] = numberValue(inputId);
  });
  return {
    hp: numberValue('neigong-hp'),
    attack: numberValue('neigong-attack'),
    stylePower: emptyStylePower(),
    directHp: numberValue('neigong-hp'),
    directAttack: numberValue('neigong-attack'),
    secondary,
  };
}
function autoInnerStats(selection = getSelectedInner()) {
  if (!selection) return null;
  if (selection.source === 'custom') return customInnerStats();
  if (selection.source === 'white') {
    const item = selection.item || {};
    const secondary = secondaryStatsFromRecord(item);
    addSecondaryStats(secondary, secondaryStatsFromText(item.special));
    const stylePower = stylePowerFromText(item.special);
    return {
      hp: Number(item.hp_percent) || 0,
      attack: Number(item.attack_percent) || 0,
      stylePower,
      directHp: Number(item.hp_percent) || 0,
      directAttack: Number(item.attack_percent) || 0,
      secondary,
    };
  }
  if (selection.source !== 'game' || !selection.item) return null;
  const level = innerLevelValue();
  const direct = innerEffectTotals(selection.item, level);
  return {
    // The selected inner skill contributes its t=2/t=131072 effects here.
    // getHpFromNeiGong2 is a separate map-based path and must not use star.
    hp: direct.hp,
    attack: direct.attack,
    stylePower: direct.stylePower,
    directHp: direct.hp,
    directAttack: direct.attack,
    secondary: direct.secondary,
  };
}
function syncAutoInnerStats() {
  if (innerStatsMode() !== 'auto') return;
  const stats = autoInnerStats();
  if (!stats) return;
  $('neigong-hp').value = stats.hp;
  $('neigong-attack').value = stats.attack;
}
function renderInnerEditor() {
  const editor = $('custom-inner-editor');
  if (!editor) return;
  const isCustom = getSelectedInner()?.source === 'custom';
  editor.hidden = !isCustom;
  editor.open = isCustom;
}
function getSelectedInner() {
  const value = $('neigong-select').value;
  if (!value) return null;
  if (value === 'custom') return { source: 'custom', item: null };
  if (value.startsWith('wr:')) return { source: 'white', item: getWhiteInner(value.slice(3)) };
  if (value.startsWith('old:')) {
    const item = state.data?.neiGong?.[value.slice(4)];
    return item ? { source: 'game', item } : null;
  }
  return null;
}
function techniqueScopeStatus(technique) {
  const scope = String(technique?.scope || '');
  const personName = $('person-name').value.trim() || '自定义角色';
  const restrictedGroup = technique?.group === 'jiuyin' || technique?.group === 'wolong';
  if (restrictedGroup && personName !== '主角' && personName !== '陆仁甲') return false;
  if (personName === '陆仁甲' && technique?.name === '沧浪斩') return false;
  const style = $('person-style').value;
  if (scope.includes('学习千山寂雪')) return false;
  if (!techniqueGenderEligible(technique)) return false;
  if (!scope) return true;
  if (personName === '陆仁甲') return true;
  if (scope.includes('全队')) return true;
  const requiredStyle = ['拳主', '剑主', '刀主', '棍主'].find((item) => scope.includes(item));
  if (personName === '陆仁甲' && (scope.includes('主角') || requiredStyle)) return true;
  if (requiredStyle) return personName === '主角' && style === requiredStyle;
  if (scope.includes('主角')) return personName === '主角';
  return scope.split(/[，,、]/).map((item) => item.trim()).includes(personName);
}
function techniqueGenderEligible(technique) {
  const scope = String(technique?.scope || '');
  const gender = $('person-gender').value;
  const personName = $('person-name').value.trim() || '自定义角色';
  if (scope.includes('女号') && gender !== '女号') return false;
  if (scope.includes('男号') && gender !== '男号') return false;
  if (personName === '胡休') {
    if (technique?.name === '横练护体气功') return gender === '男号';
    if (technique?.name === '龙象护体功') return gender === '女号';
  }
  return true;
}
function techniqueAccountEligible(technique) {
  const scope = String(technique?.scope || '');
  const personName = $('person-name').value.trim() || '自定义角色';
  const restrictedGroup = technique?.group === 'jiuyin' || technique?.group === 'wolong';
  if (restrictedGroup && personName !== '主角' && personName !== '陆仁甲') return false;
  if (personName === '陆仁甲' && technique?.name === '沧浪斩') return false;
  const gender = $('person-gender').value;
  const style = $('person-style').value;
  if (scope.includes('学习千山寂雪')) return false;
  if (!techniqueGenderEligible(technique)) return false;
  if (personName === '陆仁甲') return true;
  const requiredStyle = ['拳主', '剑主', '刀主', '棍主'].find((item) => scope.includes(item));
  if (scope.includes('全队') || !scope) return true;
  if (personName === '陆仁甲' && (scope.includes('主角') || requiredStyle)) return true;
  if (requiredStyle) return personName === '主角' && (!style || requiredStyle === style);
  if (scope.includes('主角')) return personName === '主角';
  return scope.split(/[，,、]/).map((item) => item.trim()).includes(personName);
}
function techniqueStats(technique) {
  const totals = {
    hp: Number(technique?.hp_percent) || 0,
    attack: Number(technique?.attack_percent) || 0,
    recoveryBasePercent: Number(technique?.recovery_base_percent) || 0,
    stylePower: stylePowerFromText(technique?.effect),
    secondary: emptySecondaryStats(),
  };
  addSecondaryStats(totals.secondary, technique?.secondary);
  const parsedSecondary = secondaryStatsFromText(technique?.effect);
  // 玄武的“10%恢复”是基础生命转化出的回复量，不是回复百分比。
  parsedSecondary.recovery -= totals.recoveryBasePercent;
  addSecondaryStats(totals.secondary, parsedSecondary);
  return totals;
}
function techniqueStatsLabel(technique) {
  const stats = techniqueStats(technique);
  const parts = [];
  if (stats.hp) parts.push(`${formatPercent(stats.hp)}血`);
  if (stats.attack) parts.push(`${formatPercent(stats.attack)}攻`);
  if (stats.recoveryBasePercent) parts.push(`${formatPercent(stats.recoveryBasePercent)}回复量`);
  SECONDARY_STAT_DEFS.forEach((definition) => {
    const value = stats.secondary[definition.key];
    if (value) parts.push(`${formatSecondaryValue(definition.key, value)}${definition.label}`);
  });
  return parts.join(' · ') || '属性待补';
}
function selectedTechniqueIds() {
  return [...document.querySelectorAll('.technique-option:checked')].map((input) => input.value);
}
function defaultTechniqueIds() {
  const personName = $('person-name').value.trim() || '自定义角色';
  const style = $('person-style').value;
  const gender = $('person-gender').value;
  const isMain = personName === '主角';
  const isLuRenJia = personName === '陆仁甲';
  const excluded = new Set(['赌术', '任督二脉', '一苇渡江术', '洗髓伐骨']);
  return techniqueOptionEntries()
    .filter((technique) => {
      if (excluded.has(technique.name) || technique.group === 'jiuyin' || technique.group === 'wolong') return false;
      if (isLuRenJia && technique.name === '沧浪斩') return false;
      if (!techniqueAccountEligible(technique)) return false;
      const scope = String(technique.scope || '').replace(/\s/g, '');
      if (scope.includes('女号') && gender !== '女号') return false;
      if (scope.includes('男号') && gender !== '男号') return false;
      if (!scope || scope.includes('全队')) return true;
      if (personName === '胡休') {
        if (scope !== '胡休') return false;
        return (gender === '女号' && technique.name === '龙象护体功')
          || (gender === '男号' && technique.name === '横练护体气功');
      }
      if (isMain || isLuRenJia) {
        const requiredStyle = ['拳主', '剑主', '刀主', '棍主'].find((item) => scope.includes(item));
        if (requiredStyle) return isLuRenJia || style === requiredStyle;
        return scope.includes('主角');
      }
      return false;
    })
    .map((technique) => String(technique.id));
}
function setTechniqueSelections(ids, { customized = techniqueSelectionCustomized } = {}) {
  techniqueSelectionCustomized = customized;
  const selected = new Set((ids || []).map((id) => String(id)));
  document.querySelectorAll('.technique-option').forEach((input) => {
    input.checked = selected.has(input.value);
  });
  refreshTechniqueAvailability();
}
function selectedTechniques() {
  return selectedTechniqueIds().map(getWhiteTechnique).filter(Boolean);
}
function techniqueTotals() {
  const totals = { hp: 0, attack: 0, recoveryBasePercent: 0, stylePower: emptyStylePower(), secondary: emptySecondaryStats(), applied: [], skipped: [] };
  selectedTechniques().forEach((technique) => {
    if (!techniqueScopeStatus(technique)) {
      totals.skipped.push(technique.name);
      return;
    }
    const stats = techniqueStats(technique);
    totals.hp += stats.hp;
    totals.attack += stats.attack;
    totals.recoveryBasePercent += stats.recoveryBasePercent;
    addStylePower(totals.stylePower, stats.stylePower);
    addSecondaryStats(totals.secondary, stats.secondary);
    totals.applied.push(technique.name);
  });
  return totals;
}
function setTechniqueStatsMode(mode) {
  $('technique-hp').dataset.mode = mode;
  $('technique-attack').dataset.mode = mode;
}
function techniqueStatsMode() {
  return $('technique-hp').dataset.mode === 'auto' ? 'auto' : 'manual';
}
function syncTechniqueStats() {
  renderTechniqueScope();
}
function renderTechniqueScope() {
  const selected = selectedTechniques();
  const summary = $('technique-summary');
  if (!selected.length) {
    $('technique-scope').textContent = '未选择技艺 · 普通技艺可多选';
    if (summary) summary.textContent = '未选择';
    return;
  }
  const applied = selected.filter(techniqueScopeStatus).length;
  const skipped = selected.length - applied;
  $('technique-scope').textContent = `已选 ${selected.length} 项 · 当前角色生效 ${applied} 项${skipped ? ` · 不适用 ${skipped} 项` : ''}`;
  if (summary) summary.textContent = `${applied}/${selected.length} 生效`;
}
function applyDefaultTechniqueSelections() {
  if (techniqueSelectionCustomized) return;
  setTechniqueSelections(defaultTechniqueIds(), { customized: false });
  renderTechniqueScope();
}
function refreshTechniqueAvailability() {
  document.querySelectorAll('.technique-option').forEach((input) => {
    const technique = getWhiteTechnique(input.value);
    const eligible = techniqueAccountEligible(technique);
    input.disabled = !eligible;
    input.closest('.technique-choice')?.classList.toggle('is-unavailable', !eligible);
    if (!eligible) input.checked = false;
  });
}
function populateTechniques() {
  const container = $('technique-options');
  container.replaceChildren();
  const groups = new Map();
  techniqueOptionEntries().forEach((technique) => {
    const group = technique.group || 'normal';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(technique);
  });
  const groupLabels = {
    normal: '普通技艺（可多选）',
    profession: '职业技艺（四选一）',
    jiuyin: '九阴奇功（七选一）',
    wolong: '卧龙心决（三选一）',
  };
  ['normal', 'profession', 'jiuyin', 'wolong'].forEach((group) => {
    const items = groups.get(group) || [];
    if (!items.length) return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = `technique-group technique-group-${group}`;
    const legend = document.createElement('legend');
    legend.textContent = groupLabels[group] || items[0].group_label || group;
    fieldset.appendChild(legend);
    const grid = document.createElement('div');
    grid.className = 'technique-choice-grid';
    items.forEach((technique) => {
      const label = document.createElement('label');
      label.className = 'technique-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'technique-option';
      input.value = technique.id;
      input.dataset.exclusiveGroup = group === 'normal' ? '' : group;
      const title = document.createElement('span');
      title.className = 'technique-choice-name';
      title.textContent = technique.name;
      const stats = document.createElement('small');
      stats.textContent = `${techniqueStatsLabel(technique)} · ${technique.scope || '全队'}`;
      label.append(input, title, stats);
      grid.appendChild(label);
    });
    fieldset.appendChild(grid);
    container.appendChild(fieldset);
  });
  setTechniqueSelections(defaultTechniqueIds(), { customized: false });
  setTechniqueStatsMode('manual');
  renderTechniqueScope();
}
function applyTechniqueSelection() {
  renderTechniqueScope();
  calculate();
}
function equipmentSlotActive(slot) {
  return Boolean(slot?.id || String(slot?.name || '').trim() || Number(slot?.hp) || Number(slot?.attack));
}
function customEquipmentId(slotIndex) { return `custom-equipment:${slotIndex}`; }
function isCustomEquipmentId(id) { return String(id || '').startsWith('custom-equipment:'); }
function normalizeCustomEquipment(value, id) {
  return {
    id: String(id),
    name: String(value?.name || ''),
    hp: Number(value?.hp) || 0,
    attack: Number(value?.attack) || 0,
    hpFlat: Number(value?.hpFlat) || 0,
    attackFlat: Number(value?.attackFlat) || 0,
    secondary: { ...emptySecondaryStats(), ...(value?.secondary || {}) },
    extra: String(value?.extra || ''),
  };
}
function weaponActive() {
  return Boolean(String(state.weaponName || '').trim() || state.weaponAffixes.some((affix) => Number(affix.value)));
}
function populateWeaponAffixes() {
  document.querySelectorAll('.weapon-affix-key').forEach((select) => {
    select.innerHTML = '<option value="">选择属性</option>';
    WEAPON_ATTRIBUTE_OPTIONS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      select.appendChild(option);
    });
  });
  renderWeaponAffixes();
}
function renderWeaponAffixes() {
  $('weapon-name').value = state.weaponName || '';
  state.weaponAffixes.forEach((affix, index) => {
    $(`weapon-affix-key-${index}`).value = affix.key || '';
    $(`weapon-affix-mode-${index}`).value = affix.mode || 'flat';
    $(`weapon-affix-value-${index}`).value = affix.value || 0;
  });
  updateWeaponSummary();
}
function updateWeaponSummary() {
  const summary = $('weapon-summary');
  if (!summary) return;
  const affixCount = state.weaponAffixes.filter((affix) => affix.key && Number(affix.value)).length;
  const weaponName = String(state.weaponName || '').trim();
  summary.textContent = weaponActive()
    ? `${weaponName || '已配置'}${affixCount ? ` · ${affixCount} 个词条` : ''}`
    : '未设置';
}
function setError(message) {
  $('error-message').textContent = message;
  $('error-message').hidden = !message;
}
function setSaveStatus(message) { $('save-status').textContent = message; }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const selectProxyInstances = new Set();
let selectProxyDocumentEventsBound = false;

function pruneSelectProxies() {
  selectProxyInstances.forEach((select) => {
    if (select.isConnected) return;
    select._selectProxy?.observer?.disconnect();
    selectProxyInstances.delete(select);
  });
}
function selectedOptionText(select) {
  return select.selectedOptions?.[0]?.textContent?.trim() || '请选择';
}
function closeSelectProxies(except = null) {
  selectProxyInstances.forEach((select) => {
    const proxy = select._selectProxy;
    if (proxy && proxy !== except) proxy.wrapper.classList.remove('is-open');
  });
}
function syncSelectProxy(select, rebuild = false) {
  const proxy = selectProxyInstances.has(select) ? select._selectProxy : null;
  if (!proxy) return;
  proxy.label.textContent = selectedOptionText(select);
  proxy.trigger.disabled = select.disabled;
  proxy.wrapper.classList.toggle('is-disabled', select.disabled);
  proxy.trigger.setAttribute('aria-expanded', String(proxy.wrapper.classList.contains('is-open')));
  if (!rebuild) return;
  proxy.list.replaceChildren();
  [...select.children].forEach((child) => {
    if (child.tagName === 'OPTGROUP') {
      const groupLabel = document.createElement('div');
      groupLabel.className = 'select-proxy-group';
      groupLabel.textContent = child.label;
      proxy.list.appendChild(groupLabel);
      [...child.children].forEach((option) => appendSelectProxyOption(select, proxy, option));
    } else if (child.tagName === 'OPTION') {
      appendSelectProxyOption(select, proxy, child);
    }
  });
}
function appendSelectProxyOption(select, proxy, option) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select-proxy-option';
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(select.value === option.value));
  button.disabled = option.disabled;
  button.textContent = option.textContent || '未命名选项';
  if (select.value === option.value) button.classList.add('is-selected');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    if (option.disabled) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelectProxies();
    syncSelectProxy(select);
  });
  proxy.list.appendChild(button);
}
function enhanceSelect(select) {
  if (!select || selectProxyInstances.has(select)) return;
  const wrapper = document.createElement('div');
  wrapper.className = `select-proxy${select.classList.contains('compact-picker') ? ' compact-picker-proxy' : ''}`;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-proxy-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.className = 'select-proxy-label';
  trigger.appendChild(label);
  const list = document.createElement('div');
  list.className = 'select-proxy-list';
  list.setAttribute('role', 'listbox');
  wrapper.appendChild(trigger);
  wrapper.appendChild(list);
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add('native-select-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const proxy = { wrapper, trigger, label, list };
  select._selectProxy = proxy;
  selectProxyInstances.add(select);
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    if (select.disabled) return;
    const isOpen = wrapper.classList.contains('is-open');
    closeSelectProxies(proxy);
    wrapper.classList.toggle('is-open', !isOpen);
    syncSelectProxy(select);
  });
  select.addEventListener('change', () => {
    syncSelectProxy(select);
    wrapper.classList.remove('is-open');
  });
  const observer = new MutationObserver(() => syncSelectProxy(select, true));
  observer.observe(select, { childList: true, subtree: true, attributes: true });
  proxy.observer = observer;
  syncSelectProxy(select, true);
}
function enhanceSelects(root = document) {
  pruneSelectProxies();
  root.querySelectorAll('select').forEach(enhanceSelect);
  if (!selectProxyDocumentEventsBound) {
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.select-proxy')) closeSelectProxies();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSelectProxies();
    });
    selectProxyDocumentEventsBound = true;
  }
}
function refreshSelectProxies() {
  pruneSelectProxies();
  selectProxyInstances.forEach((select) => syncSelectProxy(select));
}

function currentConfig() {
  return {
    personName: $('person-name').value,
    personStyle: $('person-style').value,
    personGender: $('person-gender').value,
    level: $('level-input').value,
    hpFactor: $('hp-factor').value,
    powerFactor: $('power-factor').value,
    baseSpeed: $('base-speed').value,
    baseSpeedRoleDefaultsVersion: BASE_SPEED_DEFAULTS_VERSION,
    baseCritDefaultsVersion: BASE_CRIT_DEFAULTS_VERSION,
    characterBaseDefaultsVersion: CHARACTER_BASE_DEFAULTS_VERSION,
    speedPillsDefaultVersion: 1,
    baseCrit: $('base-crit').value,
    baseDodge: $('base-dodge').value,
    baseLifesteal: $('base-lifesteal').value,
    baseCritDamage: $('base-crit-damage').value,
    baseMitigation: $('base-mitigation').value,
    baseBlock: $('base-block').value,
    baseReflect: $('base-reflect').value,
    baseRecovery: $('base-recovery').value,
    achievementHp: $('achievement-hp').value,
    achievementAttack: $('achievement-attack').value,
    attackPillCount: $('attack-pill-count').value,
    smallRenAttackPercent: $('small-ren-attack-percent').value,
    largeRenAttackCount: $('large-ren-attack-count').value,
    learnedSMartialCount: $('learned-s-martial-count').value,
    martialBonusPercent: $('martial-bonus-percent').value,
    equipmentSlots: state.equipmentSlots.map((slot) => ({
      ...slot,
      secondary: { ...slot.secondary },
    })),
    weaponName: $('weapon-name').value,
    weaponAffixes: state.weaponAffixes.map((affix) => ({ ...affix })),
    martialId: $('martial-select').value,
    speedPillsEnabled: $('speed-pills-enabled').checked,
    neigongId: $('neigong-select').value,
    neigongLevel: $('neigong-level').value,
    neigongHp: $('neigong-hp').value,
    neigongAttack: $('neigong-attack').value,
    neigongSpeed: $('neigong-speed').value,
    neigongMitigation: $('neigong-mitigation').value,
    neigongCrit: $('neigong-crit').value,
    neigongDodge: $('neigong-dodge').value,
    neigongLifesteal: $('neigong-lifesteal').value,
    neigongCritDamage: $('neigong-crit-damage').value,
    neigongBlock: $('neigong-block').value,
    neigongReflect: $('neigong-reflect').value,
    neigongRecovery: $('neigong-recovery').value,
    neigongStatsMode: innerStatsMode(),
    techniqueIds: selectedTechniqueIds(),
    techniqueSelectionConfigured: true,
    techniqueSelectionCustomized,
    techniqueHp: $('technique-hp').value,
    techniqueAttack: $('technique-attack').value,
    techniqueStatsMode: techniqueStatsMode(),
    formationId: $('formation-select').value,
    formationPosition: $('formation-position').value,
    pillsEnabled: $('pills-enabled').checked,
    attackPillsEnabled: $('attack-pills-enabled').checked,
    pillsRange: 30,
    smallRenEnabled: $('small-ren-enabled').checked,
    largeRenEnabled: $('large-ren-enabled').checked,
  };
}

function saveConfig() {
  const config = {
    ...currentConfig(),
    comparisonSnapshots,
    comparisonPair,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaveStatus('已自动保存到本机');
  } catch (error) {
    setSaveStatus('本机保存不可用');
  }
}

function isBuiltInExampleConfig(config) {
  const slots = Array.isArray(config?.equipmentSlots) ? config.equipmentSlots : [];
  const emptyEquipment = slots.length === 4 && slots.every((slot) => (
    !slot?.id && !String(slot?.name || '').trim()
    && Number(slot?.hp || 0) === 0 && Number(slot?.attack || 0) === 0
  ));
  return config?.personName === '主角'
    && String(config?.level) === '90'
    && String(config?.hpFactor) === '1'
    && String(config?.powerFactor) === '1'
    && emptyEquipment
    && !config?.whiteRabbitCharacter
    && config?.neigongId === 'old:3824'
    && String(config?.neigongLevel) === '9'
    && (config?.neigongStatsMode === 'auto' || config?.neigongStatsMode === 'manual')
    && String(config?.neigongHp) === '10'
    && String(config?.neigongAttack) === '10'
    && !String(config?.neigongExtra || '').trim()
    && !(Array.isArray(config?.techniqueIds) && config.techniqueIds.length)
    && !config?.techniqueId
    && String(config?.techniqueHp) === '5'
    && String(config?.techniqueAttack) === '3'
    && config?.pillsEnabled === true
    && String(config?.pillsRange) === '30';
}

function makeBlankConfig(config) {
  return {
    ...config,
    baseSpeed: '0',
    neigongId: '',
    neigongName: '',
    neigongHp: '0',
    neigongAttack: '0',
    neigongStatsMode: 'auto',
    techniqueIds: [],
    techniqueHp: '0',
    techniqueAttack: '0',
    techniqueStatsMode: 'manual',
    pillsEnabled: true,
    pillsRange: '30',
    speedPillsEnabled: false,
    smallRenEnabled: true,
    largeRenEnabled: true,
  };
}

function normalizeEquipment(value) {
  if (value && typeof value === 'object') {
    const rawId = value.id;
    const hasId = rawId !== null && rawId !== undefined && String(rawId) !== '';
    if (hasId) {
      if (isCustomEquipmentId(rawId)) return normalizeCustomEquipment(value, rawId);
      const rawItem = getEquipment(rawId);
      const item = rawItem?.source === 'white'
        ? rawItem
        : findWhiteEquipmentByName(value.name || equipmentName(rawItem));
      if (!item) return EMPTY_EQUIPMENT();
      const stats = equipmentStats(item);
      return {
        id: item.id,
        name: String(value.name || equipmentName(item)),
        hp: value.hp !== undefined ? numberValueFrom(value.hp) : stats.hp,
        attack: value.attack !== undefined ? numberValueFrom(value.attack) : stats.attack,
        hpFlat: value.hpFlat !== undefined ? numberValueFrom(value.hpFlat) : stats.hpFlat,
        attackFlat: value.attackFlat !== undefined ? numberValueFrom(value.attackFlat) : stats.attackFlat,
        secondary: value.secondary || stats.secondary,
        extra: String(value.extra || ''),
      };
    }
    return {
      id: null,
      name: String(value.name || ''),
      hp: Number(value.hp) || 0,
      attack: Number(value.attack) || 0,
      hpFlat: Number(value.hpFlat) || 0,
      attackFlat: Number(value.attackFlat) || 0,
      secondary: value.secondary || emptySecondaryStats(),
      extra: String(value.extra || ''),
    };
  }
  const rawItem = getEquipment(value);
  const item = rawItem?.source === 'white'
    ? rawItem
    : findWhiteEquipmentByName(equipmentName(rawItem));
  if (!item) return EMPTY_EQUIPMENT();
  const stats = equipmentStats(item);
  return {
    id: item.id,
    name: equipmentName(item),
    hp: stats.hp,
    attack: stats.attack,
    hpFlat: stats.hpFlat,
    attackFlat: stats.attackFlat,
    secondary: stats.secondary,
    extra: '',
  };
}

function isOldSampleEquipment(slots) {
  return slots.length === 4
    && slots[0]?.id === 5416
    && Number(slots[0]?.hp) === 12
    && Number(slots[0]?.attack) === 12
    && slots.slice(1).every((slot) => !equipmentSlotActive(slot));
}

function normalizeComparisonSnapshots(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_COMPARISON_SNAPSHOTS).map((snapshot) => {
    const roleName = String(snapshot?.roleName || '自定义角色');
    const level = Number(snapshot?.level) || 1;
    const hasStats = Boolean(snapshot?.stats && typeof snapshot.stats === 'object'
      && SECONDARY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(snapshot.stats, key)));
    return {
      hp: Number(snapshot?.hp) || 0,
      attack: Number(snapshot?.attack) || 0,
      roleName,
      level,
      config: snapshot?.config && typeof snapshot.config === 'object' ? snapshot.config : null,
      stats: Object.fromEntries(SECONDARY_KEYS.map((key) => [
        key,
        hasStats ? (Number(snapshot.stats[key]) || 0) : null,
      ])),
      statsAvailable: hasStats,
      label: roleName,
    };
  });
}

function normalizeComparisonPair(value, snapshotCount = comparisonSnapshots.length) {
  if (snapshotCount < 2) return [0, 1];
  const savedPair = Array.isArray(value) ? value : [0, 1];
  const clampIndex = (candidate, fallback) => {
    const index = Number(candidate);
    return Number.isInteger(index) && index >= 0 && index < snapshotCount ? index : fallback;
  };
  const left = clampIndex(savedPair[0], 0);
  let right = clampIndex(savedPair[1], left === 0 ? 1 : 0);
  if (left === right) right = left === 0 ? 1 : 0;
  return [left, right];
}

function restoreConfig(sourceConfig = null) {
  let config;
  let storedKey;
  if (sourceConfig && typeof sourceConfig === 'object') {
    config = sourceConfig;
    storedKey = STORAGE_KEY;
  } else {
    try {
      storedKey = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]
        .find((key) => window.localStorage.getItem(key));
      const raw = storedKey ? window.localStorage.getItem(storedKey) : null;
      if (!raw) { setSaveStatus('首次使用，修改后自动保存'); return; }
      config = JSON.parse(raw);
    } catch (error) {
      setSaveStatus('保存数据无法读取');
      return;
    }
  }
  if (!config || typeof config !== 'object') return;
  if (config.baseSpeedRoleDefaultsVersion !== BASE_SPEED_DEFAULTS_VERSION
    && Number(config.baseSpeed) === 10) {
    config.baseSpeed = '0';
  }
  if (config.speedPillsDefaultVersion !== 1) config.speedPillsEnabled = true;
  if (storedKey !== STORAGE_KEY) {
    if (Number(config.baseCrit) === 1) config.baseCrit = '0';
    if (Number(config.baseDodge) === 1) config.baseDodge = '0';
    if (Number(config.baseLifesteal) === 1) config.baseLifesteal = '0';
    if (Number(config.baseCritDamage) === 200) config.baseCritDamage = '0';
  }
  if (config.baseCritDefaultsVersion !== BASE_CRIT_DEFAULTS_VERSION
    && (config.baseCrit === undefined || Number(config.baseCrit) === 0)) {
    config.baseCrit = '10';
  }
  if (storedKey !== STORAGE_KEY && Number(config.baseSpeed) === 64) config.baseSpeed = '0';
  if (isBuiltInExampleConfig(config)) config = makeBlankConfig(config);
  if (typeof config.personName === 'string') {
    const select = $('person-name');
    const personName = config.personName || '自定义角色';
    if (![...select.options].some((option) => option.value === personName)) {
      const option = document.createElement('option');
      option.value = personName;
      option.textContent = personName;
      select.appendChild(option);
    }
    select.value = personName;
    // A saved profile without explicit coefficients should still inherit its
    // character defaults before the remaining saved fields are restored.
    applyCharacterDefaults();
  }
  if (config.characterBaseDefaultsVersion !== CHARACTER_BASE_DEFAULTS_VERSION) {
    const profile = getCharacterProfile();
    const baseStats = { ...DEFAULT_CHARACTER_BASE_STATS, ...(profile?.base_stats || {}) };
    const configKeys = Object.fromEntries(Object.entries(CHARACTER_BASE_STAT_FIELDS).map(([key]) => [
      key,
      key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    ]));
    Object.entries(configKeys).forEach(([key, suffix]) => {
      const configKey = `base${suffix.split('-').map((part, index) => index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
      if (config[configKey] === undefined || Number(config[configKey]) === DEFAULT_CHARACTER_BASE_STATS[key]) {
        config[configKey] = baseStats[key];
      }
    });
    config.characterBaseDefaultsVersion = CHARACTER_BASE_DEFAULTS_VERSION;
  }
  const fieldMap = {
    personStyle: 'person-style', personGender: 'person-gender',
    level: 'level-input', hpFactor: 'hp-factor', powerFactor: 'power-factor',
    baseSpeed: 'base-speed', baseCrit: 'base-crit', baseDodge: 'base-dodge',
    baseLifesteal: 'base-lifesteal', baseCritDamage: 'base-crit-damage',
    baseMitigation: 'base-mitigation', baseBlock: 'base-block',
    baseReflect: 'base-reflect', baseRecovery: 'base-recovery',
    achievementHp: 'achievement-hp', achievementAttack: 'achievement-attack',
    neigongLevel: 'neigong-level', neigongHp: 'neigong-hp', neigongAttack: 'neigong-attack',
    neigongSpeed: 'neigong-speed', neigongMitigation: 'neigong-mitigation',
    neigongCrit: 'neigong-crit', neigongDodge: 'neigong-dodge',
    neigongLifesteal: 'neigong-lifesteal', neigongCritDamage: 'neigong-crit-damage',
    neigongBlock: 'neigong-block', neigongReflect: 'neigong-reflect', neigongRecovery: 'neigong-recovery',
    techniqueHp: 'technique-hp', techniqueAttack: 'technique-attack',
    attackPillCount: 'attack-pill-count', smallRenAttackPercent: 'small-ren-attack-percent',
    largeRenAttackCount: 'large-ren-attack-count',
    learnedSMartialCount: 'learned-s-martial-count',
    martialBonusPercent: 'martial-bonus-percent',
    formationPosition: 'formation-position',
  };
  Object.entries(fieldMap).forEach(([key, id]) => { if (config[key] !== undefined) $(id).value = config[key]; });
  applyCharacterDefaults({ resetBaseStats: false });
  populateMartialArts();
  if (typeof config.pillsEnabled === 'boolean') $('pills-enabled').checked = config.pillsEnabled;
  if (typeof config.attackPillsEnabled === 'boolean') $('attack-pills-enabled').checked = config.attackPillsEnabled;
  if (typeof config.speedPillsEnabled === 'boolean') $('speed-pills-enabled').checked = config.speedPillsEnabled;
  if (typeof config.smallRenEnabled === 'boolean') $('small-ren-enabled').checked = config.smallRenEnabled;
  if (typeof config.largeRenEnabled === 'boolean') $('large-ren-enabled').checked = config.largeRenEnabled;
  if (config.formationId !== undefined) $('formation-select').value = String(config.formationId);
  comparisonSnapshots = normalizeComparisonSnapshots(config.comparisonSnapshots);
  comparisonPair = normalizeComparisonPair(config.comparisonPair);
  if (Array.isArray(config.equipmentSlots)) {
    state.equipmentSlots = config.equipmentSlots.slice(0, 4).map(normalizeEquipment);
    while (state.equipmentSlots.length < 4) state.equipmentSlots.push(EMPTY_EQUIPMENT());
    if (isOldSampleEquipment(state.equipmentSlots)) {
      state.equipmentSlots = [EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT()];
    }
  }
  if (config.weaponName !== undefined) $('weapon-name').value = String(config.weaponName);
  if (Array.isArray(config.weaponAffixes)) {
    state.weaponAffixes = config.weaponAffixes.slice(0, 3).map((affix) => ({
      key: WEAPON_ATTRIBUTE_OPTIONS.some((item) => item.key === affix?.key) ? affix.key : '',
      mode: affix?.mode === 'percent' ? 'percent' : 'flat',
      value: Number(affix?.value) || 0,
    }));
    while (state.weaponAffixes.length < 3) state.weaponAffixes.push(EMPTY_WEAPON_AFFIX());
  }
  if (config.martialId !== undefined) {
    const value = String(config.martialId);
    if (value.startsWith('wr-skill:')) {
      $('martial-select').value = value;
    } else if (value.startsWith('old-skill:')) {
      const item = state.data?.skill?.[value.slice(10)];
      const index = findWhiteMartialIndexByName(item?.nick || item?.name);
      $('martial-select').value = index >= 0 ? `wr-skill:${index}` : '';
    } else {
      $('martial-select').value = '';
    }
  }
  if (config.neigongId !== undefined) {
    const value = String(config.neigongId);
    if (value === '' || value.startsWith('wr:')) {
      $('neigong-select').value = value;
    } else {
      const item = state.data?.neiGong?.[value.replace(/^old:/, '')];
      const index = findWhiteInnerIndexByName(item?.nick || item?.name);
      $('neigong-select').value = index >= 0 ? `wr:${index}` : '';
    }
  }
  let techniqueIds = Array.isArray(config.techniqueIds) ? config.techniqueIds : [];
  const legacyTechniqueSelection = !Array.isArray(config.techniqueIds)
    && config.techniqueId !== undefined && String(config.techniqueId) !== '';
  if (!techniqueIds.length && legacyTechniqueSelection) {
    const oldId = String(config.techniqueId);
    const oldTechnique = state.whiteRabbit?.techniques?.[Number(oldId)];
    techniqueIds = oldTechnique?.group === 'wolong' ? [`wolong:${oldId}:0`] : [oldId];
  }
  if (legacyTechniqueSelection) {
    $('technique-hp').value = 0;
    $('technique-attack').value = 0;
  }
  if (typeof config.largeRenEnabled !== 'boolean') {
    techniqueIds = techniqueIds.filter((id) => String(id) !== '25');
  }
  const hasSavedTechniqueSelection = config.techniqueSelectionCustomized === true
    && (config.techniqueSelectionConfigured === true || techniqueIds.length > 0 || legacyTechniqueSelection);
  setTechniqueSelections(
    hasSavedTechniqueSelection ? techniqueIds : defaultTechniqueIds(),
    { customized: hasSavedTechniqueSelection },
  );
  setTechniqueStatsMode(config.techniqueStatsMode === 'auto' ? 'auto' : 'manual');
  renderFormationControls();
  renderTechniqueScope();
  setInnerStatsMode(config.neigongStatsMode === 'manual' && getSelectedInner()?.source === 'custom' ? 'manual' : 'auto');
  renderInnerEditor();
  renderComparison();
  setSaveStatus('已加载本机配置');
}

function populateNeigong() {
  const select = $('neigong-select');
  select.innerHTML = '<option value="">无内功（0%）</option><option value="custom">自定义内功</option>';
  if (state.whiteRabbit?.inner_skills?.length) {
    const whiteGroup = document.createElement('optgroup');
    whiteGroup.label = '白兔内功';
    state.whiteRabbit.inner_skills.forEach((skill, index) => {
      if (!String(skill.rank || '').trim()) return;
      const option = document.createElement('option');
      option.value = `wr:${index}`;
      const stats = autoInnerStats({ source: 'white', item: skill });
      const summary = innerStatsSummary(stats);
      option.textContent = `${skill.name} · ${skill.rank}${summary ? ` · ${summary}` : ''}`;
      whiteGroup.appendChild(option);
    });
    select.appendChild(whiteGroup);
  }
  select.value = '';
  select.disabled = false;
}

function populateMartialArts() {
  const select = $('martial-select');
  const previousValue = select.value;
  select.innerHTML = '<option value="">无武学（+0速度）</option>';
  const white = (state.whiteRabbit?.martial_arts || [])
    .map((skill, index) => ({ skill, index }))
    .filter(({ skill }) => String(skill.rank || '').trim()
      && Number.isFinite(Number(skill.speed))
      && martialStyleEligible(skill));
  if (white.length) {
    const groups = new Map();
    white.forEach(({ skill, index }) => {
      const style = martialStyle(skill) || '其他';
      if (!groups.has(style)) groups.set(style, []);
      groups.get(style).push({ skill, index });
    });
    groups.forEach((items, style) => {
      const group = document.createElement('optgroup');
      group.label = `白兔${style}武学`;
      items.forEach(({ skill, index }) => {
        const option = document.createElement('option');
        option.value = `wr-skill:${index}`;
        option.textContent = `${skill.name || '未命名武学'} · ${skill.rank} · 威力 ${Number(skill.power) || 0} · 速度 ${Number(skill.speed)}`;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  }
  const availableValues = new Set([...select.options].map((option) => option.value));
  select.value = availableValues.has(previousValue) ? previousValue : '';
  select.disabled = false;
}

function filteredEquipment() {
  const white = state.whiteRabbit?.equipment || [];
  return white.filter((item) => !isWeapon(item) && isSEquipment(item));
}
function equipmentCategory(item) {
  if (item?.source === 'white') {
    const match = /^wr-eq-(\d+)$/.exec(String(item.id));
    if (!match) return '';
    const index = Number(match[1]);
    if (index < 10) return 'armor';
    if (index < 20) return 'ring';
    return 'wrist';
  }
  return ({ 5: 'armor', 6: 'ring', 7: 'wrist' })[Number(item?.type)] || '';
}
function equipmentCategoryForSlot(slotIndex) {
  return ({ 1: 'armor', 2: 'ring', 3: 'wrist' })[slotIndex] || '';
}
function filteredEquipmentForSlot(slotIndex) {
  const category = equipmentCategoryForSlot(slotIndex);
  return filteredEquipment().filter((item) => equipmentCategory(item) === category);
}
function renderCustomEquipmentEditor(slotIndex, slot) {
  const editor = $(`custom-equipment-editor-${slotIndex}`);
  if (!editor) return;
  const active = isCustomEquipmentId(slot?.id) && String(slot.id) === customEquipmentId(slotIndex);
  editor.hidden = !active;
  if (!active) {
    editor.innerHTML = '';
    return;
  }
  const basicFields = [
    { key: 'name', label: '名称', type: 'text', value: slot.name, inputmode: 'text' },
    { key: 'hp', label: '生命 %', step: '0.1', value: slot.hp, inputmode: 'decimal' },
    { key: 'attack', label: '攻击 %', step: '0.1', value: slot.attack, inputmode: 'decimal' },
    { key: 'hpFlat', label: '固定生命', step: '1', value: slot.hpFlat, inputmode: 'numeric' },
    { key: 'attackFlat', label: '固定攻击', step: '1', value: slot.attackFlat, inputmode: 'numeric' },
  ];
  const renderField = (field) => `<label class="field${field.type === 'text' ? ' field-wide' : ''}"><span>${field.label}</span><input type="${field.type || 'number'}" ${field.type === 'text' ? '' : 'min="-100"'} step="${field.step || '0.1'}" value="${escapeHtml(field.value)}" inputmode="${field.inputmode}" data-custom-equipment-slot="${slotIndex}" data-custom-equipment-field="${field.key}"></label>`;
  const secondaryFields = SECONDARY_STAT_DEFS.map((definition) => {
    const isNumber = definition.format === 'number';
    const value = slot.secondary?.[definition.key] || 0;
    return `<label class="field"><span>${definition.label}${isNumber ? '' : ' %'}</span><input type="number" min="-100" step="${isNumber ? '1' : '0.1'}" value="${value}" inputmode="${isNumber ? 'numeric' : 'decimal'}" data-custom-equipment-slot="${slotIndex}" data-custom-equipment-secondary="${definition.key}"></label>`;
  }).join('');
  editor.innerHTML = `
    <div class="custom-equipment-heading"><strong>自定义装备属性</strong><span>只对当前部位生效</span></div>
    <div class="custom-equipment-grid">${basicFields.map(renderField).join('')}</div>
    <details class="custom-equipment-more"><summary>其他面板属性</summary><div class="custom-equipment-grid">${secondaryFields}</div></details>`;
}
function renderEquipmentSlots() {
  state.equipmentSlots = state.equipmentSlots.map((slot) => (
    slot?.id && !isCustomEquipmentId(slot.id) && !getEquipment(slot.id) ? EMPTY_EQUIPMENT() : slot
  ));
  state.equipmentSlots.slice(1, 4).forEach((rawSlot, visibleIndex) => {
    const slotIndex = visibleIndex + 1;
    const category = equipmentCategoryForSlot(slotIndex);
    const customId = customEquipmentId(slotIndex);
    const currentItem = rawSlot?.id && !isCustomEquipmentId(rawSlot.id) ? getEquipment(rawSlot.id) : null;
    const current = String(rawSlot?.id) === customId
      ? normalizeCustomEquipment(rawSlot, customId)
      : currentItem && equipmentCategory(currentItem) === category ? rawSlot : EMPTY_EQUIPMENT();
    state.equipmentSlots[slotIndex] = current;
    const select = $(`equipment-slot-${slotIndex}`);
    const visibleItems = filteredEquipmentForSlot(slotIndex);
    if (current.id && !visibleItems.some((item) => String(item.id) === String(current.id))) {
      const currentItem = getEquipment(current.id);
      if (currentItem) visibleItems.unshift(currentItem);
    }
    select.innerHTML = '<option value="">未选择</option>';
    visibleItems.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      const source = item.source === 'white' ? '白兔' : '原版';
      const unique = item.unique ? ' · 唯一' : '';
      option.textContent = `${equipmentName(item)} · ${source}${unique} · ${equipmentSummary(item)}`;
      option.title = item.access ? `获取：${item.access} · 生效：${item.scope || '佩戴者'}` : '';
      select.appendChild(option);
    });
    const customOption = document.createElement('option');
    customOption.value = customId;
    customOption.textContent = '自定义装备';
    select.appendChild(customOption);
    select.value = current.id ? String(current.id) : '';
    renderCustomEquipmentEditor(slotIndex, current);
  });
  const selectedCount = state.equipmentSlots.slice(1).filter(equipmentSlotActive).length + (weaponActive() ? 1 : 0);
  $('equipment-count').textContent = `已装备 ${selectedCount}/4`;
  const hp = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.hp || 0), 0);
  const attack = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.attack || 0), 0);
  const hpFlat = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.hpFlat || 0), 0);
  const attackFlat = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.attackFlat || 0), 0);
  $('equipment-breakdown').textContent = `装备生命 +${formatPercent(hp)}${hpFlat ? ` · 固定 +${formatNumber(hpFlat)}` : ''} · 装备攻击 +${formatPercent(attack)}${attackFlat ? ` · 固定 +${formatNumber(attackFlat)}` : ''}`;
}

function applyInnerSelection() {
  const selection = getSelectedInner();
  renderInnerEditor();
  if (!selection) {
    setInnerStatsMode('auto');
    INNER_MANUAL_FIELD_IDS.forEach((id) => { $(id).value = 0; });
  } else if (selection.source === 'white') {
    setInnerStatsMode('auto');
    syncAutoInnerStats();
  } else if (selection.source === 'game') {
    setInnerStatsMode('auto');
    syncAutoInnerStats();
  } else {
    setInnerStatsMode('manual');
  }
  calculate();
}
function populateFormationControls() {
  const formationSelect = $('formation-select');
  formationSelect.innerHTML = '';
  FORMATION_OPTIONS.forEach((formation) => {
    const option = document.createElement('option');
    option.value = formation.key;
    option.textContent = formation.label;
    formationSelect.appendChild(option);
  });
  const positionSelect = $('formation-position');
  positionSelect.innerHTML = '';
  FORMATION_POSITION_OPTIONS.forEach((position) => {
    const option = document.createElement('option');
    option.value = position.key;
    option.textContent = position.label;
    positionSelect.appendChild(option);
  });
  formationSelect.value = '';
  positionSelect.value = '1';
  renderFormationControls();
}
function renderFormationControls() {
  const formation = $('formation-select').value;
  const isMain = ($('person-name').value.trim() || '自定义角色') === '主角';
  const positionSelect = $('formation-position');
  positionSelect.value = isMain ? '1' : (positionSelect.value || '1');
  positionSelect.disabled = !formation || isMain;
  $('formation-position-field').classList.toggle('is-muted', !formation || isMain);
  $('formation-hint').textContent = !formation
    ? '当前不计入阵法'
    : isMain
      ? `${formation === 'jiugong' ? '九宫八卦阵' : '八枢汇极阵'} · 主角自动使用 1 号位`
      : `${formation === 'jiugong' ? '九宫八卦阵' : '八枢汇极阵'} · 当前选择 ${positionSelect.value} 号位`;
}
function populate() {
  populateCharacterPresets();
  populateNeigong();
  populateMartialArts();
  populateTechniques();
  populateFormationControls();
  populateWeaponAffixes();
  renderEquipmentSlots();
}

function weaponAffixTotals() {
  const totals = {
    hpFlat: 0,
    hpPercent: 0,
    attackFlat: 0,
    attackPercent: 0,
    secondary: emptySecondaryStats(),
  };
  state.weaponAffixes.forEach((affix) => {
    const value = Number(affix.value) || 0;
    if (!affix.key || !value) return;
    const suffix = affix.mode === 'percent' ? 'Percent' : 'Flat';
    if (affix.key === 'hp') totals[`hp${suffix}`] += value;
    else if (affix.key === 'attack') totals[`attack${suffix}`] += value;
    else if (SECONDARY_KEYS.includes(affix.key)) totals.secondary[affix.key] += value;
  });
  return totals;
}

function clearGeneratedResult() {
  resultGenerated = false;
  currentResult = null;
  activeComparisonIndex = null;
  $('final-hp').textContent = '--';
  $('final-attack').textContent = '--';
  $('hp-detail').textContent = '等待确认生成';
  $('attack-detail').textContent = '等待确认生成';
  $('result-person').textContent = '--';
  $('result-level').textContent = '等级 --';
  renderCharacterFactorLine();
  SECONDARY_KEYS.forEach((key) => {
    const domKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    $(`final-${domKey}`).textContent = '--';
  });
  $('compare-button').disabled = true;
}

function renderCharacterFactorLine() {
  const hpFactor = numberValue('hp-factor', 1);
  const powerFactor = numberValue('power-factor', 1);
  $('factor-line').textContent = `生命系数 ${hpFactor} · 攻击系数 ${powerFactor}`;
}

function calculate({ commit = false } = {}) {
  if (!state.data) return;
  refreshSelectProxies();
  setError('');
  if (!commit) {
    if (resultGenerated || currentResult) clearGeneratedResult();
    saveConfig();
    return null;
  }
  const level = Math.max(1, Math.min(90, Math.round(numberValue('level-input', 1))));
  const roleName = $('person-name').value.trim() || '自定义角色';
  const hpFactor = numberValue('hp-factor', 1);
  const powerFactor = numberValue('power-factor', 1);
  const achievementHp = numberValue('achievement-hp');
  const achievementAttack = numberValue('achievement-attack');
  const baseHpRaw = Number(state.data.personHp[level]) * hpFactor;
  const baseHp = trunc(baseHpRaw);
  const baseAttackRaw = Number(state.data.personPower[level]) * powerFactor;
  const baseAttack = trunc(baseAttackRaw);
  const activeEquipment = state.equipmentSlots.filter(equipmentSlotActive);
  const equipmentHp = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.hp), 0);
  const equipmentAttack = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.attack), 0);
  const equipmentHpFlat = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.hpFlat), 0);
  const equipmentAttackFlat = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.attackFlat), 0);
  const inner = getSelectedInner();
  const innerDetails = autoInnerStats(inner);
  const selectedMartial = getSelectedMartial();
  const autoStats = innerStatsMode() === 'auto' ? innerDetails : null;
  const neigongHp = inner ? (autoStats?.hp ?? numberValue('neigong-hp')) : 0;
  const neigongAttack = inner ? (autoStats?.attack ?? numberValue('neigong-attack')) : 0;
  const selectedTechniqueStats = techniqueTotals();
  const techniqueHp = selectedTechniqueStats.hp;
  const largeRenHpSupplement = numberValue('technique-hp');
  const largeRenAttackSupplement = numberValue('technique-attack');
  const techniqueAttack = selectedTechniqueStats.attack;
  const activeFormation = formationStats();
  const weaponTotals = weaponAffixTotals();
  const secondaryStats = {
    speed: numberValue('base-speed', 0) + martialSpeed(selectedMartial),
    mitigation: numberValue('base-mitigation'),
    crit: numberValue('base-crit', 10),
    dodge: numberValue('base-dodge', 0),
    lifesteal: numberValue('base-lifesteal', 0),
    critDamage: numberValue('base-crit-damage', 0),
    block: numberValue('base-block'),
    reflect: numberValue('base-reflect'),
    recovery: numberValue('base-recovery'),
  };
  if ($('speed-pills-enabled').checked) secondaryStats.speed += 30;
  const innerSecondary = innerDetails?.secondary;
  if (innerSecondary) addSecondaryStats(secondaryStats, innerSecondary);
  addSecondaryStats(secondaryStats, selectedTechniqueStats.secondary);
  addSecondaryStats(secondaryStats, activeFormation.secondary);
  addSecondaryStats(secondaryStats, weaponTotals.secondary);
  activeEquipment.forEach((slot) => {
    addSecondaryStats(secondaryStats, slot.secondary || secondaryStatsFromEquipment(getRawEquipment(slot.id)));
  });
  const reflectToRecoveryRatio = Number(getCharacterProfile(roleName)?.reflect_to_recovery_ratio) || 0;
  if (reflectToRecoveryRatio) {
    secondaryStats.recovery += secondaryStats.reflect * reflectToRecoveryRatio;
  }
  const pillsEnabled = $('pills-enabled').checked;
  const pillCount = 30;
  const pills = pillsEnabled ? pillCount : 0;
  const pillHp = pills * 2;
  const smallRenEnabled = $('small-ren-enabled').checked;
  const smallRenHp = smallRenEnabled ? 20 : 0;
  const smallRenAttack = smallRenEnabled ? numberValue('small-ren-attack-percent', 10) : 0;
  const largeRenEnabled = $('large-ren-enabled').checked;
  // 大任督的气血百分比只乘基础成长生命，不乘装备固定血量或成就固定血量。
  const largeRenHp = largeRenEnabled ? 110 : 0;
  const largeRenAttackCount = largeRenEnabled ? Math.max(0, numberValue('large-ren-attack-count', 10)) : 0;
  const largeRenSpeed = largeRenEnabled ? 8 : 0;
  secondaryStats.speed += largeRenSpeed;
  // Blood pills form their own base-life multiplier. Other life percentages
  // share that post-pill base, while large Ren Du uses the pre-pill base.
  const bloodPillBaseHp = baseHpRaw * (100 + pillHp) / 100;
  const postPillHpPercent = equipmentHp + techniqueHp + neigongHp + smallRenHp
    + weaponTotals.hpPercent + activeFormation.hp;
  const largeRenHpBonus = largeRenEnabled
    ? baseHpRaw * (largeRenHp + largeRenHpSupplement) / 100
    : 0;
  const finalHpRaw = bloodPillBaseHp * (100 + postPillHpPercent) / 100 + largeRenHpBonus;
  const hpPercent = baseHpRaw ? (finalHpRaw / baseHpRaw - 1) * 100 : 0;
  const finalHp = Math.round(finalHpRaw) + trunc(achievementHp) + trunc(weaponTotals.hpFlat) + trunc(equipmentHpFlat);
  const attackPillsEnabled = $('attack-pills-enabled').checked;
  const attackPillCount = attackPillsEnabled ? Math.max(0, Math.min(30, numberValue('attack-pill-count', 30))) : 0;
  const attackPillMultiplier = 1 + attackPillCount / 100;
  const selectedMartialStyle = martialStyle(selectedMartial?.item);
  const martialPower = Number(selectedMartial?.item?.power) || 0;
  const selectedStylePower = selectedMartialStyle
    ? (innerDetails?.stylePower?.[selectedMartialStyle] || 0) + (selectedTechniqueStats.stylePower?.[selectedMartialStyle] || 0)
    : 0;
  const martialBonusPercent = numberValue('martial-bonus-percent');
  // 技艺攻击百分比（包括朱雀之力）同时作用于基础攻击项和武学项。
  const baseAttackPercentMultiplier = 1 + (
    neigongAttack + techniqueAttack + activeFormation.attack + selectedStylePower
  ) / 100;
  const baseAttackDetailTerm = baseAttackRaw * baseAttackPercentMultiplier;
  const baseAttackTerm = baseAttackDetailTerm * attackPillMultiplier;
  const martialPowerTerm = martialPower * (
    1 + (neigongAttack + smallRenAttack + techniqueAttack + selectedStylePower + martialBonusPercent) / 100
  );
  const largeRenAttackTerm = largeRenEnabled
    ? baseAttackRaw * (0.1 * largeRenAttackCount + largeRenAttackSupplement / 100)
    : 0;
  const equipmentPercentTerm = (baseAttackRaw * attackPillMultiplier + martialPower)
    * (equipmentAttack + weaponTotals.attackPercent) / 100;
  const attackBeforeSMultiplier = baseAttackTerm + martialPowerTerm + largeRenAttackTerm
    + equipmentAttackFlat + weaponTotals.attackFlat + equipmentPercentTerm;
  const learnedSMartialCount = Math.max(0, numberValue('learned-s-martial-count', 5));
  const sMartialMultiplier = 1 + learnedSMartialCount * 0.05;
  const finalAttack = trunc(attackBeforeSMultiplier * sMartialMultiplier) + trunc(achievementAttack);
  // 回复按 APK 面板口径：玄武的基础回复量也要乘内功生命加成。
  const recoveryBase = baseHpRaw * (100 + neigongHp) / 100;
  const recoveryValue = trunc(
    recoveryBase * secondaryStats.recovery / 100
      + recoveryBase * selectedTechniqueStats.recoveryBasePercent / 100,
  );
  $('final-hp').textContent = formatNumber(finalHp);
  $('final-attack').textContent = formatNumber(finalAttack);
  $('hp-detail').textContent = `基础 ${formatNumber(baseHp)} · 百分比 ${formatPercent(hpPercent)} · 成就 +${formatNumber(achievementHp)}`;
  $('attack-detail').textContent = `基础项 ${formatNumber(trunc(baseAttackDetailTerm))} · 武学项 ${formatNumber(martialPower)} · S武学 ${formatPercent(learnedSMartialCount * 5)} · 成就 +${formatNumber(achievementAttack)}`;
  SECONDARY_KEYS.forEach((key) => {
    const domKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    $(`final-${domKey}`).textContent = key === 'recovery'
      ? formatNumber(recoveryValue)
      : formatSecondaryValue(key, secondaryStats[key]);
  });
  $('result-person').textContent = roleName;
  $('result-level').textContent = `等级 ${level}`;
  renderCharacterFactorLine();
  $('equipment-breakdown').textContent = `装备生命 +${formatPercent(equipmentHp)}${equipmentHpFlat ? ` · 固定 +${formatNumber(equipmentHpFlat)}` : ''} · 装备攻击 +${formatPercent(equipmentAttack)}${equipmentAttackFlat ? ` · 固定 +${formatNumber(equipmentAttackFlat)}` : ''}`;
  currentResult = {
    hp: finalHp,
    attack: finalAttack,
    roleName,
    level,
    stats: Object.fromEntries(SECONDARY_KEYS.map((key) => [key, key === 'recovery' ? recoveryValue : secondaryStats[key]])),
  };
  resultGenerated = true;
  $('compare-button').disabled = false;
  saveConfig();
  return currentResult;
}

function comparisonSnapshot() {
  if (!currentResult || !resultGenerated) return null;
  return {
    ...currentResult,
    config: currentConfig(),
    stats: { ...currentResult.stats },
    statsAvailable: true,
    label: currentResult.roleName,
  };
}

function restoreSnapshotConfiguration(snapshot) {
  const snapshotConfig = snapshot?.config && typeof snapshot.config === 'object'
    ? snapshot.config
    : {
      // Older snapshots only contain result values. Restore their role and
      // level at minimum while keeping the comparison record usable.
      personName: snapshot?.roleName || '自定义角色',
      level: String(snapshot?.level || 1),
    };
  restoreConfig({
    ...snapshotConfig,
    comparisonSnapshots,
    comparisonPair,
  });
  calculate({ commit: true });
  return true;
}

function comparisonCode(index) {
  return String.fromCharCode(65 + index);
}

function hydrateLegacySnapshot(snapshot) {
  if (snapshot.statsAvailable !== false) return false;
  if (!currentResult || currentResult.hp !== snapshot.hp || currentResult.attack !== snapshot.attack) {
    calculate({ commit: true });
  }
  if (currentResult?.hp !== snapshot.hp || currentResult?.attack !== snapshot.attack) return false;
  snapshot.stats = { ...currentResult.stats };
  snapshot.statsAvailable = true;
  saveConfig();
  return true;
}

function showComparisonSnapshot(index) {
  let snapshot = comparisonSnapshots[index];
  if (!snapshot) return;
  restoreSnapshotConfiguration(snapshot);
  snapshot = comparisonSnapshots[index] || snapshot;
  hydrateLegacySnapshot(snapshot);
  activeComparisonIndex = index;
  if (comparisonSnapshots.length >= 2) {
    const currentPair = normalizeComparisonPair(comparisonPair);
    const otherIndex = currentPair[1] === index ? currentPair[0] : currentPair[1];
    comparisonPair = normalizeComparisonPair([index, otherIndex]);
  }
  $('final-hp').textContent = formatNumber(snapshot.hp);
  $('final-attack').textContent = formatNumber(snapshot.attack);
  $('hp-detail').textContent = `方案 ${comparisonCode(index)} · 已保存快照`;
  $('attack-detail').textContent = `方案 ${comparisonCode(index)} · 已保存快照`;
  SECONDARY_KEYS.forEach((key) => {
    const domKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = snapshot.stats?.[key];
    $(`final-${domKey}`).textContent = value === null || value === undefined
      ? '--'
      : key === 'recovery' ? formatNumber(value) : formatSecondaryValue(key, value);
  });
  if (snapshot.statsAvailable === false) {
    $('hp-detail').textContent = `方案 ${comparisonCode(index)} · 旧快照未保存面板属性`;
    $('attack-detail').textContent = `方案 ${comparisonCode(index)} · 旧快照未保存面板属性`;
  }
  $('result-person').textContent = snapshot.roleName || '自定义角色';
  $('result-level').textContent = `等级 ${snapshot.level}`;
  saveConfig();
  renderComparison();
}

function renderComparison() {
  const section = $('comparison-section');
  const content = $('comparison-content');
  if (!comparisonSnapshots.length) {
    section.hidden = true;
    content.replaceChildren();
    return;
  }
  section.hidden = false;
  const rows = [
    { label: '生命', key: 'hp', format: formatNumber },
    { label: '攻击', key: 'attack', format: formatNumber },
    ...SECONDARY_STAT_DEFS.map((definition) => ({
      label: definition.label,
      key: `stats.${definition.key}`,
      format: (value) => formatSecondaryValue(definition.key, value),
    })),
  ];
  const valueAt = (snapshot, key) => key.startsWith('stats.')
    ? snapshot.stats?.[key.slice(6)]
    : snapshot[key];
  const formatRowValue = (row, value) => value === null || value === undefined ? '--' : row.format(value);
  const cards = comparisonSnapshots.map((snapshot, index) => `
    <button class="comparison-card${activeComparisonIndex === index ? ' is-active' : ''}" type="button" data-comparison-index="${index}" aria-pressed="${activeComparisonIndex === index}">
      <strong>方案 ${comparisonCode(index)} · ${escapeHtml(snapshot.roleName || '自定义角色')}</strong>
    </button>
  `).join('');
  const pair = normalizeComparisonPair(comparisonPair);
  comparisonPair = pair;
  const comparisonOptions = (selected) => comparisonSnapshots.map((snapshot, index) => `
    <option value="${index}"${index === selected ? ' selected' : ''}>方案 ${comparisonCode(index)} · ${escapeHtml(snapshot.roleName || '自定义角色')}</option>
  `).join('');
  const pairControls = comparisonSnapshots.length < 2 ? '' : `
    <div class="comparison-pair-controls">
      <label>对比左侧<select id="comparison-left">${comparisonOptions(pair[0])}</select></label>
      <span>对比</span>
      <label>对比右侧<select id="comparison-right">${comparisonOptions(pair[1])}</select></label>
    </div>`;
  const table = comparisonSnapshots.length < 2
    ? '<p class="field-hint">再生成一个方案后显示差异</p>'
    : `
      <div class="comparison-table-wrap">
        <table class="compare-table">
          <thead><tr><th>属性</th><th>方案 ${comparisonCode(pair[0])} · ${escapeHtml(comparisonSnapshots[pair[0]].roleName || '自定义角色')}</th><th>方案 ${comparisonCode(pair[1])} · ${escapeHtml(comparisonSnapshots[pair[1]].roleName || '自定义角色')}</th><th>差值</th></tr></thead>
          <tbody>
            ${rows.map((row) => {
              const left = valueAt(comparisonSnapshots[pair[0]], row.key);
              const right = valueAt(comparisonSnapshots[pair[1]], row.key);
              const isText = row.type === 'text';
              const difference = isText
                ? (left === right ? '相同' : '不同')
                : left === null || left === undefined || right === null || right === undefined ? null : right - left;
              return `
                <tr>
                  <td>${row.label}</td>
                  <td>${formatRowValue(row, left)}</td>
                  <td>${formatRowValue(row, right)}</td>
                  <td class="compare-difference${!isText && difference < 0 ? ' is-negative' : ''}">${isText ? difference : difference === null ? '未保存' : `${difference > 0 ? '+' : ''}${row.format(difference)}`}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  content.innerHTML = `<div class="comparison-cards">${cards}</div>${pairControls}${table}`;
  enhanceSelects(content);
  content.querySelectorAll('[data-comparison-index]').forEach((card) => {
    card.addEventListener('click', () => showComparisonSnapshot(Number(card.dataset.comparisonIndex)));
  });
  if (comparisonSnapshots.length >= 2) {
    $('comparison-left').addEventListener('change', (event) => {
      const next = Number(event.target.value);
      if (next === comparisonPair[1]) comparisonPair[1] = comparisonPair[0];
      comparisonPair[0] = next;
      saveConfig();
      renderComparison();
    });
    $('comparison-right').addEventListener('change', (event) => {
      const next = Number(event.target.value);
      if (next === comparisonPair[0]) comparisonPair[0] = comparisonPair[1];
      comparisonPair[1] = next;
      saveConfig();
      renderComparison();
    });
  }
  $('compare-button').disabled = comparisonSnapshots.length >= MAX_COMPARISON_SNAPSHOTS || !resultGenerated;
}

function addCurrentComparison() {
  calculate({ commit: true });
  const snapshot = comparisonSnapshot();
  if (!snapshot || comparisonSnapshots.length >= MAX_COMPARISON_SNAPSHOTS) return;
  const index = comparisonSnapshots.length;
  comparisonSnapshots.push(snapshot);
  activeComparisonIndex = index;
  if (index > 0) comparisonPair = [index - 1, index];
  saveConfig();
  renderComparison();
  showComparisonSnapshot(index);
  setSaveStatus(comparisonSnapshots.length >= MAX_COMPARISON_SNAPSHOTS
    ? '已保存 20 套方案，已达上限'
    : `已保存方案 ${comparisonCode(comparisonSnapshots.length - 1)}`);
}

function bindEvents() {
  ['person-name', 'hp-factor', 'power-factor', 'achievement-hp', 'achievement-attack',
    'base-speed', 'base-crit', 'base-dodge', 'base-lifesteal', 'base-crit-damage',
    'base-mitigation', 'base-block', 'base-reflect', 'base-recovery',
    'attack-pill-count', 'small-ren-attack-percent', 'large-ren-attack-count',
    'learned-s-martial-count', 'martial-bonus-percent']
    .forEach((id) => $(id).addEventListener('input', calculate));
  const handleCharacterSelection = () => {
    applyCharacterDefaults();
    populateMartialArts();
    applyDefaultTechniqueSelections();
    refreshTechniqueAvailability();
    renderFormationControls();
    renderTechniqueScope();
    calculate();
  };
  // Mobile select controls can emit input before change; both events must use
  // the same path so the displayed coefficients follow the selected role.
  $('person-name').addEventListener('input', handleCharacterSelection);
  $('person-name').addEventListener('change', handleCharacterSelection);
  ['person-style', 'person-gender'].forEach((id) => $(id).addEventListener('change', () => {
    if (id === 'person-style') populateMartialArts();
    applyDefaultTechniqueSelections();
    refreshTechniqueAvailability();
    renderTechniqueScope();
    calculate();
  }));
  $('level-input').addEventListener('input', calculate);
  $('level-input').addEventListener('change', () => {
    $('level-input').value = Math.max(1, Math.min(90, Math.round(numberValue('level-input', 1))));
    calculate();
  });
  $('neigong-select').addEventListener('change', applyInnerSelection);
  $('martial-select').addEventListener('change', calculate);
  $('technique-options').addEventListener('change', (event) => {
    const input = event.target.closest('.technique-option');
    if (!input) return;
    techniqueSelectionCustomized = true;
    if (input.checked && input.dataset.exclusiveGroup) {
      document.querySelectorAll(`.technique-option[data-exclusive-group="${input.dataset.exclusiveGroup}"]`).forEach((other) => {
        if (other !== input) other.checked = false;
      });
    }
    applyTechniqueSelection();
  });
  ['technique-hp', 'technique-attack'].forEach((id) => $(id).addEventListener('input', () => {
    setTechniqueStatsMode('manual');
    calculate();
  }));
  INNER_MANUAL_FIELD_IDS.forEach((id) => $(id).addEventListener('input', () => { setInnerStatsMode('manual'); calculate(); }));
  $('pills-enabled').addEventListener('change', calculate);
  $('attack-pills-enabled').addEventListener('change', calculate);
  $('speed-pills-enabled').addEventListener('change', calculate);
  $('small-ren-enabled').addEventListener('change', calculate);
  $('large-ren-enabled').addEventListener('change', calculate);
  $('formation-select').addEventListener('change', () => { renderFormationControls(); calculate(); });
  $('formation-position').addEventListener('change', () => { renderFormationControls(); calculate(); });
  document.querySelectorAll('.equipment-slot').forEach((select) => select.addEventListener('change', () => {
    const slotIndex = Number(select.id.split('-').pop());
    const customId = customEquipmentId(slotIndex);
    const item = getEquipment(select.value);
    if (select.value === customId) {
      const previous = state.equipmentSlots[slotIndex];
      state.equipmentSlots[slotIndex] = normalizeCustomEquipment(
        isCustomEquipmentId(previous?.id) ? previous : EMPTY_EQUIPMENT(),
        customId,
      );
    } else if (!item) {
      state.equipmentSlots[slotIndex] = EMPTY_EQUIPMENT();
    } else {
      const stats = equipmentStats(item);
      state.equipmentSlots[slotIndex] = {
        id: item.id,
        name: equipmentName(item),
        hp: stats.hp,
        attack: stats.attack,
        hpFlat: stats.hpFlat,
        attackFlat: stats.attackFlat,
        secondary: stats.secondary,
        extra: '',
      };
    }
    renderEquipmentSlots();
    calculate();
  }));
  $('equipment-slot-grid').addEventListener('input', (event) => {
    const input = event.target.closest('[data-custom-equipment-slot]');
    if (!input) return;
    const slotIndex = Number(input.dataset.customEquipmentSlot);
    const slot = state.equipmentSlots[slotIndex];
    if (!slot || !isCustomEquipmentId(slot.id)) return;
    if (input.dataset.customEquipmentSecondary) {
      slot.secondary[input.dataset.customEquipmentSecondary] = numberValueFrom(input.value);
    } else if (input.dataset.customEquipmentField === 'name') {
      slot.name = input.value;
    } else {
      slot[input.dataset.customEquipmentField] = numberValueFrom(input.value);
    }
    calculate();
  });
  $('weapon-name').addEventListener('input', (event) => {
    state.weaponName = event.target.value;
    updateWeaponSummary();
    calculate();
  });
  state.weaponAffixes.forEach((affix, index) => {
    $(`weapon-affix-key-${index}`).addEventListener('change', (event) => { state.weaponAffixes[index].key = event.target.value; updateWeaponSummary(); calculate(); });
    $(`weapon-affix-mode-${index}`).addEventListener('change', (event) => { state.weaponAffixes[index].mode = event.target.value; updateWeaponSummary(); calculate(); });
    $(`weapon-affix-value-${index}`).addEventListener('input', (event) => { state.weaponAffixes[index].value = numberValueFrom(event.target.value); updateWeaponSummary(); calculate(); });
  });
  $('generate-button').addEventListener('click', () => {
    const result = calculate({ commit: true });
    if (result) setSaveStatus('已生成当前结果');
  });
  $('save-current-button').addEventListener('click', () => {
    saveConfig();
    setSaveStatus('已保存当前配置');
  });
  $('compare-button').addEventListener('click', addCurrentComparison);
  $('clear-comparison-button').addEventListener('click', () => {
    comparisonSnapshots = [];
    comparisonPair = [0, 1];
    activeComparisonIndex = null;
    saveConfig();
    renderComparison();
    setSaveStatus('已清空模拟对比');
  });
  $('reset-button').addEventListener('click', () => {
    state.equipmentSlots = [EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT()];
    state.weaponName = '';
    state.weaponAffixes = [EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX()];
    $('person-name').value = '主角'; $('hp-factor').value = 1; $('power-factor').value = 1;
    $('person-style').value = ''; $('person-gender').value = '';
    applyCharacterDefaults();
    populateMartialArts();
    $('base-speed').value = 0; $('base-crit').value = 10; $('base-dodge').value = 0; $('base-lifesteal').value = 0;
    $('base-crit-damage').value = 0; $('base-mitigation').value = 0; $('base-block').value = 0;
    $('base-reflect').value = 0; $('base-recovery').value = 0;
    $('achievement-hp').value = 292; $('achievement-attack').value = 292;
    $('attack-pill-count').value = 30; $('small-ren-attack-percent').value = 10;
    $('large-ren-attack-count').value = 10; $('learned-s-martial-count').value = 5;
    $('martial-bonus-percent').value = 0;
    $('level-input').value = 90; $('martial-select').value = ''; $('neigong-select').value = '';
    $('neigong-level').value = 9;
    INNER_MANUAL_FIELD_IDS.forEach((id) => { $(id).value = 0; });
    setInnerStatsMode('auto');
    renderInnerEditor();
    setTechniqueSelections(defaultTechniqueIds(), { customized: false });
    $('technique-hp').value = 0; $('technique-attack').value = 0;
    setTechniqueStatsMode('manual');
    renderTechniqueScope();
    $('formation-select').value = '';
    $('formation-position').value = '1';
    renderFormationControls();
    $('pills-enabled').checked = true;
    $('attack-pills-enabled').checked = true;
    $('speed-pills-enabled').checked = true;
    $('small-ren-enabled').checked = true;
    $('large-ren-enabled').checked = true;
    comparisonSnapshots = [];
    comparisonPair = [0, 1];
    activeComparisonIndex = null;
    renderWeaponAffixes(); renderEquipmentSlots(); renderComparison(); calculate();
  });
}

async function init() {
  try {
    const [baseResponse, whiteResponse] = await Promise.all([fetch('./uc540_doc.json'), fetch('./whiterabbit_data.json?v=20260927-58')]);
    if (!baseResponse.ok) throw new Error(`数据读取失败（HTTP ${baseResponse.status}）`);
    state.data = await baseResponse.json();
    if (whiteResponse.ok) state.whiteRabbit = await whiteResponse.json();
    populate(); bindEvents(); restoreConfig();
    if (innerStatsMode() === 'auto') syncAutoInnerStats();
    if (techniqueStatsMode() === 'auto') syncTechniqueStats();
    renderTechniqueScope();
    renderWeaponAffixes(); renderEquipmentSlots(); enhanceSelects(); refreshSelectProxies(); calculate();
  } catch (error) {
    setError(`${error.message}。请通过本地 HTTP 服务打开页面，不要直接双击 HTML 文件。`);
  }
}

init();
