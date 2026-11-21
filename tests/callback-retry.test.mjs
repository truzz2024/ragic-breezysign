import test from 'node:test';
import assert from 'node:assert/strict';
import { expectsFinalCompletion, isTerminalSyncState, describeSync, retryDelaysMs } from '../src/callback-retry.js';

test('DONE callback expects final',()=>assert.equal(expectsFinalCompletion({status:'DONE'}),true));
test('PROCESSING callback with signed assignees is not proof of task completion',()=>assert.equal(expectsFinalCompletion({status:'PROCESSING',assignees:[{isSigned:true}]}),false));
test('PROCESSING with result true expects final',()=>assert.equal(expectsFinalCompletion({status:'PROCESSING',result:true}),true));
test('partial signed callback not final',()=>assert.equal(expectsFinalCompletion({status:'PROCESSING',assignees:[{isSigned:true},{isSigned:false}]}),false));
test('terminal statuses',()=>{assert.equal(isTerminalSyncState('簽署完成'),true);assert.equal(isTerminalSyncState('拒絕簽署'),true);assert.equal(isTerminalSyncState('簽署中'),false)});
test('diagnostics contain statuses, not signer emails/names',()=>{let x=describeSync('DONE',{result:false,data:[{currentStatus:'DONE',assigneeEmail:'secret@example.com',assigneeName:'Secret'},{currentStatus:'PROCESSING'}]},'簽署中');assert.equal(x.signerStatuses[0],'DONE');assert.equal(JSON.stringify(x).includes('secret'),false)});
test('bounded retry schedule',()=>{assert.equal(retryDelaysMs.length,4);assert.ok(retryDelaysMs.reduce((a,b)=>a+b,0)<=12000)});
