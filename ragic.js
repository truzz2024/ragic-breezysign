import { F, recordUrl, taskConfig, pdfDownloadUrl, str } from './config.js';

function auth(env){if(!env.RAGIC_API_KEY)throw new Error('未設定 RAGIC_API_KEY');return {'Authorization':'Basic '+env.RAGIC_API_KEY};}
async function checked(resp, source) {
  const raw=await resp.text();
  if (!resp.ok) throw new Error(`${source} HTTP ${resp.status}：${raw.slice(0,250)}`);
  let d; try{d=JSON.parse(raw);}catch{throw new Error(source+' 未回傳 JSON');}
  if (d.status==='FAIL'||d.status==='ERROR'||d.error||d.errorCode&&Number(d.errorCode)!==0)
    throw new Error(source+' 失敗：'+JSON.stringify(d).slice(0,350));
  return d;
}
function unwrapOne(data, recordId) {
  if(data && data._ragicId!==undefined) return data;
  if(data && data[String(recordId)]) return data[String(recordId)];
  const values=Object.values(data||{}).filter(v=>v&&typeof v==='object'&&v._ragicId!==undefined);
  return values.find(x=>String(x._ragicId)===String(recordId))||null;
}
export async function getRecord(env, recordId) {
  const u=new URL(recordUrl(env,recordId));u.searchParams.set('api','');u.searchParams.set('v','3');u.searchParams.set('naming','EID');
  const d=await checked(await fetch(u,{headers:auth(env),redirect:'manual'}),'Ragic 讀取');
  const obj=unwrapOne(d,recordId);if(!obj)throw new Error('Ragic 查無指定資料 '+recordId);return obj;
}
export async function findByInstance(env,instanceId) {
  const c=taskConfig(env); const u=new URL(c.form);
  u.searchParams.set('api','');u.searchParams.set('v','3');u.searchParams.set('naming','EID');
  u.searchParams.set('where',`${F.instanceId},eq,${encodeURIComponent(instanceId)}`);
  u.searchParams.set('limit','2');
  const d=await checked(await fetch(u,{headers:auth(env),redirect:'manual'}),'Ragic 任務查詢');
  const matches=Object.values(d).filter(x=>x&&typeof x==='object'&&String(x[F.instanceId])===String(instanceId));
  if(matches.length!==1)throw new Error(matches.length?'Instance ID 對應多筆任務':'找不到對應的 Ragic 任務');
  return matches[0];
}
export async function writeFields(env,recordId,fields,files=[]) {
  const url = new URL(recordUrl(env,recordId));
  url.searchParams.set('api','');url.searchParams.set('v','3');url.searchParams.set('doWorkflow','false');
  url.searchParams.set('notification','false');
  const fd=new FormData();fd.append('api','');fd.append('v','3');
  for(const [k,v] of Object.entries(fields)) if(v!==null&&v!==undefined)fd.append(k,String(v));
  for(const f of files) fd.append(String(f.fieldId), new Blob([f.bytes],{type:f.contentType||'application/pdf'}),f.fileName);
  return checked(await fetch(url,{method:'POST',headers:auth(env),body:fd,redirect:'manual'}),'Ragic 回寫');
}
export async function downloadPdf(env,recordId,fileName){
  const url=pdfDownloadUrl(env,recordId,fileName);
  const resp=await fetch(url,{headers:auth(env),redirect:'manual'});
  if(!resp.ok)throw new Error('PDF 下載失敗 HTTP '+resp.status);
  const size=Number(resp.headers.get('content-length'));
  if(size>8*1024*1024)throw new Error('PDF 大於 8 MB');
  const ab=await resp.arrayBuffer();
  if(ab.byteLength===0||ab.byteLength>8*1024*1024)throw new Error('PDF 大小異常');
  const bytes=new Uint8Array(ab); const prefix=new TextDecoder().decode(bytes.slice(0,5));
  if(prefix!=='%PDF-')throw new Error('下載內容不是 PDF，請檢查 Ragic 附件權限');
  return bytes;
}
export function field(record,id){return record[String(id)]??record[id];}
export function extractRows(record){
  const sub=record['_subtable_'+F.subtable]||{};
  return Object.keys(sub).map(k=>{const r=sub[k];return {rowId:Number(r._ragicId??k),order:Number(field(r,F.signerOrder)||0),
    email:str(field(r,F.signerEmail)),name:str(field(r,F.signerName)), status:str(field(r,F.signerStatus))};})
    .sort((a,b)=>a.order-b.order||a.rowId-b.rowId);
}
