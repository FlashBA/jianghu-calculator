import json
import tempfile
import unittest
from pathlib import Path

from sync_oss import digest, plan


class PublishPlanTest(unittest.TestCase):
    def test_verified_order_and_public_allowlist(self):
        with tempfile.TemporaryDirectory() as folder:
            public = Path(folder)
            part = b'{"characters":[]}\n'
            sha = digest(part)
            name = f'content-parts/encyclopedia-{sha}.json'
            (public / 'content-parts').mkdir()
            (public / name).write_bytes(part)
            bundle = b'{"revision":1}\n'
            (public / 'content_bundle.json').write_bytes(bundle)
            (public / 'content_manifest.json').write_text(json.dumps({
                'file': 'content_bundle.json', 'revision': 1, 'sha256': digest(bundle)}))
            (public / 'content_manifest_v2.json').write_text(json.dumps({
                'revision': 1, 'parts': {'encyclopedia': {'file': name, 'sha256': sha}}}))
            (public / 'v0.5.0').mkdir()
            (public / 'v0.5.0/jianghu-calculator-0.5.0.apk').write_bytes(b'fixture')
            apk_url = 'https://47.95.250.113/jianghu/v0.5.0/jianghu-calculator-0.5.0.apk'
            (public / 'latest.json').write_text(json.dumps({
                'version': '0.5.0', 'apk': apk_url, 'sha256': digest(b'fixture')}))
            (public / 'private-key.txt').write_text('not public')
            files, revision = plan(public)
            names = [item[0] for item in files]
            self.assertEqual(revision, 1)
            self.assertEqual(names[-3:], ['content_manifest.json', 'content_manifest_v2.json', 'latest.json'])
            self.assertNotIn('private-key.txt', names)
            self.assertFalse(any(name.endswith('.apk') for name in names))
            self.assertEqual(json.loads(files[-1][1])['apk'], apk_url)
            (public / name).write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                plan(public)


if __name__ == '__main__':
    unittest.main()
