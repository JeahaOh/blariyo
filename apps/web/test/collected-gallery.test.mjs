import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaValidator } from '@blariyo/contracts';
import { editorErrors } from '../app/utils/editor-validation.mjs';

test('editing and API contract preserve 200 collected images and reject 201', () => {
  for (const count of [21, 49, 200, 201]) {
    const blocks = Array.from({ length: count }, (_, i) => ({ type: 'IMAGE', imageId: i + 1, alt: `image ${i + 1}` }));
    assert.equal(Boolean(editorErrors({ title: 'gallery', blocks }, '', '').blocks), count > 200);
    assert.equal(schemaValidator({ $ref: '#/components/schemas/EditBlocks' })(blocks), count <= 200);
  }
  assert.equal(schemaValidator({ $ref: '#/components/schemas/BatchContentBlock' })({ type: 'IMAGE', imagePosition: 200, alt: '' }), true);
  assert.equal(schemaValidator({ $ref: '#/components/schemas/BatchContentBlock' })({ type: 'IMAGE', imagePosition: 201, alt: '' }), false);
  assert.equal(schemaValidator({ $ref: '#/components/schemas/CollectionContentBlock' })({ type: 'IMAGE', imagePosition: 21, alt: '' }), false);
});
