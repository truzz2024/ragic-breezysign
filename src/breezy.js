import { BREEZY_API, rDate, utcFromRagic, bool, str } from './config.js';

/**
 * 好好簽公開文件的成功範例是 errorCode: 0，
 * 好好簽官方錯誤碼表：200=API呼叫成功；官方 API 範例可能為 0。
 * 相容 0、200 與 SUCCESS；建立任務仍必須取得 instanceId。
 * 僅明確辨識成功碼，不會把任意 HTTP 200 當成功。
 */
export async function responseJSON(resp, source) {
  const raw = await resp.text();
  let d;
  try { d = JSON.parse(raw); }
  catch { throw new Error(source + ' 回傳非 JSON (HTTP ' + resp.status + ')'); }

  const code = d && d.errorCode;
  const success = code === 0 || code === '0' || code === 200 || code === '200' || code === 'SUCCESS' ||
    (code == null && d?.message === 'SUCCESS' && d?.body && typeof d.body === 'object');
  if (!resp.ok || !success) {
    const reason = d && d.message && d.message !== 'SUCCESS'
      ? String(d.message)
      : ('HTTP ' + resp.status + ', errorCode ' + String(code));
    const failure = new Error(source + ' 失敗：' + reason.slice(0, 220));
    // 收到好好簽 2xx 的明確拒絕回應，表示 createByPdf 沒有建立任務。
    // 不把網路逾時、HTTP 5xx、非 JSON 或缺少 instanceId 視為可安全重試。
    if(source === '好好簽 createByPdf' && resp.ok && code != null && !success){
      failure.breezyRejected = true;
    }
    throw failure;
  }
  return d.body ?? {};
}

function apiURL(env,route,instanceId){
  const u=new URL((env.BREEZYSIGN_API_URL||BREEZY_API)+route+(instanceId?'/'+encodeURIComponent(instanceId):''));
  // 查詢 key 放在 query string，僅發送至可信任的官方 API 主機；部署者可顯式覆寫 API URL。
  return u;
}
export async function createTask(env,payload,pdfBase64,contents){
  const task=payload.task;const person=payload.signers.map(p=>({
    email:p.isFace?'':p.email,name:p.name,phone:p.phone||'',
    needVideo:bool(p.needVideo),isFace:bool(p.isFace),isNeedOtp:bool(p.isNeedOtp),
    hostEmail:p.hostEmail||undefined,hostName:p.hostName||undefined,
    culture:p.culture||'zh-TW',sendDoneMail:bool(task.sendDone)
  }));
  const req={apiKey:env.BREEZYSIGN_API_KEY, name:task.name,
    emailSubject:task.emailSubject||undefined,emailMessage:task.emailMessage||'',
    expiredDate:utcFromRagic(task.expiry),scheduledDate:utcFromRagic(task.schedule),
    isOverlay:bool(task.overlay),isParallel:task.orderMode==='同時簽署',
    returnUrl:task.returnUrl||undefined,sendDoneMailToSigner:bool(task.sendDone),
    person,datas:[{contents,pdfFile:{fileName:task.displayFileName||'document.pdf',
      contentType:'application/pdf',base64Content:pdfBase64}}]};
  if(task.initiatorName)req.initiatorName=task.initiatorName;
  const resp=await fetch(apiURL(env,'createByPdf'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(req),redirect:'manual'});
  const body=await responseJSON(resp,'好好簽 createByPdf');
  if(!body.instanceId)throw new Error('好好簽回報成功但沒有 instanceId（body keys: '+Object.keys(body||{}).join(',').slice(0,120)+'）。請先到好好簽後台確認任務，勿再次發起');
  return body;
}
export async function getInfo(env,id){const u=apiURL(env,'getInfo',id);u.searchParams.set('key',env.BREEZYSIGN_API_KEY);
  return responseJSON(await fetch(u,{redirect:'manual'}),'好好簽 getInfo');}
export async function getFiles(env,kind,id){const u=apiURL(env,kind,id);u.searchParams.set('key',env.BREEZYSIGN_API_KEY);
  const b=await responseJSON(await fetch(u,{redirect:'manual'}),'好好簽 '+kind);return b.files||[];}
export async function cancelTask(env,id){const u=apiURL(env,'cancel',id);u.searchParams.set('key',env.BREEZYSIGN_API_KEY);
  return responseJSON(await fetch(u,{method:'POST',redirect:'manual'}),'好好簽 cancel');}
