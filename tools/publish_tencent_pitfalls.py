#!/usr/bin/env python3
"""Server job: update only bound pitfalls in the current public v0.5 bundle."""
import fcntl
import hashlib
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import sync_tencent_dungeon_drops as tencent
import sync_tencent_pitfalls as pitfalls

ROOT = Path('/opt/jianghu-content-sync')
PUBLIC = Path('/opt/jianghu-calculator/releases')


def write_atomic(path, content):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        stream.write(content)
        temporary = Path(stream.name)
    os.chmod(temporary, 0o644)
    temporary.replace(path)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def run():
    ROOT.mkdir(exist_ok=True)
    with (ROOT / 'publish.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            raw = tencent.fetch_related_sheet(pitfalls.DOC_URL, pitfalls.SHEET_ID,
                folder / 'page', folder / 'response', folder / 'sheet')
            response = json.loads(tencent.extract_jsonp_payload((folder / 'response').read_bytes()))
            fresh = pitfalls.parse_snapshot(raw, response)
        snapshot = ROOT / 'tencent_pitfalls.json'
        pitfalls.update(snapshot, fresh)
        source = json.loads(snapshot.read_text())
        bundle_path, manifest_path = PUBLIC / 'content_bundle.json', PUBLIC / 'content_manifest.json'
        previous = bundle_path.read_bytes()
        manifest = json.loads(manifest_path.read_bytes())
        bundle = json.loads(previous)
        if (manifest.get('file') != 'content_bundle.json'
            or manifest.get('sha256') != hashlib.sha256(previous).hexdigest()
            or bundle.get('schemaVersion') != 1 or manifest.get('schemaVersion') != 1
            or bundle.get('revision') != manifest.get('revision')):
            raise ValueError('Published bundle is inconsistent; no content was replaced')
        directory = bundle['data']['directory']
        if directory.get('pitfallsSource', {}).get('revision', 0) > source['source']['revision']:
            raise ValueError('Refusing to publish an older Tencent source')
        warning = lambda item: '武道感悟' in item['text'] and '不要直接使用' in item['text']
        ordered = [item for item in source['items'] if warning(item)] + [item for item in source['items'] if not warning(item)]
        replacement = {
            'pitfalls': [{'title': '武道感悟' if warning(item) else item['label'], 'text': item['text'],
                          'source_label': item['label'], 'source_cell': item['text_cell'],
                          **({'warning': '不要直接使用！'} if warning(item) else {})} for item in ordered],
            'pitfallsSource': source['source'], 'pitfallsNotice': source['notice'],
        }
        changed = any(directory.get(key) != value for key, value in replacement.items())
        now = datetime.now(timezone.utc)
        if changed:
            backup = ROOT / 'previous'
            backup.mkdir(exist_ok=True)
            shutil.copy2(bundle_path, backup / bundle_path.name)
            shutil.copy2(manifest_path, backup / manifest_path.name)
            directory.update(replacement)
            bundle['revision'] = max(int(now.timestamp() * 1000), bundle['revision'] + 1)
            bundle['generatedAt'] = now.isoformat()
            content = json_bytes(bundle)
            manifest.update(revision=bundle['revision'], sha256=hashlib.sha256(content).hexdigest())
            write_atomic(bundle_path, content)
            write_atomic(manifest_path, json_bytes(manifest))
        status = {'checked_at': now.isoformat(), 'source_revision': fresh['source']['revision'],
                  'items': len(source['items']), 'published': changed, 'content_revision': bundle['revision']}
        write_atomic(ROOT / 'status.json', json_bytes(status))
        print(json.dumps(status, ensure_ascii=False))


if __name__ == '__main__':
    run()
