import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {F} from '../src/config.js';

const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('簽署結果 1001460 已從欄位配置移除', () => {
  assert.equal(Object.hasOwn(F, 'result'), false);
  assert.equal(Object.values(F).includes(1001460), false);
});
test('狀態欄位仍保留', () => {
  assert.equal(F.status, 1001459);
  assert.equal(F.signerStatus, 1001474);
  assert.equal(F.apiStatus, 1001497);
});
test('同步流程不再寫入 F.result', () => {
  assert.equal(index.includes('[F.result]'), false);
  assert.ok(index.includes('[F.status]:state'));
});
