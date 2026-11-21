import { F, taskConfig, str, bool, MAX_PDF_SIZE, rDate } from './config.js';
import { getRecord, findByInstance, writeFields, downloadPdf, field, extractRows } from './ragic.js';
import { createTask, getInfo, getFiles, cancelTask } from './breezy.js';
import { inspect } from './pdf-inspect.js';
import { expectsFinalCompletion, describeSync, isTerminalSyncState, retryDelaysMs } from './callback-retry.js';
import { isTemporarilyMissingFile, retryableFileDelaysMs, describeFileIssue } from './file-availability.js';
import { signedDocumentName } from './result-file-name.js';
import { toBreezyCoordinates } from './signature-coordinates.js';

// 單一 isolate 內的額外保護；跨區域/重啟不保證互斥。嚴格 exactly-once 需 Durable Object 或上游支援 idempotency key。
const inflightStarts = new Set();
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function fail(message,status=400,extra={}){return json({ok:false,message,...extra},status);}
function checkId(v){const id=Number(v);if(!Number.isSafeInteger(id)||id<=0)throw Error('無效 recordId');return id;}
async function equalToken(a,b){
  if(!a||!b)return false;
  const enc=new TextEncoder();const [aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);
  const x=new Uint8Array(aa),y=new Uint8Array(bb);let t=0;for(let i=0;i<x.length;i++)t|=x[i]^y[i];return t===0;
}
function clean(s,max=200){return String(s||'').slice(0,max);}
async function limit(env,path,request){
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  if(path==='/callback'){
    if(env.RL_CALLBACK){const r=await env.RL_CALLBACK.limit({key:'callback:'+ip});if(!r.success)return false;}
    if(env.RL_GLOBAL){const r=await env.RL_GLOBAL.limit({key:'all-callbacks'});if(!r.success)return false;}
  } else if(env.RL_ACTION){const r=await env.RL_ACTION.limit({key:'operation:'+path});if(!r.success)return false;}
  return true;
}
function ensureRagic(p,env){
  const c=taskConfig(env);if(!p.ragic||p.ragic.account!==c.account||p.ragic.path!==c.path||Number(p.ragic.sheetIndex)!==c.sheetIndex)
    throw Error('任務來源與 Worker 綁定的 Ragic 表單不一致');
}
function validateStart(p,env){
  if(!p||typeof p!=='object')throw Error('無效請求');
  const id=checkId(p.recordId);ensureRagic(p,env);
  if(!p.task||!p.signers||!Array.isArray(p.signers)||!p.signers.length)throw Error('簽署關卡不可為空');
  if(!str(p.task.name)||str(p.task.name).length>150)throw Error('任務名稱不得空白或過長');
  if(!str(p.task.fileName))throw Error('PDF 欄位沒有附件');
  const seenRow=new Set(),seenOrder=new Set();
  for(const s of p.signers){
    if(!Number.isSafeInteger(Number(s.rowId))||Number(s.rowId)<=0)throw Error('簽署關卡尚未儲存，rowId 無效');
    if(seenRow.has(String(s.rowId)))throw Error('子表格 rowId 重複');seenRow.add(String(s.rowId));
    if(!Number.isSafeInteger(Number(s.order))||Number(s.order)<1||seenOrder.has(Number(s.order)))throw Error('簽署順序重複或錯誤');seenOrder.add(Number(s.order));
    if(!str(s.name))throw Error('簽署人姓名不得空白');
    if(!bool(s.isFace)&&!/^\S+@\S+\.\S+$/.test(str(s.email)))throw Error('非現場簽署需有效 Email');
  }
  return id;
}
function base64(bytes){
  // 使用區塊避免一次展開過大的引數造成 call stack 錯誤。
  let result='';for(let i=0;i<bytes.length;i+=24576){let s='';for(const b of bytes.subarray(i,i+24576))s+=String.fromCharCode(b);result+=btoa(s);}return result;
}
function fromBase64(data){
  if(typeof data!=='string'||data.length>MAX_PDF_SIZE*1.38+4096)throw Error('結果檔案過大');
  const plain=data.includes(',')?data.slice(data.indexOf(',')+1):data;
  const raw=atob(plain),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
  if(a.byteLength>MAX_PDF_SIZE)throw Error('結果檔案超過設定上限');return a;
}
function contentsFor(inspectResult,signers){
  const matched=inspectResult.matched||[],unmatched=inspectResult.unmatched||[];
  if(unmatched.length){
    const positions=unmatched.slice(0,8).map(x=>'第'+x.page+'頁 [[SIGN:'+x.signer+']] (x='+Math.round(x.anchor?.x||0)+', y='+Math.round(x.anchor?.y||0)+')').join('、');
    throw Error('PDF 簽名框未完整辨識：'+positions+'；請確認標記在封閉框內');
  }
  const map=new Map();const out=new Map();
  // 測試好好簽服務端的成員 ID 為 1-based（先前 0-based 回傳 CONTENTS_ID_ERROR）
  signers.forEach((s,i)=>map.set(i+1,i+1));
  for(const x of matched){
    if(!map.has(x.signer))throw Error('PDF 簽名標記 [[SIGN:'+x.signer+']] 沒有對應的簽署人');
    if(!x.box||x.box.width<15||x.box.height<15)throw Error('簽名框過小');
    if(!out.has(x.page))out.set(x.page,[]);
    // PDF.js 在 scale=1 的 viewport 使用 PDF points（72pt / inch）。
    // 以本模組的實際簽署 PDF 驗證，好好簽的 contents 座標對應 96px / inch：
    // 若不換算，簽名的 X 與寬度會以約 0.75 倍位置出現在文件上。
    const position = toBreezyCoordinates(x.box);
    out.get(x.page).push({id:map.get(x.signer),...position,
      type:0,required:true,label:'簽署人 '+x.signer});
  }
  for(let i=1;i<=signers.length;i++)if(!matched.some(x=>x.signer===i))throw Error('缺少第 '+i+' 位簽署人的 [[SIGN:'+i+']] 標記');
  return [...out.entries()].sort((a,b)=>a[0]-b[0]).map(([page,data])=>({page,data}));
}
function stageError(err,stage){
  const retrySafe=stage==='preflight'||(stage==='create'&&err?.breezyRejected===true);
  // Ragic util.postURL 對非 2xx 可能直接拋錯，無法取得 retrySafe 標記。
  // 已知業務拒絕以 HTTP 200 + ok:false 表示；真正結果不明仍回 502。
  return fail(clean(err?.message||err,350),retrySafe?200:502,{stage,retrySafe});
}
async function start(env,p){
  let stage='preflight',id,lockKey;
  try{
    id=validateStart(p,env);lockKey=taskConfig(env).account+':'+id;
    if(inflightStarts.has(lockKey))return fail('此筆任務正在發起中',409,{retrySafe:false});
    inflightStarts.add(lockKey);
    // 防止普通重試：只取 Ragic 當前狀態，不重複讀取簽署人與 PDF 欄位。
    const existing=await getRecord(env,id);
    if(str(field(existing,F.instanceId)))return fail('任務已有 Instance ID，禁止再次建立',409,{retrySafe:false});
    if(str(field(existing,F.apiStatus))==='成功'||str(field(existing,F.apiStatus))==='待確認')
      return fail('任務已發起或結果待確認，禁止重試',409,{retrySafe:false});
    const pdf=await downloadPdf(env,id,p.task.fileName);
    const parsed=await inspect(pdf); const contents=contentsFor(parsed,p.signers);
    // 以下任何結果不明都禁止自動重送 createByPdf。
    stage='create';
    const created=await createTask(env,p,base64(pdf),contents);
    stage='writeback';
    const fields={
      [F.instanceId]:created.instanceId,[F.apiStatus]:'成功',
      [F.apiMessage]:'已成功送交好好簽',
      [F.status]:p.task.schedule?'已排程':'簽署中',
      [F.initiatorName]:p.task.initiatorName||'',
      [F.syncedAt]:rDate(new Date().toISOString())
    };
    if(created.signUrl)fields[F.signUrl]=created.signUrl;
    await writeFields(env,id,fields);
    return json({ok:true,recordId:id,instanceId:created.instanceId});
  }catch(e){
    // 只有「尚未送出 createByPdf」或「好好簽明確拒絕建立」才能安全重試。
    // 逾時、回應不明與建立成功但回寫失敗，全部保持待確認。
    const retrySafe=stage==='preflight'||(stage==='create'&&e?.breezyRejected===true);
    if(id){
      try{
        await writeFields(env,id,{
          [F.apiStatus]:retrySafe?'失敗':'待確認',
          [F.apiMessage]:(retrySafe?'發起失敗，可修正後重試：':'建立結果不明，請先確認好好簽：')+clean(e.message,190)
        });
      }catch{}
    }
    return stageError(e,stage);
  }finally{if(lockKey)inflightStarts.delete(lockKey);}
}
function taskStatus(info,callbackStatus){
  const states=(info.data||[]).map(x=>String(x.currentStatus||'').toUpperCase());
  if(states.includes('CANCEL'))return '已刪除';
  if(states.includes('REJECT'))return '拒絕簽署';
  if(info.result===true&&states.length&&states.every(s=>s==='DONE'))return '簽署完成';
  if(callbackStatus==='DELETE'&&info.endDate)return '已刪除';
  if(callbackStatus==='SCHEDULED')return '已排程';
  if(info.result===false&&info.endDate)return '拒絕簽署';
  return '簽署中';
}
const signerStatuses={WAITING:'等待中',PROCESSING:'進行中',SENT:'已寄送',SEND_FAIL:'寄送失敗',OPEN:'已開啟',DONE:'已完成',REJECT:'已拒絕',CANCEL:'已取消'};
function signerUpdates(info,record){
  const rows=extractRows(record),people=info.data||[],fields={};
  // email + name 優先精準比對；不允許同 Email 時隨意更新錯誤的列。
  const used=new Set();
  for(const r of rows){
    let index=people.findIndex((p,i)=>!used.has(i)&&str(p.assigneeEmail).toLowerCase()===r.email.toLowerCase()&&str(p.assigneeName)===r.name);
    if(index<0&&r.email)index=people.findIndex((p,i)=>!used.has(i)&&str(p.assigneeEmail).toLowerCase()===r.email.toLowerCase());
    if(index<0)continue;
    used.add(index);const p=people[index],k=r.rowId;
    if(!(k>0))continue;
    const status=signerStatuses[String(p.currentStatus||'').toUpperCase()];
    if(status)fields[F.signerStatus+'_'+k]=status;
    if(p.endTime)fields[F.signerSignedTime+'_'+k]=rDate(p.endTime,false);
    if(p.denyReason)fields[F.signerReason+'_'+k]=p.denyReason;
  }
  return fields;
}
async function syncInstance(env,instanceId,recordId=null,callbackStatus='',callbackFinal=false){
  const record=recordId?await getRecord(env,recordId):await findByInstance(env,instanceId);
  if(str(field(record,F.instanceId))!==instanceId)throw Error('Instance ID 與 Ragic 任務不符');
  const rid=checkId(record._ragicId||recordId);
  let info=await getInfo(env,instanceId);
  let state=taskStatus(info,callbackStatus);
  
  if (callbackStatus) console.info('[breezysign] callback getInfo initial '+JSON.stringify(describeSync(callbackStatus, info, state)));
  if (callbackFinal && !isTerminalSyncState(state)) {
    for (let attempt=0;attempt<retryDelaysMs.length;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,retryDelaysMs[attempt]));
      info=await getInfo(env,instanceId);
      state=taskStatus(info,callbackStatus);
      console.info('[breezysign] callback getInfo retry '+(attempt+1)+' '+JSON.stringify(describeSync(callbackStatus, info, state)));
      if (isTerminalSyncState(state)) break;
    }
    if (!isTerminalSyncState(state)) throw new Error('收到簽署完成通知，但好好簽 getInfo 仍未完成；已重查仍未就緒，請稍後用 Ragic 同步狀態補救');
  }
  const fields={...signerUpdates(info,record),[F.status]:state,
    [F.apiStatus]:'成功',[F.syncedAt]:rDate(new Date().toISOString()),
    [F.apiMessage]:'同步完成'};
  if(info.startDate)fields[F.startTime]=rDate(info.startDate);
  if(info.endDate)fields[F.endTime]=rDate(info.endDate);
  // 狀態是 getInfo 驗證後的正式資料，先寫回 Ragic，不能被稍後產製的檔案擋住。
  await writeFields(env,rid,fields);
  let filesUploaded=0;
  const filesPending=[];
  if(state==='簽署完成'){
    // 兩種下載 API 獨立處理：getTrack FILE_NOT_FOUND 不得阻擋 getResult 或主表單更新。
    for(const spec of [
      {kind:'getResult',fieldId:F.signedPdf,existingField:F.signedPdf,label:'已簽署 PDF',fallbackName:'signed.pdf'},
      {kind:'getTrack',fieldId:F.trackPdf,existingField:F.trackPdf,label:'簽署軌跡',fallbackName:'track.pdf'}
    ]){
      if(str(field(record,spec.existingField)))continue;
      try{
        let files=[];
        for(let attempt=0;attempt<=retryableFileDelaysMs.length;attempt++){
          try{
            files=await getFiles(env,spec.kind,instanceId);
            if(!files.some(f=>typeof f.base64Content==='string' && f.base64Content.length>0)){
              throw new Error('檔案尚未產生：FILE_NOT_FOUND');
            }
            break;
          }catch(e){
            if(attempt>=retryableFileDelaysMs.length||!isTemporarilyMissingFile(e))throw e;
            console.info('[breezysign] '+spec.kind+' not ready, retry '+(attempt+1));
            await new Promise(resolve=>setTimeout(resolve,retryableFileDelaysMs[attempt]));
          }
        }
        const uploads=files.filter(f=>f.base64Content).map(f=>({
          fieldId:spec.fieldId,
          fileName:signedDocumentName(info, str(field(record,F.taskName))||str(field(record,F.taskNo)), spec.kind),
          contentType:f.contentType||'application/pdf',
          bytes:fromBase64(f.base64Content)
        }));
        if(!uploads.length)throw Error('檔案回傳為空：FILE_NOT_FOUND');
        // 每份文件個別上傳，失敗不會回滾已完成的簽署狀態。
        await writeFields(env,rid,{},uploads);
        filesUploaded+=uploads.length;
      }catch(e){
        filesPending.push(spec.label);
        // 只輸出錯誤類型與 API 名稱，不包含身分、檔案或金鑰。
        console.warn('[breezysign] '+spec.kind+' pending '+describeFileIssue(e));
      }
    }
    if(filesPending.length){
      // 即使附件產生較慢，主表單仍明確顯示簽署完成，並提示使用者可按「重新取得狀態」。
      try{await writeFields(env,rid,{[F.apiMessage]:'簽署完成；待補：'+filesPending.join('、')+'（請稍後重新取得狀態）'});}
      catch(e){console.warn('[breezysign] pending notice writeback failed');}
    }
  }
  return {recordId:rid,instanceId,status:state,filesUploaded,filesPending};
}
async function sync(env,p){const id=checkId(p.recordId),inst=str(p.instanceId);if(!inst)throw Error('缺少 Instance ID');
  return json({ok:true,...await syncInstance(env,inst,id)});
}
async function cancel(env,p){
  const id=checkId(p.recordId),inst=str(p.instanceId),name=str(p.cancelName);
  if(!inst||!name)throw Error('缺少 Instance ID 或取消人名稱');
  const record=await getRecord(env,id);
  if(str(field(record,F.instanceId))!==inst)throw Error('取消對應的 Instance ID 不符');
  if(str(field(record,F.status))==='已刪除'||str(field(record,F.cancelName)))throw Error('任務已取消');
  await cancelTask(env,inst);
  await writeFields(env,id,{[F.status]:'已刪除',[F.cancelName]:name,[F.apiMessage]:'已取消簽署任務',
    [F.syncedAt]:rDate(new Date().toISOString())});
  return json({ok:true,recordId:id,instanceId:inst,status:'已刪除'});
}
async function callback(env,p){
  const inst=str(p.instanceId);
  if(!/^[a-zA-Z0-9_-]{8,128}$/.test(inst))throw Error('無效 Instance ID');
  const status=String(p.status||'').toUpperCase();
  const expectedFinal=expectsFinalCompletion(p);
  console.info('[breezysign] callback event '+JSON.stringify({status,expectedFinal,callbackResult:typeof p.result==='boolean'?p.result:null,assigneeCount:Array.isArray(p.assignees)?p.assignees.length:null,signedCount:Array.isArray(p.assignees)?p.assignees.filter(x=>x.isSigned===true).length:null}));
  const result=await syncInstance(env,inst,null,status,expectedFinal);
  console.info('[breezysign] callback applied '+JSON.stringify({status:result.status,filesUploaded:result.filesUploaded,filesPending:result.filesPending}));
  return json({result:'1'});
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(request.method==='GET'&&path==='/health')return json({ok:true,service:'ragic-breezysign-worker',version:'1.1.1'});
    if(request.method!=='POST'||!['/start','/sync','/cancel','/callback'].includes(path))return fail('Not Found',404);
    if(!env.WORKER_TOKEN||!env.RAGIC_API_KEY||!env.BREEZYSIGN_API_KEY||!env.RAGIC_TASK_FORM_URL)return fail('Worker 尚未完成環境設定',503);
    if(path!=='/callback'&&!await equalToken(request.headers.get('X-Worker-Token'),env.WORKER_TOKEN))return fail('Unauthorized',401);
    if(!await limit(env,path,request))return fail('Too Many Requests',429);
    const type=request.headers.get('content-type')||'';
    if(!type.toLowerCase().includes('application/json'))return fail('Content-Type 必須是 application/json',415);
    const size=Number(request.headers.get('content-length')||0);if(size>80*1024)return fail('Request too large',413);
    let data;try{const txt=await request.text();if(txt.length>80*1024)return fail('Request too large',413);data=JSON.parse(txt);}catch{return fail('Invalid JSON',400);}
    try{
      if(path==='/start')return await start(env,data);
      if(path==='/cancel')return await cancel(env,data);
      if(path==='/sync')return await sync(env,data);
      return await callback(env,data);
    }catch(e){
      // 僅記錄路由與遮蔽金鑰後的錯誤，不輸出原始請求、文件或簽署人資料。
      let safeMessage = clean(e?.message || 'Server error', 320);
      for (const secret of [env.WORKER_TOKEN, env.RAGIC_API_KEY, env.BREEZYSIGN_API_KEY]) {
        if (typeof secret === 'string' && secret.length > 0) safeMessage = safeMessage.split(secret).join('[REDACTED]');
      }
      console.error('[breezysign] ' + path + ': ' + safeMessage);
      return fail(safeMessage,502);
    }
  }
};
