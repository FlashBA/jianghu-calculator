#!/usr/bin/env python3
"""Download source snapshots separately from offline encyclopedia comparison."""
import argparse
import copy
import hashlib
import json
import math
import re
import struct
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import sync_tencent_dungeon_drops as tencent
import technique_sync

ROOT = Path(__file__).resolve().parents[1]
DOC_A = 'https://docs.qq.com/sheet/DSWJSVEVGc1Z6Q21E'
DOC_B = 'https://docs.qq.com/sheet/DSURIZEVDYVZjdHRp'
SHEETS = [
    (DOC_A, 'BB08J2', '角色成长与天赋', 'characters'),
    (DOC_A, 'mgdudc', '技艺获取与升级', 'techniques'),
    (DOC_B, 'BB08J2', '拳法篇', 'martial_arts'),
    (DOC_B, '3ckc51', '剑法篇', 'martial_arts'),
    (DOC_B, 'so0fll', '刀法篇', 'martial_arts'),
    (DOC_B, 'uu9vca', '棍法篇', 'martial_arts'),
    (DOC_B, '3n2nwv', '内功篇', 'inner_skills'),
]


def fields(raw):
    return dict((n, value) for n, wire, value in tencent.read_fields(raw))


def decode_grid(raw, sheet_id):
    sheet = tencent.read_fields(tencent.find_related_sheet_blob(raw))
    info = fields(next(v for n, w, v in sheet if n == 3))
    if info[1].decode() != sheet_id or info.get(4, 0) >= 255 or info.get(5, 0) >= 31:
        raise ValueError('Wrong sheet or incomplete fetch window')
    pools = {1: [], 2: [], 3: []}
    for n, wire, value in tencent.read_fields(next(v for n, w, v in sheet if n == 5)):
        if n == 1:
            pools[1].append(tencent.plain_text_message(value))
        elif n == 2:
            pools[2].append(tencent.rich_text_message(value))
        elif n == 3:
            number = fields(value).get(1)
            pools[3].append(struct.unpack('<d', number)[0] if isinstance(number, bytes) else number)
    rows = {}
    for n, wire, value in sheet:
        if n != 6 or wire != 2:
            continue
        cell = fields(value)
        attributes = fields(cell[3])
        kind = attributes.get(1)
        pointer = fields(attributes.get(2, b'')).get(1, 0)
        if kind in (4, 6):
            value = pools[1 if kind == 4 else 2][pointer]
        elif kind == 2:
            value = pools[3][pointer - 129] if pointer >= 129 else pointer
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError('Invalid numeric cell')
        elif kind in (None, 0, 5):
            continue
        else:
            raise ValueError(f'Unsupported cell type {kind}')
        if value != '':
            rows.setdefault(str(cell.get(1, 0) + 1), {})[str(cell.get(2, 0) + 1)] = value
    return rows


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def fetch_snapshots(folder):
    for url, sheet_id, name, category in SHEETS:
        destination = folder / f'{category}-{sheet_id}'
        destination.mkdir(parents=True, exist_ok=True)
        raw = tencent.fetch_related_sheet(url, sheet_id, destination / 'page.html',
                                         destination / 'source.jsonp', destination / 'sheet.bin')
        collab = json.loads(tencent.extract_jsonp_payload((destination / 'source.jsonp').read_bytes()))['clientVars']['collab_client_vars']
        tabs = [tab for header in collab['header'] for tab in header.get('d', [])]
        if not any(tab.get('id') == sheet_id and tab.get('name') == name for tab in tabs):
            raise ValueError(f'Sheet renamed: {name}')
        write_json(destination / 'snapshot.json', {
            'url': url, 'sheet_id': sheet_id, 'sheet_name': name, 'category': category,
            'revision': int(collab['rev']), 'sha256': hashlib.sha256(raw).hexdigest(),
            'fetched_at': datetime.now(timezone.utc).isoformat(), 'rows': decode_grid(raw, sheet_id),
        })
        print(f'Downloaded {name}: revision {collab["rev"]}', flush=True)


MAPPINGS = {
    'dungeon_drops': {},
    'characters': {'name': 2, 'hp_factor': 3, 'power_factor': 4, 'style': 6, 'access': 7, 'talent': 10},
    'techniques': {'name': 1, 'max_level': 2, 'scope': 3, 'effect': 4, 'access': 5, 'upgrade': 8},
    'martial_arts': {'name': 1, 'rank': 2, 'power': 3, 'speed': 4, 'range': 5, 'double_break': 6,
                     'crit_percent': 7, 'crit_damage': 8, 'buff': 9, 'special': 11, 'access': 14},
    'inner_skills': {'name': 1, 'rank': 2, 'ren_du': 3, 'hp_percent': 4, 'attack_percent': 5,
                     'heal_percent': 6, 'mitigation_percent': 7, 'lifesteal_percent': 8,
                     'crit_percent': 9, 'crit_damage_percent': 10, 'reflect_percent': 11,
                     'speed': 12, 'dodge_percent': 13, 'special': 14, 'access': 17},
}
NUMERIC = {'hp_factor', 'power_factor', 'max_level', 'power', 'speed', 'crit_damage'}
HEADERS = {'characters': (4, {'2': '角色名称', '3': '生命成长', '4': '攻击成长', '6': '使用套路'}),
           'techniques': (8, {'1': '技艺名称', '2': '等级上限', '4': '满级效果'}),
           'martial_arts': (5, {'1': '名称', '2': '等级', '3': '威力', '8': '暴击倍率'}),
           'inner_skills': (3, {'1': '名称', '2': '等级', '4': '血量', '17': '获取途径'})}


def normalized(value):
    if isinstance(value, str):
        return re.sub(r'\s+', '', value)
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        return round(value, 8)
    return value


def equal(left, right):
    return normalized(left) == normalized(right)


def convert(key, value):
    if key.endswith('_percent') or key in NUMERIC:
        if value in ('', '/', '//', None):
            return None
        if isinstance(value, str):
            if key == 'crit_damage' and re.fullmatch(r'\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)+', value):
                return value
            if re.fullmatch(r'-?\d+(?:\.\d+)?%?', value.strip()):
                return float(value.rstrip('%'))
            raise ValueError(f'Unknown numeric value: {value}')
        return round(value * (100 if key.endswith('_percent') else 1), 8)
    return str(value) if value is not None else ''


def record_identity(category, item):
    if category == 'dungeon_drops':
        return category + ':' + json.dumps([normalized(item.get(k, '')) for k in ('dungeon', 'section', 'boss', 'name')], ensure_ascii=False)
    return f'{category}:{normalized(item["name"])}'


def dungeon_records(snapshot):
    dungeon, header_ready = '', False
    result, issues = {}, []
    for row, cells in sorted(snapshot['rows'].items(), key=lambda pair: int(pair[0])):
        label, boss = cells.get('1', ''), cells.get('2', '')
        title = re.fullmatch(r'(.+?)[（(]重置[^）)]+[）)]', str(label))
        if title:
            dungeon, header_ready = title[1], False
            continue
        if boss == 'BOSS':
            if not dungeon or any(cells.get(k) != v for k, v in {'5': '宝箱掉落', '7': '飘字掉落', '9': '飘字掉落概率'}.items()):
                raise ValueError('Dungeon columns changed')
            header_ready = True
            continue
        if not boss:
            if cells.get('5') or cells.get('7'):
                raise ValueError('Drop row has no boss identity')
            continue
        if not header_ready:
            raise ValueError('Dungeon row before recognized header')
        probability = cells.get('9', '')
        if isinstance(probability, (int, float)):
            probability = f'{round(probability * 100, 8):g}%'
        chest = tencent.normalize_cell(cells.get('5', ''))
        floating = tencent.normalize_cell(cells.get('7', ''))
        for kind, column in [('宝箱掉落', '5'), ('飘字掉落', '7')]:
            text = cells.get(column, '')
            if not text:
                continue
            # Known names can contain spaces (e.g. "S 南疆拳掌").
            compact = tencent.normalize_cell(text)
            items = tencent.KNOWN_COMPOSITE_DROPS.get(compact)
            if items is None:
                items = [part for part in re.split(r'[\s，,、]+', text) if part]
            probs = tencent.split_probabilities(str(probability), len(items)) if kind == '飘字掉落' else [''] * len(items)
            if kind == '飘字掉落' and probability and not any(probs):
                issues.append({'category': 'dungeon_drops', 'name': boss, 'field': 'item_probability',
                               'sheet': snapshot['sheet_name'], 'row': int(row), 'reason': 'Item/probability counts differ; individual probabilities left unknown'})
            for index, name in enumerate(items):
                if name in ('A', 'B', 'C', 'S', '？', '?'):
                    raise ValueError('Ambiguous split drop name')
                values = {'name': name, 'dungeon': dungeon, 'section': label, 'boss': boss,
                          'type': tencent.guess_type(name, kind),
                          'drop': kind + (f' · 概率 {probs[index]}' if probs[index] else ''),
                          'chest_drop': chest, 'floating_drop': floating,
                          'probability': str(probability), 'item_probability': probs[index]}
                identity = record_identity('dungeon_drops', values)
                if identity in result:
                    raise ValueError(f'Ambiguous duplicate drop: {identity}')
                result[identity] = {'category': 'dungeon_drops', 'name': name, 'values': values,
                                    'sheet': snapshot['sheet_name'], 'row': int(row), 'invalid': []}
        if cells.get('11'):
            issues.append({'category': 'dungeon_drops', 'name': boss, 'field': 'notes',
                           'sheet': snapshot['sheet_name'], 'row': int(row),
                           'reason': 'Supplemental chest notes require mapping', 'text': cells['11']})
    if not result:
        raise ValueError('No dungeon drops parsed')
    return result, issues


def read_cloud(folder):
    cloud, sources, issues = {}, [], []
    revisions = {}
    for url, sheet_id, name, category in SHEETS:
        snapshot = json.loads((folder / f'{category}-{sheet_id}' / 'snapshot.json').read_text())
        if (snapshot['url'], snapshot['sheet_id'], snapshot['sheet_name'], snapshot['category']) != (url, sheet_id, name, category):
            raise ValueError(f'Snapshot identity mismatch: {name}')
        raw = (folder / f'{category}-{sheet_id}' / 'sheet.bin').read_bytes()
        if hashlib.sha256(raw).hexdigest() != snapshot['sha256'] or decode_grid(raw, sheet_id) != snapshot['rows']:
            raise ValueError(f'Snapshot integrity failure: {name}')
        if url in revisions and revisions[url] != snapshot['revision']:
            raise ValueError('Document changed during download; fetch a consistent snapshot again')
        revisions[url] = snapshot['revision']
        sources.append({k: snapshot[k] for k in ('url', 'sheet_id', 'sheet_name', 'revision', 'sha256', 'fetched_at')})
        if category == 'dungeon_drops':
            drops, drop_issues = dungeon_records(snapshot)
            cloud.update(drops)
            issues.extend(drop_issues)
            continue
        header_row, expected = HEADERS[category]
        if any(snapshot['rows'].get(str(header_row), {}).get(col) != title for col, title in expected.items()):
            raise ValueError(f'Column layout changed: {name}')
        count = 0
        for row, cells in snapshot['rows'].items():
            if int(row) <= header_row:
                continue
            item_name = cells.get(str(MAPPINGS[category]['name']))
            # Section headings and attribution cells are not records.
            if not item_name or (category == 'characters' and '3' not in cells) or (category != 'characters' and '2' not in cells):
                continue
            values, invalid = {}, []
            for key, column in MAPPINGS[category].items():
                try:
                    values[key] = convert(key, cells.get(str(column)))
                except ValueError as error:
                    invalid.append(key)
                    issues.append({'category': category, 'name': item_name, 'field': key, 'sheet': name, 'row': int(row), 'reason': str(error)})
            if category == 'martial_arts':
                values['style'] = name[:2]
            required_numbers = {'characters': ('hp_factor', 'power_factor'),
                                'techniques': ('max_level',),
                                'martial_arts': ('power', 'speed'), 'inner_skills': ()}[category]
            for key in required_numbers:
                value = values.get(key)
                if not isinstance(value, (int, float)) or not 0 < value < 100000:
                    invalid.append(key)
                    issues.append({'category': category, 'name': item_name, 'field': key,
                                   'sheet': name, 'row': int(row), 'reason': 'Required numeric field missing or invalid'})
            identity = f'{category}:{normalized(item_name)}'
            if identity in cloud:
                raise ValueError(f'Duplicate source name: {identity}')
            cloud[identity] = {'category': category, 'name': item_name, 'values': values,
                               'sheet': name, 'row': int(row), 'invalid': invalid}
            count += 1
        if not count:
            raise ValueError(f'No records parsed: {name}')
    return cloud, sources, issues


def compare(local, cloud, previous=None):
    """Produce a candidate only; never change live data or unlock conflicts."""
    candidate = copy.deepcopy(local)
    local_records = {}
    for category in MAPPINGS:
        if category == 'dungeon_drops' and not any(sheet[3] == category for sheet in SHEETS):
            continue
        for item in candidate.get(category, []):
            identity = record_identity(category, item)
            if identity in local_records:
                raise ValueError(f'Duplicate local name: {identity}')
            local_records[identity] = item
    baseline, report = {}, []
    previous = previous or {}
    for identity, source in cloud.items():
        values = source['values']
        item = local_records.get(identity)
        old = previous.get(identity)
        if item is None:
            # Only names first appearing AFTER the initial baseline are additions.
            complete = (source['category'] == 'martial_arts' and not source['invalid']
                        and all(values.get(k) is not None for k in ('power', 'speed'))
                        and all(values.get(k) for k in ('name', 'rank', 'range', 'access')))
            added = bool(previous and (old is None or old.get('pending_new')) and complete)
            if added:
                candidate['martial_arts'].append(copy.deepcopy(values))
                baseline[identity] = {'fields': {k: {'mode': 'follow', 'value': v} for k, v in values.items() if k != 'name'}}
            else:
                baseline[identity] = old or {'fields': {}, 'cloud_only_at_baseline': not bool(previous), 'pending_new': bool(previous)}
            report.append({'category': source['category'], 'name': source['name'], 'field': '*',
                           'status': 'append' if added else 'cloud_only', 'cloud': values, 'local': None})
            continue
        before = copy.deepcopy(item)
        tracked = copy.deepcopy(old.get('fields', {})) if old else {}
        for key, value in values.items():
            if key == 'name':
                continue
            current = item.get(key)
            state = tracked.get(key)
            if state:
                follow = state['mode'] == 'follow' and equal(current, state['value'])
                if follow:
                    status = 'follow' if equal(current, value) else 'update'
                    if status == 'update':
                        item[key] = value
                else:
                    status = 'keep_local'
            else:
                # A previously absent field never gains trust automatically.
                follow = old is None and equal(current, value) and key in item
                status = 'follow' if follow else 'keep_local'
            tracked[key] = {'mode': 'follow' if follow else 'local', 'value': item.get(key) if follow else current}
            report.append({'category': source['category'], 'name': source['name'], 'field': key,
                           'status': status, 'local': current, 'cloud': value,
                           'sheet': source['sheet'], 'row': source['row']})
        baseline[identity] = {'fields': tracked}
        if source['category'] == 'techniques':
            baseline[identity]['calculation'] = technique_sync.fingerprint(before)
            if item.get('effect') != before.get('effect'):
                try:
                    if old.get('calculation') != technique_sync.fingerprint(before):
                        raise ValueError('Calculation fields were manually edited')
                    technique_sync.linked_update(before, item)
                    baseline[identity]['calculation'] = technique_sync.fingerprint(item)
                except ValueError as error:
                    item['effect'] = before['effect']
                    tracked['effect'] = copy.deepcopy(old['fields']['effect'])
                    for change in report:
                        if change['category'] == 'techniques' and change['name'] == item['name'] and change['field'] == 'effect':
                            change.update(status='review', reason=str(error))
    for identity, item in local_records.items():
        if identity not in cloud:
            baseline[identity] = previous.get(identity, {'fields': {}})
            report.append({'category': identity.split(':')[0], 'name': item['name'], 'field': '*',
                           'status': 'local_only', 'local': item, 'cloud': None})
    # Keep tombstones so a deleted/reappearing cloud-only name is not "new".
    for identity, state in previous.items():
        baseline.setdefault(identity, state)
    return candidate, baseline, report


def offline_report(folder, output, baseline_path):
    local_path = ROOT / 'web/whiterabbit_data.json'
    raw_local = local_path.read_bytes()
    local = json.loads(raw_local)
    cloud, sources, issues = read_cloud(folder)
    previous = json.loads(baseline_path.read_text()) if baseline_path else None
    if previous:
        old_sources = {(s['url'], s['sheet_id']): s for s in previous['sources']}
        for source in sources:
            old = old_sources[(source['url'], source['sheet_id'])]
            if source['revision'] < old['revision'] or (source['revision'] == old['revision'] and source['sha256'] != old['sha256']):
                raise ValueError('Source revision regressed or changed without revision')
    candidate, baseline, changes = compare(local, cloud, previous['records'] if previous else None)
    counts = Counter(change['status'] for change in changes)
    report = {'mode': 'offline_only', 'local_sha256': hashlib.sha256(raw_local).hexdigest(),
              'sources': sources, 'counts': dict(counts), 'issues': issues, 'changes': changes,
              'unmapped': ['equipment', 'supplemental dungeon notes', 'technique calculated attributes', 'martial_rules and derived fields'],
              'manual_only': ['dungeon_drops']}
    write_json(output / 'diff.json', report)
    write_json(output / 'baseline-candidate.json', {'schema_version': 1, 'sources': sources, 'records': baseline})
    write_json(output / 'encyclopedia-candidate.json', candidate)
    labels = {'follow': '一致，可跟随云端', 'keep_local': '保留本地', 'cloud_only': '首次云端独有/待确认',
              'local_only': '本地独有，保留', 'update': '拟自动更新', 'append': '拟新增武学', 'review': '效果待人工核对'}
    lines = ['# 图鉴离线差异报告', '', '仅离线计算，未修改图鉴、未发布、未启用定时更新。', '',
             '比较单位是字段；只忽略空白和浮点尾差，不推断同义词。首次不一致字段保持本地优先。', '',
             '## 统计', ''] + [f'- {labels[k]}：{v}' for k, v in counts.items()]
    lines += ['', '未映射：装备、副本补充备注、技艺计算属性及其他派生规则；不视为一致，不自动更新。',
              '技艺效果文字的后续变动需与计算属性一起解析，当前报告不能直接用于生产自动发布。',
              f'无法解析的字段：{len(issues)}（详见 diff.json）。', '', '## 保留本地的差异', '']
    for change in changes:
        if change['status'] != 'keep_local':
            continue
        lines += [f'### {change["category"]} / {change["name"]} / {change["field"]}', '',
                  f'- 本地：{json.dumps(change["local"], ensure_ascii=False)}',
                  f'- 云端：{json.dumps(change["cloud"], ensure_ascii=False)}',
                  f'- 位置：{change["sheet"]} 第 {change["row"]} 行', '']
    lines += ['## 未匹配条目', '']
    lines += [f'- {labels[c["status"]]}：{c["category"]} / {c["name"]}' for c in changes if c['status'] in ('cloud_only', 'local_only', 'append')]
    output.mkdir(parents=True, exist_ok=True)
    (output / 'diff.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'counts': counts, 'unparsed_fields': len(issues), 'report': str(output / 'diff.md')}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='download only; does not edit application data')
    parser.add_argument('--snapshots', type=Path, default=ROOT / 'reports/tencent-encyclopedia-snapshots')
    parser.add_argument('--output', type=Path, default=ROOT / 'reports/tencent-encyclopedia-diff')
    parser.add_argument('--baseline', type=Path, help='previous baseline; omit for first comparison')
    parser.add_argument('--include-dungeons', action='store_true', help='manually include dungeon drops in offline inspection only')
    args = parser.parse_args()
    if args.include_dungeons:
        SHEETS.append((DOC_A, 'w5z6in', '副本掉落', 'dungeon_drops'))
    if args.fetch:
        fetch_snapshots(args.snapshots)
    else:
        offline_report(args.snapshots, args.output, args.baseline)


if __name__ == '__main__':
    main()
