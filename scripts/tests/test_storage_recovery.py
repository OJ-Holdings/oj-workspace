"""Synthetic fixtures only; no production credentials, network, or files."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('storage_recovery', Path(__file__).parents[1] / 'backup-supabase-storage-windows.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StorageRecoveryTests(unittest.TestCase):
    def test_complete_binary_stream_and_sink(self):
        data = bytes(range(256)) * 1000
        sink = io.BytesIO()
        proof = module.digest(io.BytesIO(data), sink)
        self.assertEqual(sink.getvalue(), data)
        self.assertEqual(proof['bytes'], len(data))
        self.assertEqual(proof['sha256'], module.hashlib.sha256(data).hexdigest())

    def test_stream_limit_is_fail_closed(self):
        with self.assertRaisesRegex(module.Blocked, 'STREAM_SIZE_LIMIT'):
            module.digest(io.BytesIO(b'12345'), limit=4)

    def test_corruption_changes_proof(self):
        self.assertNotEqual(module.digest(io.BytesIO(b'original')), module.digest(io.BytesIO(b'corrupt!')))

    def test_redirect_never_forwards_credentials(self):
        with self.assertRaisesRegex(module.Blocked, 'REDIRECT_REFUSED'):
            module.NoRedirect().redirect_request(None, None, None, None, None, None)

    def test_mutation_api_route_is_refused(self):
        with self.assertRaisesRegex(module.Blocked, 'UNSAFE_API_ROUTE'):
            module.api(None, 'synthetic', 'object/remove/oj-documents')

    def test_access_denied_body_is_not_reported(self):
        class Fake:
            def open(self, *args, **kwargs):
                from urllib.error import HTTPError
                raise HTTPError('private-path', 403, 'sensitive-body', None, None)
        with self.assertRaisesRegex(module.Blocked, '^STORAGE_ACCESS_DENIED$'):
            module.api(Fake(), 'synthetic', 'object/authenticated/oj-documents/test')

    def test_new_key_never_sent_as_jwt(self):
        class Fake:
            def open(self, req, **kwargs):
                self.headers = dict(req.header_items())
                return True
        fake = Fake()
        module.api(fake, 'sb_secret_synthetic', 'object/list/oj-documents', {})
        self.assertNotIn('Authorization', fake.headers)
        self.assertEqual(fake.headers['Apikey'], 'sb_secret_synthetic')

    def test_inventory_pagination_and_folders(self):
        pages = [[{'id': None, 'name': 'folder'}],
                 [{'id': 'fixture-id', 'name': 'file.bin', 'metadata': {'size': 3}}]]
        def response(*args):
            return io.BytesIO(module.json.dumps(pages.pop(0)).encode())
        with patch.object(module, 'api', side_effect=response):
            self.assertEqual(module.storage_inventory(None, 'synthetic'), [('fixture-id', 'folder/file.bin', 3)])

    def test_age_real_encryption_authentication_and_no_overwrite(self):
        import os
        if os.name != 'nt':
            self.skipTest('Windows age tools')
        age = Path(os.environ['LOCALAPPDATA']) / 'OJWorkspace/tools/age/1.3.2/age/age.exe'
        if not age.exists():
            self.skipTest('age not installed')
        identity = module.run([str(age.with_name('age-keygen.exe'))]).stdout
        recipient = module.run([str(age.with_name('age-keygen.exe')), '-y'], input=identity).stdout.decode().strip()
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'fixture.age'
            expected = module.encrypt(age, recipient, io.BytesIO(b'synthetic only\x00\xff'), archive)
            self.assertEqual(module.decrypt(age, identity.decode(), archive), expected)
            with self.assertRaisesRegex(module.Blocked, 'ARCHIVE_ALREADY_EXISTS'):
                module.encrypt(age, recipient, io.BytesIO(b'new'), archive)
            raw = bytearray(archive.read_bytes())
            raw[-1] ^= 1
            archive.write_bytes(raw)
            with self.assertRaisesRegex(module.Blocked, 'AGE_AUTHENTICATION_FAILED'):
                module.decrypt(age, identity.decode(), archive)


if __name__ == '__main__':
    unittest.main()
