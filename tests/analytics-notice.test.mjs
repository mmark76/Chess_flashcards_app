import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/<script id="analytics-notice-persistence">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'Analytics notice script must exist.');

const noticeKey = 'chess-flashcards.analytics-notice-dismissed.v1';

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function visit(localStorage) {
  const notice = { hidden: true };
  let onClose;
  const closeButton = { addEventListener(name, handler) {
    assert.equal(name, 'click');
    onClose = handler;
  } };
  const document = {
    getElementById(id) {
      if (id === 'analytics-notice') return notice;
      if (id === 'analytics-notice-close') return closeButton;
      throw new Error('Unexpected element: ' + id);
    },
  };

  runInNewContext(source, { document, localStorage }, { filename: 'analytics-notice-persistence' });
  return { notice, close: () => onClose() };
}

test('first visit shows information; Close persists across refresh', () => {
  const storage = createMemoryStorage();
  const first = visit(storage);
  assert.equal(first.notice.hidden, false);
  first.close();
  assert.equal(first.notice.hidden, true);
  assert.equal(storage.getItem(noticeKey), '1');

  assert.equal(visit(storage).notice.hidden, true);
  storage.removeItem(noticeKey);
  assert.equal(visit(storage).notice.hidden, false);
});

test('blocked localStorage shows notice and Close still hides it', () => {
  const blocked = {
    getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Storage blocked'); },
  };
  const page = visit(blocked);
  assert.equal(page.notice.hidden, false);
  assert.doesNotThrow(() => page.close());
  assert.equal(page.notice.hidden, true);
});
