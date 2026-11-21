import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const text = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = text.indexOf('function contentsFor(');
const end = text.indexOf('function stageError(', start);
assert.ok(start >= 0 && end > start);
const contentsFor = new Function(text.slice(start, end) + '\nreturn contentsFor;')();
function marker(signer, page) { return {signer,page,box:{x:20*signer,y:50,width:100,height:60}}; }
test('one signer id = 1, page = 1',()=>{
 const c=contentsFor({matched:[marker(1,1)],unmatched:[]},[{name:'A'}]);
 assert.deepEqual(c.map(x=>x.page),[1]);
 assert.deepEqual(c[0].data.map(x=>x.id),[1]);
});
test('two signers id = 1,2, page = 1',()=>{
 const c=contentsFor({matched:[marker(1,1),marker(2,1)],unmatched:[]},[{name:'A'},{name:'B'}]);
 assert.deepEqual(c.map(x=>x.page),[1]);
 assert.deepEqual(c[0].data.map(x=>x.id),[1,2]);
});
test('repeated signer 1 on later page keeps id 1',()=>{
 const c=contentsFor({matched:[marker(1,1),marker(2,1),marker(1,2)],unmatched:[]},[{name:'A'},{name:'B'}]);
 assert.deepEqual(c.map(x=>x.page),[1,2]);
 assert.deepEqual(c[1].data.map(x=>x.id),[1]);
});
test('invalid signer marker fails preflight',()=>{
 assert.throws(()=>contentsFor({matched:[marker(1,1),marker(3,1)],unmatched:[]},[{name:'A'},{name:'B'}]),/沒有對應/);
});
