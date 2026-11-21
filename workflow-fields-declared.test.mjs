import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

for (const file of ['ragic/action-buttons.js', 'ragic/post-workflow.js']) {
  test(file + ' 所有 F.xxx 皆有宣告', () => {
    const src=readFileSync(new URL('../'+file, import.meta.url), 'utf8');
    const fblock=src.match(/var F = \{([\s\S]*?)\n  \};/);
    assert.ok(fblock, '缺少欄位設定區');
    const keys=new Set([...fblock[1].matchAll(/^\s*(\w+):\s*\d+/gm)].map(x=>x[1]));
    const accessed=new Set([...src.matchAll(/\bF\.(\w+)\b/g)].map(x=>x[1]));
    assert.deepEqual([...accessed].filter(key=>!keys.has(key)), []);
  });
}
