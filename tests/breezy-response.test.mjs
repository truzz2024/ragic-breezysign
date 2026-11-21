import test from 'node:test';
import assert from 'node:assert/strict';
import { responseJSON } from '../src/breezy.js';
const mock = (d,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(d)});
test('official success code 0 is accepted', async()=> {
  assert.deepEqual(await responseJSON(mock({errorCode:0,body:{instanceId:'UUID-0'},message:'OK'}),'create'),{instanceId:'UUID-0'});
});
test('string success code SUCCESS is accepted', async()=> {
  assert.deepEqual(await responseJSON(mock({errorCode:'SUCCESS',body:{instanceId:'UUID-1'},message:'SUCCESS'}),'create'),{instanceId:'UUID-1'});
});
test('string success code 0 is accepted', async()=> {
  assert.deepEqual(await responseJSON(mock({errorCode:'0',body:{instanceId:'UUID-2'}}),'create'),{instanceId:'UUID-2'});
});
test('API error still rejects', async()=> {
  await assert.rejects(responseJSON(mock({errorCode:'CONTENTS_ID_ERROR',message:'CONTENTS_ID_ERROR'},422),'create'),/CONTENTS_ID_ERROR/);
});
test('HTTP error rejects even with SUCCESS code', async()=> {
  await assert.rejects(responseJSON(mock({errorCode:'SUCCESS',message:'SUCCESS'},500),'create'),/HTTP 500/);
});
test('message SUCCESS with body is accepted even without errorCode', async()=> {
  assert.deepEqual(await responseJSON(mock({message:'SUCCESS',body:{instanceId:'UUID-3'}}),'create'),{instanceId:'UUID-3'});
});
test('message SUCCESS without code and without body is rejected', async()=> {
  await assert.rejects(responseJSON(mock({message:'SUCCESS'}),'create'),/errorCode undefined/);
});
