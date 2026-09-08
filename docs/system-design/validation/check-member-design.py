"""Offline design checks only: no app, PostgreSQL, provider or production access."""
from pathlib import Path
from itertools import product
from datetime import date, datetime
from zoneinfo import ZoneInfo
import json, re, sqlite3, unicodedata, hashlib
ROOT = Path(__file__).resolve().parents[3]
s = (ROOT/'docs/planning/09-random-name-catalog.md').read_text()
prefix = s.split('## 2. 장소·상황 32개\n\n')[1].split('\n\n')[0].rstrip('.').split(', ')
mods = s.split('## 3. 수식어 64개\n\n')[1].split('\n\n')[0].rstrip('.').split(', ')
nouns = []
for line in s.split('## 4. 명사 128개')[1].split('## 5.')[0].splitlines():
    if line.startswith('| ') and not line.startswith(('| 범위','| ---')):
        nouns.extend(line.split('|')[2].strip().split(', '))
assert (len(prefix),len(mods),len(nouns)) == (32,64,128)
# Exact terms / substrings for the explicitly forbidden categories, not a universal safety classifier.
blocked = '관리자 운영자 공식 글쓴이 병신 시발 씨발 개새끼 장애인 흑인 백인 조선족 강간 살인 자살 성기 정액 나치 히틀러'.split()
labels = [' '.join(parts) for parts in product(prefix,mods,nouns)]
assert len(set(labels)) == 262144
assert all(unicodedata.normalize('NFC',x)==x and re.fullmatch('[가-힣 ]+',x) and len(x)<=32 for x in labels)
suspects = [x for x in labels if any(t in x.replace(' ','') for t in blocked)]
assert not suspects
checks = 0
def check(ok):
    global checks
    assert ok
    checks += 1

string_checks = 0
def check_string(ok):
    global string_checks
    assert ok
    string_checks += 1

ECMASCRIPT_TRIM_CODE_POINTS = {
    0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680,
    *range(0x2000, 0x200B), 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
}

def ecmascript_trim(value):
    start, end = 0, len(value)
    while start < end and ord(value[start]) in ECMASCRIPT_TRIM_CODE_POINTS:
        start += 1
    while end > start and ord(value[end - 1]) in ECMASCRIPT_TRIM_CODE_POINTS:
        end -= 1
    return value[start:end]

def canonical_text(raw, multiline=False):
    # Design model for the documented order. Core/JS/PostgreSQL integration remains untested.
    if '\x00' in raw or any(0xD800 <= ord(ch) <= 0xDFFF for ch in raw):
        raise ValueError('invalid Unicode scalar sequence')
    if multiline:
        raw = raw.replace('\r\n', '\n').replace('\r', '\n').replace('\u2028', '\n').replace('\u2029', '\n')
    elif any(ch in '\r\n\u2028\u2029' for ch in raw):
        raise ValueError('single-line separator')
    for ch in raw:
        cp = ord(ch)
        if (cp <= 0x1F or 0x7F <= cp <= 0x9F) and not (multiline and ch == '\n'):
            raise ValueError('control character')
    return ecmascript_trim(unicodedata.normalize('NFC', raw))

def code_point_count(value):
    # Python 3 len() counts Unicode code points for these well-formed scalar fixtures.
    return len(value)

def valid_length(raw, minimum, maximum, multiline=False):
    count = code_point_count(canonical_text(raw, multiline))
    return minimum <= count <= maximum

for raw, multiline, canonical, count in [
    ('  가  ', False, '가', 1),
    ('\u1100\u1161', False, '가', 1),
    ('e\u0301', False, 'é', 1),
    ('😀', False, '😀', 1),
    ('👨\u200d👩\u200d👧\u200d👦', False, '👨\u200d👩\u200d👧\u200d👦', 7),
    ('가\r\n나\r다', True, '가\n나\n다', 5),
    ('가\u2028나\u2029다', True, '가\n나\n다', 5),
    ('\ufeff가\ufeff', False, '가', 1),
]:
    value = canonical_text(raw, multiline)
    check_string(value == canonical and code_point_count(value) == count)
for minimum, limit in ((2, 20), (1, 32), (1, 200), (1, 300), (0, 500), (1, 1000), (1, 10000)):
    check_string(valid_length('😀' * limit, minimum, limit))
    check_string(not valid_length('😀' * (limit + 1), minimum, limit))
for raw, multiline in [('\ud800', False), ('\udc00', False), ('\x00', False), ('a\nb', False), ('a\x01b', True), ('a\x85b', True), ('\x1c가', False), ('\x85가', False), ('\t가', False), ('a\u2028b', False), ('a\u2029b', False), ('\u2028가', False), ('가\u2029', False)]:
    try:
        canonical_text(raw, multiline)
    except ValueError:
        check_string(True)
    else:
        raise AssertionError(repr(raw))

restriction_checks = 0
def check_restriction(ok):
    global restriction_checks
    assert ok
    restriction_checks += 1

def is_restricted(status, starts_at, ends_at, now):
    return status == 'ACTIVE' and starts_at <= now and (ends_at is None or ends_at > now)

now = datetime.fromisoformat('2026-09-08T12:00:00+00:00')
past = datetime.fromisoformat('2026-09-08T11:00:00+00:00')
future = datetime.fromisoformat('2026-09-08T13:00:00+00:00')
for status, starts_at, ends_at, want in [
    ('ACTIVE', past, None, True),
    ('ACTIVE', past, future, True),
    ('ACTIVE', past, now, False),
    ('ACTIVE', future, None, False),
    ('REVOKED', past, None, False),
    ('REVOKED', past, future, False),
]:
    check_restriction(is_restricted(status, starts_at, ends_at, now) == want)

def age_ok(birth, today):
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', birth): raise ValueError('date format')
    born = date.fromisoformat(birth)
    if born > today: raise ValueError('future')
    return today.year-born.year-((today.month,today.day)<(born.month,born.day)) >= 14
for birth,today,want in [('2012-09-08','2026-09-07',False),('2012-09-08','2026-09-08',True),('2012-09-08','2026-09-09',True),('2012-02-29','2026-02-28',False),('2012-02-29','2026-03-01',True),('2013-01-01','2026-12-31',False)]:
    check(age_ok(birth,date.fromisoformat(today))==want)
for birth in ['2012-02-30','2027-01-01','2012-9-8','', '2011-02-29']:
    try: age_ok(birth,date(2026,9,8))
    except ValueError: check(True)
    else: raise AssertionError(birth)
for instant,want in [('2026-09-07T14:59:59+00:00',False),('2026-09-07T15:00:00+00:00',True)]:
    check(age_ok('2012-09-08',datetime.fromisoformat(instant).astimezone(ZoneInfo('Asia/Seoul')).date())==want)
# SQLite models only the proposed uniqueness/FK constraints, NOT PostgreSQL locking or migrations.
db=sqlite3.connect(':memory:'); db.execute('PRAGMA foreign_keys=ON')
db.executescript('''CREATE TABLE account(id INTEGER PRIMARY KEY);
CREATE TABLE participant(id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, account_id INTEGER REFERENCES account(id), label TEXT NOT NULL, UNIQUE(post_id,label), UNIQUE(post_id,id));
CREATE UNIQUE INDEX per_member_post ON participant(post_id,account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX per_member_label ON participant(account_id,label) WHERE account_id IS NOT NULL;
CREATE TABLE author(post_id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL, FOREIGN KEY(post_id,participant_id) REFERENCES participant(post_id,id));
INSERT INTO account VALUES(1),(2);
INSERT INTO participant VALUES(1,10,1,'달빛 아래 느긋한 수달');
INSERT INTO author VALUES(10,1);''')
def rejected(sql):
    try: db.execute(sql)
    except sqlite3.IntegrityError: check(True)
    else: raise AssertionError(sql)
rejected("INSERT INTO participant VALUES(2,10,2,'달빛 아래 느긋한 수달')")
rejected("INSERT INTO participant VALUES(2,11,1,'달빛 아래 느긋한 수달')")
rejected("INSERT INTO participant VALUES(2,10,1,'별빛 아래 느긋한 수달')")
rejected('INSERT INTO author VALUES(11,1)')
rejected('DELETE FROM account WHERE id=1')
db.execute("INSERT INTO participant VALUES(2,11,1,'별빛 아래 느긋한 수달')")
check(db.execute('SELECT COUNT(*) FROM participant WHERE account_id=1').fetchone()[0]==2)
db.execute('UPDATE participant SET account_id=NULL WHERE account_id=1');db.execute('DELETE FROM account WHERE id=1')
check(db.execute('SELECT label FROM author JOIN participant ON participant.id=author.participant_id WHERE author.post_id=10').fetchone()[0]=='달빛 아래 느긋한 수달')
rejected("INSERT INTO participant VALUES(3,10,2,'달빛 아래 느긋한 수달')")
# Detect malformed Markdown tables in changed member/privacy documents (ignore pipes inside code).
files=[ROOT/'docs/legal/README.md', ROOT/'docs/legal/signup-privacy-consent.md',ROOT/'docs/planning/09-random-name-catalog.md']
for p in files:
    width=None
    for n,line in enumerate(p.read_text().splitlines(),1):
        if line.startswith('|'):
            count=len(re.sub(r'`[^`]*`','CODE',line).split('|'))-2
            if width is None: width=count
            assert count==width, (str(p),n,count,width)
        else: width=None
print(json.dumps({'kind':'offline_design_model_not_implementation','name_combinations':len(labels),'max_name_length_code_points':max(map(len,labels)),'explicit_blocklist_hits':len(suspects),'catalog_sha256':hashlib.sha256(s.encode()).hexdigest(),'unicode_string_contract_checks':string_checks,'restriction_predicate_checks':restriction_checks,'age_and_sqlite_constraint_checks':checks,'markdown_tables':'pass','javascript_runtime':'not_tested_by_this_python_script','postgresql_provider_runtime':'not_tested'},ensure_ascii=False,indent=2))
