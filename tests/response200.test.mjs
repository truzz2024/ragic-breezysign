import test from 'node:test';
import assert from 'node:assert/strict';
import {responseJSON} from '../src/breezy.js';
const mock = (code, body = {instanceId: 'test-uuid'}) => new Response(JSON.stringify({errorCode:code, message:'SUCCESS', body}), {status:200});
test('200 number accepted', async () => assert.deepEqual(await responseJSON(mock(200),'test'),{instanceId:'test-uuid'}));
test('200 string accepted', async () => assert.deepEqual(await responseJSON(mock('200'),'test'),{instanceId:'test-uuid'}));
test('0 number accepted', async () => assert.deepEqual(await responseJSON(mock(0),'test'),{instanceId:'test-uuid'}));
test('SUCCESS accepted', async () => assert.deepEqual(await responseJSON(mock('SUCCESS'),'test'),{instanceId:'test-uuid'}));
test('422 rejected', async () => assert.rejects(()=>responseJSON(mock(422),'test')));
