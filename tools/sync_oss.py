"""Mirror validated public releases to OSS using the ECS instance RAM role."""
import argparse
import fcntl
import hashlib
import json
import re
import urllib.request
from pathlib import Path

BUCKET = 'jianghu-baitu'
ENDPOINT = 'https://oss-cn-beijing.aliyuncs.com'
PUBLIC_URL = f'https://{BUCKET}.oss-cn-beijing.aliyuncs.com/jianghu/'
ROOT = Path('/opt/jianghu-content-sync')
PUBLIC = Path('/opt/jianghu-calculator/releases')
COMPATIBILITY = ['whiterabbit_data.json', 'strategy_guides.json', 'guide_search_index.json',
                 'strategy_ocr_data.json', 'tencent_recipe_data.json', 'update_logs.json', 'achievements.json']


def digest(content):
    return hashlib.sha256(content).hexdigest()


def plan(public):
    def read(name):
        path = (public / name).resolve()
        if not path.is_relative_to(public.resolve()):
            raise ValueError('File outside release directory')
        return path.read_bytes()

    bundle_bytes = read('content_bundle.json')
    bundle = json.loads(bundle_bytes)
    v1_bytes = read('content_manifest.json')
    v1 = json.loads(v1_bytes)
    v2_bytes = read('content_manifest_v2.json')
    v2 = json.loads(v2_bytes)
    if (v1['sha256'] != digest(bundle_bytes) or v1['file'] != 'content_bundle.json'
            or v1['revision'] != bundle['revision'] or v2['revision'] != bundle['revision']):
        raise ValueError('Inconsistent content release')
    files = []
    for name, part in v2['parts'].items():
        if not re.fullmatch(r'[a-z]+', name) or not re.fullmatch(r'[a-f0-9]{64}', part['sha256']):
            raise ValueError('Invalid part descriptor')
        filename = f"content-parts/{name}-{part['sha256']}.json"
        if part['file'] != filename:
            raise ValueError('Invalid part path')
        content = read(filename)
        if digest(content) != part['sha256']:
            raise ValueError('Part checksum mismatch')
        files.append((filename, content, True))
    latest = json.loads(read('latest.json'))
    version = latest['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Only formal versioned APKs may be published')
    apk = f'v{version}/jianghu-calculator-{version}.apk'
    apk_bytes = read(apk)
    if digest(apk_bytes) != latest['sha256']:
        raise ValueError('APK checksum mismatch')
    # OSS's default endpoint rejects public APK downloads (ApkDownloadForbidden).
    # Keep the verified ECS/GitHub APK URL until a custom download domain exists.
    for name in COMPATIBILITY:
        if (public / name).exists():
            files.append((name, read(name), False))
    files.append(('content_bundle.json', bundle_bytes, False))
    # Publish pointers only after every referenced file has been uploaded and verified.
    files.extend([('content_manifest.json', v1_bytes, False),
                  ('content_manifest_v2.json', v2_bytes, False),
                  ('latest.json', (json.dumps(latest, ensure_ascii=False) + '\n').encode(), False)])
    return files, bundle['revision']


def role_auth():
    import oss2
    metadata = 'http://100.100.100.200/latest/'
    token_request = urllib.request.Request(metadata + 'api/token', method='PUT',
        headers={'X-aliyun-ecs-metadata-token-ttl-seconds': '600'})
    with urllib.request.urlopen(token_request, timeout=5) as response:
        token = response.read().decode()
    def get(path):
        request = urllib.request.Request(metadata + path, headers={'X-aliyun-ecs-metadata-token': token})
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.read().decode()
    prefix = 'meta-data/ram/security-credentials/'
    role = get(prefix).strip()
    if not re.fullmatch(r'[\w-]+', role):
        raise ValueError('Unexpected instance role')
    credentials = json.loads(get(prefix + role))
    if credentials.get('Code') != 'Success':
        raise ValueError('Instance credentials unavailable')
    return oss2.StsAuth(credentials['AccessKeyId'], credentials['AccessKeySecret'], credentials['SecurityToken'])


def run(public, verify_all=False):
    import oss2
    ROOT.mkdir(exist_ok=True)
    with (ROOT / 'publish.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        files, revision = plan(public)
        bucket = oss2.Bucket(role_auth(), ENDPOINT, BUCKET, connect_timeout=30)
        uploaded = 0
        for filename, content, immutable in files:
            key = 'jianghu/' + filename
            sha = digest(content)
            cache = 'public, max-age=2592000, immutable' if immutable else 'public, max-age=60'
            same = False
            try:
                headers = bucket.head_object(key).headers
                same = headers.get('x-oss-meta-sha256') == sha and headers.get('Cache-Control') == cache
            except oss2.exceptions.NoSuchKey:
                pass
            if not same:
                bucket.put_object(key, content, headers={
                    'Content-Type': 'application/vnd.android.package-archive' if filename.endswith('.apk') else 'application/json; charset=utf-8',
                    'Cache-Control': cache, 'x-oss-meta-sha256': sha})
                uploaded += 1
            if not same or verify_all:
                request = urllib.request.Request(PUBLIC_URL + filename, headers={'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=60) as response:
                    if digest(response.read()) != sha:
                        raise ValueError('Public download checksum mismatch: ' + filename)
            print(('Uploaded ' if not same else 'Unchanged ') + filename, flush=True)
        print(json.dumps({'revision': revision, 'files': len(files), 'uploaded': uploaded}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=PUBLIC)
    parser.add_argument('--verify-all', action='store_true')
    args = parser.parse_args()
    try:
        run(args.public, args.verify_all)
    except Exception as error:
        # Never serialize SDK requests or temporary credentials into logs.
        print('OSS sync failed: ' + type(error).__name__, flush=True)
        raise SystemExit(1)
