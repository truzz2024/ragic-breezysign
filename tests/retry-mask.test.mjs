import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=path.resolve(import.meta.dirname,'..');
const text=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const breezy=text('src/breezy.js').replace(/^import .+;\s*$/m,'');
const {responseJSON}=await import('data:text/javascript,'+encodeURIComponent(breezy));
function response(errorCode,status=200){return new Response(JSON.stringify({errorCode,message:String(errorCode),body:{instanceId:'test-uuid'}}),{status});}
test('好好簽 errorCode 200 是成功',async()=>{
  assert.equal((await responseJSON(response(200),'好好簽 createByPdf')).instanceId,'test-uuid');
});
test('createByPdf 明確錯誤碼（2xx）可辨識為安全失敗',async()=>{
  await assert.rejects(responseJSON(response('CONTENTS_ID_ERROR'),'好好簽 createByPdf'),e=>e.breezyRejected===true);
});
test('createByPdf HTTP 5xx 不被當成安全失敗',async()=>{
  await assert.rejects(responseJSON(response('UNKNOWN',503),'好好簽 createByPdf'),e=>e.breezyRejected!==true);
});
test('其他 API 的錯誤不是 createByPdf 安全拒絕',async()=>{
  await assert.rejects(responseJSON(response('UNKNOWN'),'好好簽 getInfo'),e=>e.breezyRejected!==true);
});
test('Ragic 兩份 Workflow 只解除 Worker Token 一欄遮罩',()=>{
  for(const file of ['ragic/action-buttons.js','ragic/post-workflow.js']){
    assert.match(text(file),/addIgnoreMaskDomain\(SETTING_FIELDS\.workerToken\)/);
    assert.doesNotMatch(text(file),/setIgnoreAllMasks\(true\)/);
  }
});
test('Worker 保留不明結果的待確認，已知拒絕則回失敗',()=>{
  const code=text('src/index.js');
  assert.match(code,/err\?\.breezyRejected===true/);
  assert.match(code,/retrySafe\?200:502/);
  assert.match(code,/retrySafe\?'失敗':'待確認'/);
});
