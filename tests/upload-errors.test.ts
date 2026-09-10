import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadError } from '../apps/web/app/utils/upload-errors.mjs';
await test('upload feedback maps all failed indices to original file names and keeps gate failures common', () => {
  const files = [{ name: '정상.png' }, { name: '초과.gif' }, { name: '손상.jpg' }];
  const result = uploadError(
    {
      code: 'UPLOAD_TOO_LARGE',
      fields: [
        { field: 'files[1]', reason: 'fileSize' },
        { field: 'files[2]', reason: 'decode' },
      ],
    },
    files
  );
  assert.deepEqual(
    result.details.map((x) => x.name),
    ['초과.gif', '손상.jpg']
  );
  assert.ok(result.details[0]);
  assert.match(result.details[0].reason, /10MiB/);
  assert.ok(result.details[1]);
  assert.match(result.details[1].reason, /읽을 수 없/);
  assert.match(result.message, /전체 파일/);
  assert.deepEqual(uploadError({ code: 'UPLOAD_TOO_LARGE' }, files).details, []);
  assert.match(uploadError({ code: 'UPLOAD_TOO_LARGE' }, files).message, /100MiB/);
  assert.deepEqual(
    uploadError(
      { code: 'DEPENDENCY_UNAVAILABLE', fields: [{ field: 'files[0]', reason: 'decode' }] },
      files
    ).details,
    []
  );
  assert.match(uploadError({ code: 'DEPENDENCY_UNAVAILABLE' }, files).message, /저장소/);
  assert.equal(
    uploadError(
      { code: 'UNSUPPORTED_MEDIA_TYPE', fields: [{ field: 'files[2]', reason: 'format' }] },
      files
    ).details[0]?.name,
    '손상.jpg'
  );
});
