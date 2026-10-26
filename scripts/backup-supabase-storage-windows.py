"""Private Windows Storage byte recovery. No production mutations or plaintext files.

Uses the existing R40 settings, age identity and DPAPI credentials. All diagnostics
are fixed codes: never emit exceptions, HTTP bodies, object names or credentials.
"""
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from urllib import request, parse

PROJECT = 'vgckpcktsfuithqggknd'
BUCKET = 'oj-documents'
EXPECTED_COUNT = 2
EXPECTED_BYTES = 38670441
MAX_BYTES = 512 * 1024 * 1024


class Blocked(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Blocked(code)


def dpapi(path):
    class Blob(ctypes.Structure):
        _fields_ = [('size', ctypes.c_uint32), ('data', ctypes.POINTER(ctypes.c_byte))]
    raw = bytes.fromhex(path.read_text(encoding='utf-8-sig').strip())
    buf = ctypes.create_string_buffer(raw)
    source = Blob(len(raw), ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte)))
    result = Blob()
    require(ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)),
        'DPAPI_UNAVAILABLE')
    try:
        return ctypes.string_at(result.data, result.size).decode('utf-16-le')
    finally:
        ctypes.memset(result.data, 0, result.size)
        ctypes.windll.kernel32.LocalFree(result.data)


def run(args, **kwargs):
    return subprocess.run(args, capture_output=True, timeout=120, **kwargs)


def protect(path):
    path.mkdir(parents=True, exist_ok=False)
    who = run(['whoami', '/user', '/fo', 'csv', '/nh']).stdout.decode(errors='replace')
    sid = re.search(r'S-1-5-\d+(?:-\d+)+', who)
    require(sid is not None, 'WINDOWS_IDENTITY_UNAVAILABLE')
    result = run(['icacls', str(path), '/inheritance:r', '/grant:r',
                  '*' + sid.group() + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F',
                  '*S-1-5-32-544:(OI)(CI)F'])
    require(result.returncode == 0, 'PRIVATE_DIRECTORY_ACL_FAILED')


def safe_root(value):
    p = Path(value)
    require(p.is_absolute() and p.is_dir(), 'BACKUP_MEDIA_UNAVAILABLE')
    require('strathos' not in [s.lower() for s in p.parts], 'UNSAFE_BACKUP_ROOT')
    for ancestor in [p, *p.parents]:
        require(not ancestor.is_symlink() and not ancestor.is_junction(), 'REPARSE_BACKUP_ROOT')
    return p.resolve()


def disk_number(path):
    drive = path.drive.rstrip(':')
    require(re.fullmatch('[A-Za-z]', drive) is not None, 'LOCAL_MEDIA_REQUIRED')
    result = run(['powershell.exe', '-NoProfile', '-Command',
                  '(Get-Partition -DriveLetter ' + drive + ' -ErrorAction Stop).DiskNumber'])
    value = result.stdout.decode().strip()
    require(result.returncode == 0 and value.isdigit(), 'PHYSICAL_DISK_UNVERIFIED')
    return int(value)


def digest(stream, sink=None, limit=MAX_BYTES):
    count, sha = 0, hashlib.sha256()
    while True:
        chunk = stream.read(65536)
        if not chunk:
            break
        count += len(chunk)
        require(count <= limit, 'STREAM_SIZE_LIMIT')
        sha.update(chunk)
        if sink is not None:
            sink.write(chunk)
    return {'bytes': count, 'sha256': sha.hexdigest()}


def file_digest(path):
    with path.open('rb') as source:
        return digest(source)


def encrypt(age, recipient, source, dest, limit=MAX_BYTES):
    require(not dest.exists(), 'ARCHIVE_ALREADY_EXISTS')
    child = subprocess.Popen([str(age), '-r', recipient, '-o', str(dest)],
                             stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                             stderr=subprocess.PIPE)
    try:
        evidence = digest(source, child.stdin, limit)
        child.stdin.close()
        child.stdin = None
        child.communicate(timeout=60)
        require(child.returncode == 0, 'AGE_ENCRYPT_FAILED')
        return evidence
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
        for stream in (child.stdin, child.stdout, child.stderr):
            if stream is not None:
                stream.close()


def decrypt(age, identity, archive, collect=False):
    child = subprocess.Popen([str(age), '-d', '-i', '-', str(archive)],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE)
    try:
        child.stdin.write((identity.strip() + '\n').encode())
        child.stdin.close()
        child.stdin = None
        sink = io.BytesIO() if collect else None
        evidence = digest(child.stdout, sink, 1024 * 1024 if collect else MAX_BYTES)
        child.stdout.close()
        child.wait(timeout=60)
        require(child.returncode == 0, 'AGE_AUTHENTICATION_FAILED')
        return sink.getvalue() if collect else evidence
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
        for stream in (child.stdin, child.stdout, child.stderr):
            if stream is not None:
                stream.close()


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise Blocked('STORAGE_REDIRECT_REFUSED')


def api(opener, key, route, payload=None):
    require(route.startswith(('object/list/', 'object/authenticated/')), 'UNSAFE_API_ROUTE')
    headers = {'apikey': key, 'Accept-Encoding': 'identity'}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    body = None if payload is None else json.dumps(payload).encode()
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = request.Request('https://' + PROJECT + '.supabase.co/storage/v1/' + route,
                          data=body, headers=headers, method='GET' if body is None else 'POST')
    try:
        return opener.open(req, timeout=90)
    except Blocked:
        raise
    except Exception as exc:
        code = getattr(exc, 'code', None)
        raise Blocked('STORAGE_ACCESS_DENIED' if code in (401, 403) else 'STORAGE_REQUEST_FAILED') from None


def inventory(settings, password):
    require(settings['host'].endswith('.pooler.supabase.com') and
            settings['user'] == 'postgres.' + PROJECT and int(settings['port']) == 5432,
            'DATABASE_SOURCE_IDENTITY_MISMATCH')
    pg = Path(os.environ['LOCALAPPDATA']) / 'OJWorkspace/tools/pg17/portable/pgsql/bin/psql.exe'
    env = os.environ.copy()
    env.update(PGPASSWORD=password, PGSSLMODE='require', PGCONNECT_TIMEOUT='20',
               PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=30000')
    sql = """SELECT coalesce(json_agg(x ORDER BY name),'[]'::json) FROM
      (SELECT o.id::text, o.name, o.bucket_id, o.updated_at::text,
       (o.metadata->>'size')::bigint AS size, b.public
       FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id
       WHERE o.bucket_id='oj-documents') x;"""
    result = run([str(pg), '-X', '-w', '-A', '-t', '-h', settings['host'], '-p', '5432',
                  '-U', settings['user'], '-d', 'postgres', '-c', sql], env=env)
    require(result.returncode == 0, 'READONLY_CATALOG_UNAVAILABLE')
    rows = json.loads(result.stdout)
    require(len(rows) == EXPECTED_COUNT and sum(x['size'] for x in rows) == EXPECTED_BYTES,
            'SOURCE_INVENTORY_CHANGED')
    require(all(not x['public'] for x in rows), 'PRIVATE_BUCKET_REQUIRED')
    return rows


def storage_inventory(opener, key):
    found, pending, visited, pages = [], [''], set(), 0
    while pending:
        prefix = pending.pop()
        require(prefix not in visited, 'API_INVENTORY_CYCLE')
        visited.add(prefix)
        require(len(found) + len(pending) < 100, 'API_INVENTORY_LIMIT')
        offset = 0
        while True:
            pages += 1
            require(pages <= 100, 'API_INVENTORY_LIMIT')
            with api(opener, key, 'object/list/' + BUCKET,
                     {'prefix': prefix, 'limit': 100, 'offset': offset,
                      'sortBy': {'column': 'name', 'order': 'asc'}}) as response:
                page = json.load(response)
            require(isinstance(page, list), 'API_INVENTORY_INVALID')
            for obj in page:
                name = prefix + obj['name']
                if obj.get('id') is None:
                    pending.append(name.rstrip('/') + '/')
                else:
                    found.append((obj['id'], name, int(obj['metadata']['size'])))
            if len(page) < 100:
                break
            offset += 100
            require(offset <= 1000, 'API_INVENTORY_LIMIT')
    return sorted(found)


def restore_mirror(age, identity, mirror_dir, primary):
    """Separate local readback path: deliberately takes no HTTP/DB credentials."""
    recovered = json.loads(decrypt(age, identity, mirror_dir / 'manifest.json.age', collect=True))
    require(recovered['project_ref'] == PROJECT and recovered['bucket'] == BUCKET,
            'RECOVERY_MANIFEST_IDENTITY_MISMATCH')
    records = recovered['objects']
    require(len(records) == EXPECTED_COUNT, 'RECOVERY_MANIFEST_COUNT_MISMATCH')
    recovery_dir = primary / ('storage-isolated-readback-' + uuid.uuid4().hex)
    protect(recovery_dir)
    seen = set()
    for record in records:
        name = record['archive']
        require(re.fullmatch(r'object-[1-9][0-9]*\.age', name) and name not in seen,
                'RECOVERY_MANIFEST_PATH_INVALID')
        seen.add(name)
        src, dst = mirror_dir / name, recovery_dir / name
        with src.open('rb') as reader, dst.open('xb') as writer:
            shutil.copyfileobj(reader, writer)
        require(file_digest(dst) == record['ciphertext'], 'RECOVERY_CIPHERTEXT_MISMATCH')
        require(decrypt(age, identity, dst) == record['plaintext'], 'RESTORED_PLAINTEXT_MISMATCH')
    require(sum(x['plaintext']['bytes'] for x in records) == EXPECTED_BYTES,
            'RECOVERY_MANIFEST_BYTES_MISMATCH')
    return recovered


def execute(verify_only=False):
    require(os.name == 'nt', 'WINDOWS_REQUIRED')
    private = Path(os.environ['APPDATA']) / 'OJWorkspace/supabase-backup'
    settings = json.loads((private / 'settings.json').read_text(encoding='utf-8-sig'))
    require(settings['project_ref'] == PROJECT and settings['archive_encryption'] == 'age-v1',
            'PROJECT_CONFIG_MISMATCH')
    identity = dpapi(private / 'age-identity.dpapi')
    age = Path(os.environ['LOCALAPPDATA']) / 'OJWorkspace/tools/age/1.3.2/age/age.exe'
    require(run([str(age), '--version']).stdout.strip() in (b'v1.3.2', b'1.3.2'), 'AGE_VERSION_INVALID')
    primary, mirror = (safe_root(settings[k]) for k in ('backup_directory', 'offsite_directory'))
    require(disk_number(primary) != disk_number(mirror), 'SEPARATE_PHYSICAL_MEDIA_REQUIRED')
    if verify_only:
        candidates = sorted((p for p in mirror.glob('storage-*')
                             if (p / 'sanitized-receipt.json').is_file()),
                            key=lambda p: p.stat().st_mtime, reverse=True)
        require(bool(candidates), 'COMPLETED_STORAGE_MIRROR_MISSING')
        restore_mirror(age, identity, candidates[0], primary)
        print('OJ_STORAGE_INDEPENDENT_MIRROR_RESTORE=PASS\nOJ_STORAGE_HASH_AND_SIZE=PASS')
        return
    key = dpapi(private / 'storage-key.dpapi').strip()
    require(bool(key) and '\n' not in key and '\r' not in key, 'STORAGE_CREDENTIAL_INVALID')
    password = dpapi(private / 'password.dpapi')
    before = inventory(settings, password)
    opener = request.build_opener(NoRedirect())
    expected = sorted((x['id'], x['name'], x['size']) for x in before)
    require(storage_inventory(opener, key) == expected, 'API_CATALOG_INVENTORY_MISMATCH')
    batch = 'storage-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex
    source_dir, mirror_dir = primary / batch, mirror / batch
    protect(source_dir)
    records = []
    for i, obj in enumerate(before):
        route = 'object/authenticated/' + BUCKET + '/' + parse.quote(obj['name'], safe='/')
        archive = source_dir / ('object-' + str(i + 1) + '.age')
        with api(opener, key, route) as response:
            proof = encrypt(age, settings['age_recipient'], response, archive)
        require(proof['bytes'] == obj['size'], 'DOWNLOADED_BYTE_COUNT_MISMATCH')
        records.append(dict(obj, archive=archive.name, plaintext=proof, ciphertext=file_digest(archive)))
    require(inventory(settings, password) == before, 'SOURCE_CHANGED_DURING_DOWNLOAD')
    require(storage_inventory(opener, key) == expected, 'API_SOURCE_CHANGED_DURING_DOWNLOAD')
    manifest = {'version': 1, 'project_ref': PROJECT, 'bucket': BUCKET,
                'created_utc': datetime.now(timezone.utc).isoformat(), 'objects': records}
    encrypted_manifest = source_dir / 'manifest.json.age'
    encrypt(age, settings['age_recipient'], io.BytesIO(json.dumps(manifest).encode()), encrypted_manifest)
    protect(mirror_dir)
    for src in source_dir.iterdir():
        dst = mirror_dir / src.name
        with src.open('rb') as reader, dst.open('xb') as writer:
            shutil.copyfileobj(reader, writer)
        require(file_digest(src) == file_digest(dst), 'ENCRYPTED_MIRROR_MISMATCH')
    # Fresh disposable local target: no HTTP client or credentials passed to the
    # restore operation. Only ciphertext and the recovery identity are used.
    recovered = restore_mirror(age, identity, mirror_dir, primary)
    require(recovered == manifest, 'RESTORED_MANIFEST_MISMATCH')
    receipt = {'storage_byte_recovery': 'PASS', 'downloaded_objects': len(records),
               'plaintext_bytes': sum(x['plaintext']['bytes'] for x in records),
               'encrypted_separate_disk_copy': 'PASS', 'independent_readback_from_mirror': 'PASS',
               'plaintext_hash_and_size_match': 'PASS', 'production_objects_modified': False,
               'off_pc_custody': 'UNVERIFIED', 'full_activation_gate': 'BLOCKED'}
    # Success receipt is last; failed/incomplete batches are preserved without one.
    with (source_dir / 'sanitized-receipt.json').open('x', encoding='utf-8') as handle:
        json.dump(receipt, handle, indent=2)
    with (mirror_dir / 'sanitized-receipt.json').open('x', encoding='utf-8') as handle:
        json.dump(receipt, handle, indent=2)
    print(json.dumps(receipt, sort_keys=True))


if __name__ == '__main__':
    try:
        require(sys.argv[1:] in ([], ['--verify-mirror']), 'UNSUPPORTED_ARGUMENTS')
        execute(verify_only=sys.argv[1:] == ['--verify-mirror'])
    except Blocked as exc:
        print('OJ_STORAGE_RECOVERY=BLOCKED\nOJ_STORAGE_CODE=' + str(exc))
        sys.exit(1)
    except Exception:
        print('OJ_STORAGE_RECOVERY=FAIL\nOJ_STORAGE_CODE=LOCAL_RUNTIME_OR_PREREQUISITE')
        sys.exit(1)
