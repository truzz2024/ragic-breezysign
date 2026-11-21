import test from 'node:test';
import assert from 'node:assert/strict';
import { signedDocumentName, safeDocumentStem, completionDate } from '../src/result-file-name.js';

test('signed PDF filename from actual completion date (Taipei)', () => {
  const info={endDate:'2026-11-21T16:15:00Z', data:[]};
  assert.equal(signedDocumentName(info,'客戶確認書','getResult'),'20261122_客戶確認書_已簽署.pdf');
});
test('track PDF filename uses the same completion date and task name', () => {
  const info={endDate:'2026-11-21T11:58:00+00:00',data:[]};
  assert.equal(signedDocumentName(info,'銷售訂單','getTrack'),'20261121_銷售訂單_簽署軌跡.pdf');
});
test('fallback to final signer endTime, not sync time', () => {
  const info={data:[
    {currentStatus:'DONE',endTime:'2026-11-20T12:00:00Z'},
    {currentStatus:'DONE',endTime:'2026-11-21T13:01:00Z'}
  ]};
  assert.equal(completionDate(info),'20261121');
});
test('plain local timestamp is read in Taiwan timezone',()=>{
  assert.equal(completionDate({endDate:'2026/11/21 23:57:08'}),'20261121');
});
test('sanitize Windows filename invalid characters and .pdf suffix',()=>{
  assert.equal(safeDocumentStem('訂單:A/B? 2026.pdf'),'訂單_A_B_ 2026');
});
test('long file name is truncated on UTF-8 byte boundaries',()=>{
  assert.ok(new TextEncoder().encode(safeDocumentStem('你好'.repeat(100))).length<=160);
});
test('missing completion date does not silently substitute sync date',()=>{
  assert.throws(()=>signedDocumentName({},'訂單','getResult'),/尚未提供簽署完成時間/);
});
test('invalid kind rejected',()=>{
  assert.throws(()=>signedDocumentName({endDate:'2026-11-21T00:00:00Z'},'a','getUnknown'),/不支援/);
});
