import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const postSource = readFileSync(new URL('../ragic/post-workflow.js',import.meta.url),'utf8');
const buttonSource = readFileSync(new URL('../ragic/action-buttons.js',import.meta.url),'utf8');
const ID={source:1001511,template:1001512,pdf:1001465,instance:1001487,startMode:1001461,apiStatus:1001497,apiMessage:1001498,taskName:1001462,taskNo:1001458,
 subtable:1001494,signerOrder:1001470,signerName:1001471,signerEmail:1001472,signerPhone:1001473};
function setup({mode='手動',pdf='',source='https://ap12.ragic.com/demo/sales/1/41?source=1',template='2',workerOk=true,lockThrows=false}={}){
  const record={
    fields:{[ID.startMode]:mode,[ID.source]:source,[ID.template]:template,[ID.pdf]:pdf,[ID.taskName]:'合約樣本',[ID.taskNo]:'SIGN00001',[ID.apiStatus]:'未發起'},
    locked:false,saved:0
  };
  const events={downloads:[],startCalls:[],statuses:[],messages:[],records:record};
  const query=(path)=>({
    addIgnoreMaskDomain(){},
    getAPIResult(){return {getFieldValue(field){return field===1001500?'https://demo.workers.dev':'secret'}};},
    getAPIEntry(){return entry();}
  });
  function entry(){return {
    getRootNodeId(){return 101;},
    getFieldValue(field){return record.fields[field]??'';},
    setFieldValue(field,value){record.fields[field]=value;},
    getSubtableSize(){return 1;},
    getSubtableRootNodeId(){return 201;},
    getSubtableFieldValue(field){return field===ID.signerOrder?'1':field===ID.signerName?'王小明':field===ID.signerEmail?'person@example.com':'';},
    save(){record.saved++;},
    lock(){if(lockThrows)throw new Error('沒有上鎖權限');record.locked=true;},
    isLocked(){return record.locked;}
  };}
  const util={
    downloadFile(url){events.downloads.push(url);return 'generated-file.pdf';},
    setHeader(){},removeHeader(){},
    postURL(url,payload){events.startCalls.push({url,payload:JSON.parse(payload)});if(workerOk){record.fields[ID.instance]='task-abc';record.fields[ID.apiStatus]='成功';return JSON.stringify({ok:true,instanceId:'task-abc'});}return JSON.stringify({ok:false,retrySafe:true,message:'好好簽拒絕建立'});}
  };
  const context={db:{getAPIQuery:query,getApname(){return 'demo'},getPath(){return '/breezysign'},getSheetIndex(){return 3}},
    param:{isCreateNew(){return true},getUpdatedEntry:entry},util,
    response:{setStatus(x){events.statuses.push(x)},setMessage(x){events.messages.push(x)}},
    user:{getUserName(){return '測試人員'}},log:{info(){}}};
  return {context,events,record,entry};
}
function runPost(h){runInNewContext(postSource,h.context);}
function runButton(h){runInNewContext(buttonSource,h.context);h.context.breezyStart(101);}

test('直接模式：拋轉來源 PDF 產生、儲存、成功發起後上鎖',()=>{
 const h=setup({mode:'直接'});runPost(h);
 assert.deepEqual(h.events.downloads,['https://ap12.ragic.com/demo/sales/1/41.carbone?fileFormat=pdf&ragicCustomPrintTemplateId=2']);
 assert.equal(h.record.fields[ID.pdf],'generated-file.pdf');
 assert.equal(h.events.startCalls.length,1);
 assert.equal(h.events.startCalls[0].payload.task.fileName,'generated-file.pdf');
 assert.equal(h.record.locked,true);
});

test('手動模式：新增時先產 PDF，不立即發起；按鈕成功後上鎖',()=>{
 const h=setup();runPost(h);
 assert.equal(h.events.downloads.length,1);assert.equal(h.events.startCalls.length,0);assert.equal(h.record.locked,false);
 runButton(h);
 assert.equal(h.events.downloads.length,1);assert.equal(h.events.startCalls.length,1);assert.equal(h.record.locked,true);
 assert.equal(h.events.statuses.at(-1),'SUCCESS');
 assert.equal(h.events.messages.at(-1),'簽署任務已成功發起，資料已上鎖。');
});

test('手動按鈕：原本缺檔，補產後才發起',()=>{
 const h=setup();runButton(h);
 assert.equal(h.events.downloads.length,1);assert.equal(h.record.fields[ID.pdf],'generated-file.pdf');assert.equal(h.record.locked,true);
});

test('已有上傳 PDF 不覆蓋、不重新下載',()=>{
 const h=setup({mode:'直接',pdf:'manual-upload.pdf',source:'',template:''});runPost(h);
 assert.equal(h.events.downloads.length,0);assert.equal(h.events.startCalls[0].payload.task.fileName,'manual-upload.pdf');assert.equal(h.record.locked,true);
});

test('來源只有 URL 沒有報表 ID：標為失敗，不發起、不上鎖',()=>{
 const h=setup({mode:'直接',template:''});runPost(h);
 assert.equal(h.record.fields[ID.apiStatus],'失敗');assert.match(h.record.fields[ID.apiMessage],/自動產生 PDF 失敗/);
 assert.equal(h.events.startCalls.length,0);assert.equal(h.record.locked,false);
});

test('下載網址只允許 Ragic 的 HTTPS 記錄頁，不接受外部網域',()=>{
 const h=setup({mode:'直接',source:'https://evil.example/steal/1/33'});runPost(h);
 assert.equal(h.events.startCalls.length,0);assert.equal(h.events.downloads.length,0);assert.equal(h.record.fields[ID.apiStatus],'失敗');
});

test('Worker 拒絕建立：仍保留解鎖狀態以便修正重試',()=>{
 const h=setup({mode:'直接',workerOk:false});runPost(h);
 assert.equal(h.events.startCalls.length,1);assert.equal(h.record.locked,false);assert.equal(h.record.fields[ID.apiStatus],'失敗');
});

test('上鎖權限不足：已建立的簽署不錯誤歸類為待確認',()=>{
 const h=setup({lockThrows:true});runButton(h);
 assert.equal(h.record.fields[ID.instance],'task-abc');assert.equal(h.record.fields[ID.apiStatus],'成功');
 assert.equal(h.record.locked,false);assert.equal(h.events.statuses.at(-1),'SUCCESS');
 assert.match(h.events.messages.at(-1),/上鎖失敗/);
});
