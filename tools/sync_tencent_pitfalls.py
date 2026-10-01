#!/usr/bin/env python3
"""Refresh the fixed pitfalls source; never summarize or publish client releases."""
import argparse
import hashlib
import json
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import sync_tencent_dungeon_drops as tencent

DOC_URL = 'https://docs.qq.com/sheet/DSWJSVEVGc1Z6Q21E'
SHEET_ID = 'jnxb02'
SHEET_NAME = '游玩注意事项'
OUTPUT = Path(__file__).resolve().parents[1] / 'web/tencent_pitfalls.json'


def ordinal(label):
    token = label[1:-1]
    if token.isdigit():
        return int(token)
    digits = dict(zip('一二三四五六七八九', range(1, 10)))
    if token in digits:
        return digits[token]
    if token.count('十') == 1:
        left, right = token.split('十')
        return (digits[left] if left else 1) * 10 + (digits[right] if right else 0)
    raise ValueError(f'Unsupported item label: {label}')


def parse_snapshot(raw, response):
    collab = response['clientVars']['collab_client_vars']
    tabs = [tab for header in collab['header'] for tab in header.get('d', [])]
    if not any(tab.get('id') == SHEET_ID and tab.get('name') == SHEET_NAME for tab in tabs):
        raise ValueError('Bound sheet missing or renamed; existing data retained')
    fields = tencent.read_fields(tencent.find_related_sheet_blob(raw))
    info = dict((n, v) for n, w, v in tencent.read_fields(next(v for n, w, v in fields if n == 3)))
    if info[1].decode() != SHEET_ID or info.get(4, 0) >= 255:
        raise ValueError('Wrong sheet or incomplete row window; existing data retained')
    store = next(v for n, w, v in fields if n == 5 and w == 2)
    plain, rich = [], []
    for number, wire, value in tencent.read_fields(store):
        if wire == 2 and number == 1:
            plain.append(tencent.plain_text_message(value))
        elif wire == 2 and number == 2:
            rich.append(tencent.rich_text_message(value))
    cells = {}
    for number, wire, value in fields:
        if number != 6 or wire != 2:
            continue
        cell = dict((n, v) for n, w, v in tencent.read_fields(value))
        attributes = dict((n, v) for n, w, v in tencent.read_fields(cell[3]))
        kind = attributes.get(1)
        if kind not in (4, 6):
            continue
        pointer = dict((n, v) for n, w, v in tencent.read_fields(attributes.get(2, b'')))
        text = (plain if kind == 4 else rich)[pointer.get(1, 0)]
        if text:
            cells[(cell.get(1, 0), cell.get(2, 0))] = text
    items = []
    for (row, column), label in sorted(cells.items()):
        if column != 0 or not re.fullmatch(r'第[一二三四五六七八九十\d]+项', label):
            continue
        text = cells.get((row, 2), '').strip()
        if not text:
            raise ValueError(f'Missing body at C{row + 1}; existing data retained')
        items.append({'order': ordinal(label), 'label': label, 'label_cell': f'A{row + 1}',
                      'text_cell': f'C{row + 1}', 'text': text})
    if not items or [item['order'] for item in items] != list(range(1, len(items) + 1)):
        raise ValueError('Empty, duplicate, or incomplete item sequence; existing data retained')
    title = cells.get((0, 0), '')
    notice = next((text for (row, col), text in cells.items() if col == 0 and text.startswith('PS：')), '')
    if '游玩注意事项' not in title or not notice:
        raise ValueError('Unexpected sheet layout; existing data retained')
    return {'source': {'document_url': DOC_URL, 'sheet_id': SHEET_ID, 'sheet_name': SHEET_NAME,
                       'revision': int(collab['rev']), 'related_sheet_sha256': hashlib.sha256(raw).hexdigest()},
            'title': title, 'notice': notice, 'items': items}


def update(output, data):
    old = json.loads(output.read_text()) if output.exists() else None
    if old and old['source']['revision'] > data['source']['revision']:
        raise ValueError('Source revision went backwards; existing data retained')
    # A new fetch time alone must not generate a client content update.
    if old and all(old.get(key) == data[key] for key in ('title', 'notice', 'items')):
        print(f'Unchanged: {len(data["items"])} items; checked revision {data["source"]["revision"]}')
        return False
    data['source']['synced_at'] = datetime.now(timezone.utc).isoformat()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent, delete=False) as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
        temporary = Path(stream.name)
    temporary.replace(output)
    print(f'Synced {len(data["items"])} items at revision {data["source"]["revision"]}: {output}')
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--check', action='store_true', help='fetch and compare without writing')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='jianghu-pitfalls-') as folder:
        root = Path(folder)
        raw = tencent.fetch_related_sheet(DOC_URL, SHEET_ID, root / 'page.html', root / 'source.jsonp', root / 'sheet.bin')
        response = json.loads(tencent.extract_jsonp_payload((root / 'source.jsonp').read_bytes()))
        data = parse_snapshot(raw, response)
    if args.check:
        old = json.loads(args.output.read_text()) if args.output.exists() else {}
        changed = any(old.get(key) != data[key] for key in ('title', 'notice', 'items'))
        print(json.dumps({'revision': data['source']['revision'], 'items': len(data['items']), 'changed': changed}))
    else:
        update(args.output, data)


if __name__ == '__main__':
    main()
