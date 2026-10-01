"""Build immutable content parts; publish the v2 manifest only after all parts exist."""
import argparse
import copy
import hashlib
import json
import os
import tempfile
from pathlib import Path


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()


def atomic_bytes(path, content):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
        temporary = Path(stream.name)
    temporary.chmod(0o644)
    temporary.replace(path)


def split(data):
    guides = copy.deepcopy(data)
    encyclopedia = guides.pop('encyclopedia')
    directory = guides['directory']
    return {'dungeons': encyclopedia.pop('dungeon_drops'), 'encyclopedia': encyclopedia,
            'pitfalls': {key: directory.pop(key) for key in ('pitfalls', 'pitfallsSource', 'pitfallsNotice') if key in directory},
            'search': guides.pop('searchIndex'), 'recipes': guides.pop('recipeData'),
            'strategy': guides.pop('strategyText'), 'logs': guides.pop('updateLogs'), 'guides': guides}


def describe(bundle):
    files, parts = {}, {}
    for name, value in split(bundle['data']).items():
        content = encoded(value)
        digest = hashlib.sha256(content).hexdigest()
        filename = f'content-parts/{name}-{digest}.json'
        files[filename] = content
        parts[name] = {'file': filename, 'sha256': digest}
    return {'schemaVersion': 2, 'revision': bundle['revision'],
            'generatedAt': bundle['generatedAt'], 'parts': parts}, files


def prepare(public, bundle):
    manifest, files = describe(bundle)
    (public / 'content-parts').mkdir(exist_ok=True)
    for filename, content in files.items():
        path = public / filename
        if not path.exists() or path.read_bytes() != content:
            atomic_bytes(path, content)
    bundle['partHashes'] = {name: part['sha256'] for name, part in manifest['parts'].items()}
    return manifest


def publish_manifest(public, manifest):
    atomic_bytes(public / 'content_manifest_v2.json', encoded(manifest))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    bundle_path = args.public / 'content_bundle.json'
    bundle = json.loads(bundle_path.read_bytes())
    manifest, files = describe(bundle)
    if args.check:
        assert json.loads((args.public / 'content_manifest_v2.json').read_bytes()) == manifest, 'Stale split manifest'
        assert bundle.get('partHashes') == {k: v['sha256'] for k, v in manifest['parts'].items()}, 'Stale embedded hashes'
        for filename, content in files.items():
            assert (args.public / filename).read_bytes() == content, 'Stale part: ' + filename
        return
    manifest = prepare(args.public, bundle)
    content = encoded(bundle)
    atomic_bytes(bundle_path, content)
    atomic_bytes(args.public / 'content_manifest.json', encoded({'schemaVersion': 1,
        'revision': bundle['revision'], 'file': 'content_bundle.json', 'sha256': hashlib.sha256(content).hexdigest()}))
    publish_manifest(args.public, manifest)


if __name__ == '__main__':
    main()
