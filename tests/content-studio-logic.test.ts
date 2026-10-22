import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshContentDraft, validateContentDraft, isContentLate,
  contentStages, contentKinds, contentPlatforms,
} from '../src/lib/content-studio';

test('content editor starts as a private idea, not a published video', () => {
  const draft = freshContentDraft();
  assert.equal(draft.id, null);
  assert.equal(draft.stage, 'Idea');
  assert.equal(draft.published_url, '');
  assert.equal(draft.published_at, null);
  assert.ok(contentStages.includes('Published'));
  assert.ok(contentKinds.includes('Video'));
  assert.ok(contentPlatforms.includes('YouTube'));
});

test('a valid scripted project stays editable without public distribution', () => {
  const saved = validateContentDraft({
    ...freshContentDraft(), title: 'Episode one', stage: 'Script',
    summary: 'A day in the life', script: 'Introduction and scene list',
    platforms: ['YouTube', 'TikTok'],
    target_publish_on: '2026-11-15',
  });
  assert.equal(saved.stage, 'Script');
  assert.deepEqual(saved.platforms, ['YouTube','TikTok']);
  assert.equal(saved.published_at, null);
});

test('published state requires an explicit https link and recorded timestamp', () => {
  const base = { ...freshContentDraft(), title: 'Published pilot', stage: 'Published' };
  assert.throws(() => validateContentDraft(base), /published link/i);
  assert.throws(() => validateContentDraft({
    ...base, published_url: 'javascript:alert(1)', published_at: '2026-10-22T12:00:00Z',
  }), /HTTPS/i);
  assert.throws(() => validateContentDraft({
    ...base, published_url: 'http://example.com', published_at: '2026-10-22T12:00:00Z',
  }), /HTTPS/i);
  const valid = validateContentDraft({
    ...base, published_url: 'https://www.youtube.com/watch?v=testing123',
    published_at: '2026-10-22T12:00:00Z',
  });
  assert.equal(valid.stage, 'Published');
  assert.equal(valid.published_at, '2026-10-22T12:00:00.000Z');
});

test('prohibit invalid assignees, duplicate platforms and revision tampering', () => {
  const base = { ...freshContentDraft(), title: 'Checked' };
  assert.throws(() => validateContentDraft({ ...base, assigned_to: 'Jacob' }), /teammate/);
  assert.throws(() => validateContentDraft({ ...base, platforms: ['YouTube', 'YouTube'] }), /platform/);
  assert.throws(() => validateContentDraft({ ...base, revision: -1 }), /revision/);
  assert.throws(() => validateContentDraft({ ...base, id: 'wrong' }), /Invalid content/);
  assert.throws(() => validateContentDraft({ ...base, stage: 'Fake published' }), /production stage/);
});

test('reject oversized text, impossible dates and malformed timestamps', () => {
  const base = { ...freshContentDraft(), title: 'Checked' };
  assert.throws(() => validateContentDraft({ ...base, title: 'x'.repeat(181) }), /Project title/);
  assert.throws(() => validateContentDraft({ ...base, summary: 'x'.repeat(3001) }), /Brief/);
  assert.throws(() => validateContentDraft({ ...base, target_publish_on: '2026-02-30' }), /release date/);
  assert.throws(() => validateContentDraft({ ...base, shoot_at: 'not a time' }), /shoot time/);
});

test('late badges depend only on actual date and production status', () => {
  const today = '2026-10-22';
  assert.equal(isContentLate({ target_publish_on: '2026-10-21', stage: 'Editing' }, today), true);
  assert.equal(isContentLate({ target_publish_on: '2026-10-22', stage: 'Editing' }, today), false);
  assert.equal(isContentLate({ target_publish_on: '2026-10-21', stage: 'Published' }, today), false);
  assert.equal(isContentLate({ target_publish_on: null, stage: 'Idea' }, today), false);
});
