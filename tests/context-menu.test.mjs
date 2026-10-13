import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../web/src/utils/context-menu.ts', import.meta.url), 'utf8');
const { contextMenuPlacement: place } = await import('data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(source)).toString('base64'));

test('context bubbles point at their click and flip above the lower viewport edge', () => {
  const size = { width: 280, height: 200 }, viewport = { width: 1000, height: 800 };
  const below = place({ x: 300, y: 100 }, size, viewport);
  assert.equal(below.side, 'below');
  assert.equal(below.left + below.anchor, 300);
  assert.equal(below.top, 114);
  const above = place({ x: 990, y: 780 }, size, viewport);
  assert.equal(above.side, 'above');
  assert.ok(above.left + size.width <= viewport.width - 16);
  assert.equal(above.top + size.height, 766);
  assert.ok(above.anchor <= size.width - 24);
});

test('small-screen bubbles reserve space for their tail and scroll their content', () => {
  for (const viewport of [{ width: 320, height: 240 }, { width: 375, height: 812 }, { width: 844, height: 390 }]) {
    for (const point of [{ x: 0, y: 0 }, { x: viewport.width, y: viewport.height }, { x: viewport.width / 2, y: viewport.height / 2 }]) {
      const size = { width: 280, height: 700 };
      const result = place(point, size, viewport);
      const height = Math.min(size.height, result.maxHeight);
      assert.ok(result.left >= 16 && result.left + size.width <= viewport.width - 16);
      assert.ok(result.top >= 16 && result.top + height <= viewport.height - 16);
      assert.ok(result.anchor >= 24 && result.anchor <= size.width - 24);
      const tip = result.side === 'below' ? result.top - 10 : result.top + height + 10;
      assert.ok(tip >= 0 && tip <= viewport.height);
    }
  }
});
