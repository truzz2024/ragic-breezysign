import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../ragic/action-buttons.js',import.meta.url),'utf8');
function harness(action,result) {
  const messages=[];
  const response={setStatus(s){this.status=s},setMessage(s){messages.push(s)}};
  const context={response};
  runInNewContext(source,context);
  context.BreezyModule[action] = () => {if(result instanceof Error)throw result;return result;};
  const output=context['breezy'+action[0].toUpperCase()+action.slice(1)](42);
  return {status:response.status,messages,output};
}
test('start success is readable Chinese and returns no object',()=>{
  const r=harness('start',{ok:true,instanceId:'id'});
  assert.equal(r.output,undefined); assert.equal(r.status,'SUCCESS');
  assert.deepEqual(r.messages,['簽署任務已成功發起。']);
});
test('sync success has text status and no object string',()=>{
  const r=harness('sync',{ok:true,status:'簽署完成',filesPending:[]});
  assert.equal(r.status,'SUCCESS');
  assert.equal(r.messages[0],'簽署狀態同步完成：簽署完成');
});
test('cancel success returns a message',()=>{
  const r=harness('cancel',{ok:true});
  assert.equal(r.messages[0],'簽署任務已成功取消。');
});
test('business validation failure omits Error prefix and line details',()=>{
  const r=harness('start',new Error('已存在好好簽任務 ID，禁止再次發起'));
  assert.equal(r.output,undefined); assert.equal(r.status,'ERROR');
  assert.deepEqual(r.messages,['已存在好好簽任務 ID，禁止再次發起']);
});
test('engine-decorated error is cleaned',()=>{
  const r=harness('sync',new Error('Error: 已存在任務 in Installed Sheet Scope at line number 118 at column number 40'));
  assert.deepEqual(r.messages,['已存在任務']);
});
