import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const file = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = file.indexOf('function contentsFor(');
const end = file.indexOf('function stageError(', start);
assert.ok(start >= 0 && end > start, 'contentsFor must exist in src/index.js');
const contentsFor = new Function(file.slice(start, end) + '\nreturn contentsFor;')();
test('one page PDF with two signers uses page 1, signer ids start at 1', () => {
  const result = contentsFor({ matched: [
    { signer:1, page:1, box:{x:90,y:210,width:160,height:70} },
    { signer:2, page:1, box:{x:260,y:210,width:160,height:70} }
  ], unmatched: []}, [{name:'A'},{name:'B'}]);
  assert.equal(result.length, 1);
  assert.equal(result[0].page, 1);
  assert.deepEqual(result[0].data.map(x=>x.id), [1,2]);
});
test('two page PDF uses page 1 and page 2 without zero-based conversion', () => {
  const result = contentsFor({ matched:[
    {signer:1,page:1,box:{x:70,y:100,width:100,height:65}},
    {signer:1,page:2,box:{x:70,y:100,width:100,height:65}},
  ], unmatched:[]}, [{name:'A'}]);
  assert.deepEqual(result.map(x=>x.page), [1,2]);
});
