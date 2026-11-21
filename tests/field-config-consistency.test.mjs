import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { F as WORKER_FIELDS } from '../src/config.js';

function source(name){return readFileSync(new URL('../ragic/'+name, import.meta.url),'utf8');}
function extractFields(code){
  const match=code.match(/var F = (\{[\s\S]*?\n  \});/);
  assert.ok(match, 'Ragic 欄位變數區存在');
  return new Function('return ('+match[1]+')')();
}
for(const name of ['action-buttons.js','post-workflow.js']){
  test(name+' 的欄位 ID 與 Worker 一致',()=>{
    const code=source(name);const fields=extractFields(code);
    for(const [key,value] of Object.entries(fields)){
      if(key in WORKER_FIELDS) assert.equal(value,WORKER_FIELDS[key], key);
    }
    // 欄位 ID 只能放在 Ragic 的 F 或 SETTING_FIELDS 定義，不得散落在流程中。
    const stripped=code.replace(/var F = \{[\s\S]*?\n  \};/, '')
      .replace(/var SETTING_FIELDS = \{[\s\S]*?\n  \};/, '');
    assert.doesNotMatch(stripped,/\b1001\d{3}\b/);
    assert.match(code,/addIgnoreMaskDomain\(SETTING_FIELDS\.workerToken\)/);
  });
}
test('Worker 不再寫入已刪除的簽署結果欄位 1001460',()=>{
  assert.equal(Object.values(WORKER_FIELDS).includes(1001460),false);
});
