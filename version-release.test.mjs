import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url),'utf8'));
const source = readFileSync(new URL('../src/index.js', import.meta.url),'utf8');

test('package.json 發行版號是 1.1.1', () => {
  assert.equal(pkg.version, '1.1.1');
});
test('/health 程式回傳版號與 package.json 一致', () => {
  // 靜態檢查：不需要在本地安裝 pdfjs-serverless，也避免在此測試呼叫付費 API。
  const health = source.match(/path\s*===\s*'\/health'[^\n]*version:\s*'([^']+)'/);
  assert.ok(health, '找不到 /health 版本回傳');
  assert.equal(health[1],pkg.version);
});
