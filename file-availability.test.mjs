import test from 'node:test';
import assert from 'node:assert/strict';
import { isTemporarilyMissingFile, describeFileIssue, retryableFileDelaysMs } from '../src/file-availability.js';

test('getTrack FILE_NOT_FOUND is retryable',()=>{
  assert.equal(isTemporarilyMissingFile(new Error('好好簽 getTrack 失敗：FILE_NOT_FOUND')),true);
});
test('other errors are not retried',()=>{
  assert.equal(isTemporarilyMissingFile(new Error('好好簽 getTrack 失敗：INVALID_API_KEY')),false);
});
test('error logs redact detail',()=>{
  assert.equal(describeFileIssue(new Error('好好簽 getTrack 失敗：FILE_NOT_FOUND')), 'FILE_NOT_FOUND');
  assert.equal(describeFileIssue(new Error('some secret token')), 'DOWNLOAD_OR_UPLOAD_FAILED');
});
test('retry bounded to under 7 seconds',()=>{
  assert.deepEqual(retryableFileDelaysMs,[900,1800,3000]);
  assert.ok(retryableFileDelaysMs.reduce((a,b)=>a+b,0)<7000);
});
