/*
 * 安裝在 /breezysign/3 的 Sheet Scope JavaScript Workflow。
 * Ragic 動作按鈕函數分別設定：
 * breezyStart({id});
 * breezyCancel({id});
 * breezySync({id});
 */
var BreezyModule=(function(){
  // ==================== 安裝設定（請先修改此區）====================
  // 注意：Sheet Scope 和 Post-workflow 是各自獨立的程式，兩份都需更新。
  var PATHS = {
    task: '/breezysign/3',      // 電子簽署任務表單路徑（不含資料庫名稱）
    settings: '/breezysign/2'   // 串接設定表單路徑（不含資料庫名稱）
  };
  var SETTING_FIELDS = {
    workerUrl: 1001500,   // 串接設定：Cloudflare Worker URL
    workerToken: 1001508  // 串接設定：Cloudflare Worker 驗證金鑰（文字遮罩）
  };
  var ROUTES = {
    start: '/start',       // 發起簽署 API
    cancel: '/cancel',     // 取消簽署 API
    sync: '/sync'          // 重新取得簽署狀態 API
  };
  // ==================== Ragic 欄位 ID（只需修改此區）====================
  var F = {
    taskNo: 1001458, // Ragic 任務編號
    status: 1001459, // 簽署狀態（主表單）
    taskName: 1001462, // 任務文件名稱
    pdf: 1001465, // 待簽署 PDF（單一檔案）
    sourceRecordUrl: 1001511, // 拋轉來源 Ragic URL（原始資料完整網址）
    sourceTemplateId: 1001512, // 拋轉來源客製列印報表 ID（ragicCustomPrintTemplateId）
    expiry: 1001466, // 文件簽署期限
    schedule: 1001468, // 排程簽署發送時間
    emailSubject: 1001482, // 簽署信件主旨
    emailMessage: 1001501, // 簽署邀請信訊息內容
    overlay: 1001483, // 顯示前一人簽署內容
    sendDone: 1001485, // 寄送完成通知給簽署人
    returnUrl: 1001484, // 簽署完成後前往網址
    orderMode: 1001486, // 簽署順序模式：同時／依序
    instanceId: 1001487, // 好好簽任務 ID
    initiatorName: 1001489, // 簽署發起人名稱
    cancelName: 1001509, // 簽署取消人名稱
    apiStatus: 1001497, // API 執行狀態
    apiMessage: 1001498, // API 訊息

    // ----- 簽署關卡子表格 -----
    subtable: 1001494, // 簽署關卡子表格 Key
    signerOrder: 1001470, // 簽署順序
    signerName: 1001471, // 簽署人姓名
    signerEmail: 1001472, // 簽署人 Email
    signerPhone: 1001473, // 簽署人手機號碼
    signerFace: 1001477, // 現場簽署
    signerOtp: 1001478, // 需要 OTP 驗證
    signerHostEmail: 1001479, // 現場簽主持人 Email
    signerHostName: 1001480, // 現場簽主持人姓名
    signerCulture: 1001481, // 通知語言
    signerVideo: 1001496, // 需要聲明錄影
  };
  // ==================== 以下是執行邏輯，通常不需要修改 ====================

  function val(x){return x==null?'':String(x).trim();}
  function yes(x){return x===true||val(x).toLowerCase()==='true'||val(x)==='Yes';}
  function getEntry(id){var q=db.getAPIQuery(PATHS.task),e=q.getAPIEntry(Number(id));if(!e)throw Error('找不到任務資料');return e;}
  function setting(){var q=db.getAPIQuery(PATHS.settings);
    q.addIgnoreMaskDomain(SETTING_FIELDS.workerToken);
    var c=q.getAPIResult();
    if(!c)throw Error('找不到串接設定');
    var url=val(c.getFieldValue(SETTING_FIELDS.workerUrl)).replace(/\/$/,'');
    var token=val(c.getFieldValue(SETTING_FIELDS.workerToken));
    if(!/^https:\/\/[^?#\s]+$/i.test(url)||!token)throw Error('Worker URL 或驗證金鑰未設定');
    return {url:url,token:token};
  }
  // 將拋轉來源 URL 改為客製列印報表 PDF 網址。
  // 不限制 *.ragic.com：允許其他正式網域、私有主機、自訂埠。
  // 只接受 http/https，保留原主機及記錄路徑，移除查詢參數及錨點。
  function reportUrl(e){
    var source=val(e.getFieldValue(F.sourceRecordUrl));
    var templateId=val(e.getFieldValue(F.sourceTemplateId));
    if(!source&&!templateId)return '';
    if(!source||!templateId)throw new Error('自動產生 PDF 需要同時填寫拋轉來源 Ragic URL 及客製列印報表 ID');
    if(!/^[1-9][0-9]*$/.test(templateId))throw new Error('拋轉來源客製列印報表 ID 必須是正整數');
    var clean=source.split('#')[0].split('?')[0].replace(/\/+$/,'');
    // 這裡只檢查 URL 基本格式，不綁定 Ragic 的官方網域或表單路徑層數。
    if(!/^https?:\/\/[^\/?#\s]+\/[^?#\s]+$/i.test(clean))
      throw new Error('拋轉來源必須是包含記錄路徑的完整 http(s) URL');
    if(/\.carbone$/i.test(clean))clean=clean.slice(0,-8);
    return clean+'.carbone?fileFormat=pdf&ragicCustomPrintTemplateId='+encodeURIComponent(templateId);
  }
  // 自訂中文檔名，避免 util.downloadFile() 依原站回應標頭產生 %25E9... 的編碼檔名。
  // setDownloadFilename() 必須緊接 downloadFile()；回傳的內部檔案識別碼不可自行解碼。
  function reportFileName(e){
    var base=val(e.getFieldValue(F.taskName))||val(e.getFieldValue(F.taskNo))||'簽署文件';
    base=base.replace(/\.pdf$/i,'').replace(/[\\\/:*?"<>|@\x00-\x1f]/g,'_').replace(/^\.+|\.+$/g,'').trim();
    return (base.slice(0,120)||'簽署文件')+'.pdf';
  }
  // 有手動 PDF 時保留原附件；沒有 PDF 且具備來源資訊才下載並存回表單。
  // 此操作必須在呼叫 Worker /start 前完成，避免簽署到尚未儲存的附件。
  function ensurePdf(e){
    if(val(e.getFieldValue(F.pdf)))return e;
    var url=reportUrl(e);
    if(!url)return e;
    util.setDownloadFilename(reportFileName(e)); // 指定中文顯示檔名（僅套用這一次下載）
    var savedFile=util.downloadFile(url);
    if(!val(savedFile))throw new Error('客製列印報表下載沒有回傳檔案名稱；請確認來源表單存取權限及報表 ID');
    e.setFieldValue(F.pdf,val(savedFile));
    e.save();
    var refreshed=getEntry(e.getRootNodeId());
    if(!refreshed||!val(refreshed.getFieldValue(F.pdf)))throw new Error('客製列印 PDF 未成功寫入待簽署 PDF 欄位');
    return refreshed;
  }
  // 只在好好簽已建立 Instance ID 後上鎖；entry.lock() 會立即鎖定記錄，無需再次 save。
  function lockAfterStart(id,instanceId){
    try{
      var latest=getEntry(id);
      if(!latest||!val(instanceId)||val(latest.getFieldValue(F.instanceId))!==val(instanceId))
        return '好好簽已回覆建立成功，但 Ragic 任務 ID 尚未確認；請先檢查回寫及上鎖狀態';
      if(!latest.isLocked())latest.lock();
      return '';
    }catch(err){return '好好簽已建立成功，但 Ragic 自動上鎖失敗：'+String(err).slice(0,180);}
  }
  function getSub(e,i,k){return val(e.getSubtableFieldValue(F.subtable,i,String(k)));}
  function makePayload(e){var arr=[];
    for(var i=0;i<e.getSubtableSize(F.subtable);i++){
      arr.push({rowId:e.getSubtableRootNodeId(F.subtable,i),order:Number(getSub(e,i,F.signerOrder))||i+1,
        name:getSub(e,i,F.signerName),email:getSub(e,i,F.signerEmail),phone:getSub(e,i,F.signerPhone),
        isFace:yes(getSub(e,i,F.signerFace)),isNeedOtp:yes(getSub(e,i,F.signerOtp)),
        hostEmail:getSub(e,i,F.signerHostEmail),hostName:getSub(e,i,F.signerHostName),
        culture:getSub(e,i,F.signerCulture)||'zh-TW',needVideo:yes(getSub(e,i,F.signerVideo))});
    }
    arr.sort(function(a,b){return a.order-b.order||a.rowId-b.rowId;});
    if(!arr.length)throw Error('請先填寫簽署關卡');
    var file=val(e.getFieldValue(F.pdf));if(!file)throw Error('請先上傳待簽 PDF');
    return {recordId:e.getRootNodeId(),ragic:{account:db.getApname(),path:db.getPath(),sheetIndex:db.getSheetIndex()},
      task:{name:val(e.getFieldValue(F.taskName))||val(e.getFieldValue(F.taskNo)),
        fileName:file,initiatorName:val(user.getUserName()),
        expiry:val(e.getFieldValue(F.expiry)),schedule:val(e.getFieldValue(F.schedule)),
        emailSubject:val(e.getFieldValue(F.emailSubject)),emailMessage:val(e.getFieldValue(F.emailMessage)),
        overlay:yes(e.getFieldValue(F.overlay)),sendDone:yes(e.getFieldValue(F.sendDone)),
        returnUrl:val(e.getFieldValue(F.returnUrl)),orderMode:val(e.getFieldValue(F.orderMode))},signers:arr};
  }
  function request(route,payload){var c=setting();
    util.setHeader('Content-Type','application/json');
    util.setHeader('X-Worker-Token',c.token);
    try {var raw=util.postURL(c.url+route,JSON.stringify(payload));return JSON.parse(String(raw));}
    finally {util.removeHeader('X-Worker-Token');util.removeHeader('Content-Type');}
  }
  function set(e,s,msg){e.setFieldValue(F.apiStatus,s);e.setFieldValue(F.apiMessage,val(msg).slice(0,500));e.save();}
  function start(id){
    var e=getEntry(id);
    if(val(e.getFieldValue(F.instanceId)))throw Error('已存在好好簽任務 ID，禁止再次發起');
    var status=val(e.getFieldValue(F.apiStatus));
    if(status==='發起中'||status==='成功'||status==='待確認')throw Error('任務正在發起或結果待確認，不得重複發起');
    // 缺少附件時，若有拋轉來源則補產 PDF；已存在附件不覆寫。
    try{e=ensurePdf(e);}catch(pdfError){
      set(e,'失敗','自動產生 PDF 失敗：'+String(pdfError).slice(0,210));
      throw pdfError;
    }
    var p=makePayload(e);
    e.setFieldValue(F.initiatorName,val(user.getUserName()));
    set(e,'發起中','已送交 Worker，等待建立回應');
    try{
      var r=request(ROUTES.start,p);
      if(!r || r.ok !== true){
        var message=r && r.message ? String(r.message) : 'Worker 回應失敗';
        var state=r && r.retrySafe === true ? '失敗' : '待確認';
        var current=getEntry(id);
        if(!val(current.getFieldValue(F.instanceId)))set(current,state,message);
        // 這是 Worker 已明確回覆的結果，catch 不應再一律寫成待確認。
        var issue=new Error(message);
        issue.workerResponseHandled=true;
        throw issue;
      }
      // 回寫已成功後才將整筆任務上鎖；若權限不足，仍保留已建立的結果。
      r.lockWarning=lockAfterStart(id,r.instanceId);
      return r;
    }catch(ex){
      if(!ex.workerResponseHandled){
        var fresh=getEntry(id);
        if(!val(fresh.getFieldValue(F.instanceId))){
          set(fresh,'待確認','開始請求結果不明，請先確認好好簽未建立任務：'+String(ex));
        }
      }
      throw ex;
    }
  }
  function cancel(id){
    var e=getEntry(id),inst=val(e.getFieldValue(F.instanceId));
    if(!inst)throw Error('任務尚未發起');
    if(val(e.getFieldValue(F.status))==='已刪除'||val(e.getFieldValue(F.cancelName)))throw Error('任務已取消');
    return request(ROUTES.cancel,{recordId:Number(id),instanceId:inst,cancelName:val(user.getUserName())});
  }
  function sync(id){
    var e=getEntry(id),inst=val(e.getFieldValue(F.instanceId));
    if(!inst)throw Error('尚無好好簽任務 ID，無法同步');
    var result=request(ROUTES.sync,{recordId:Number(id),instanceId:inst});
    // 若首次發起成功但上鎖失敗，手動同步成功後可再次嘗試上鎖。
    if(result && result.ok === true)result.lockWarning=lockAfterStart(id,inst);
    return result;
  }
  return {start:start,cancel:cancel,sync:sync};
})();
// Ragic 動作按鈕統一顯示純文字，不回傳 Worker JSON 或向上拋出 JavaScript Error。
function breezyErrorText(err) {
  var message = (err && err.message != null) ? String(err.message) : String(err || '執行失敗');
  return message.replace(/^\s*(?:Error|Exception)(?::\s*)?/i, '')
    .replace(/\s+in Installed Sheet Scope at line number[\s\S]*$/i, '')
    .trim() || '執行失敗';
}
function breezyAction(action,id,successText) {
  try {
    var result = action(id);
    if (!result || result.ok !== true) throw new Error(result && result.message ? String(result.message) : 'Worker 回應失敗');
    response.setStatus('SUCCESS');
    response.setMessage(successText(result));
  } catch (err) {
    response.setStatus('ERROR');
    response.setMessage(breezyErrorText(err));
  }
  // 不 return Worker 回傳物件，避免 UI 顯示 [object Object]。
}
function breezyStart(id) {
  breezyAction(BreezyModule.start,id,function(result){ return result.lockWarning ? '簽署任務已成功發起；'+result.lockWarning : '簽署任務已成功發起，資料已上鎖。'; });
}
function breezyCancel(id) {
  breezyAction(BreezyModule.cancel,id,function(){ return '簽署任務已成功取消。'; });
}
function breezySync(id) {
  breezyAction(BreezyModule.sync,id,function(result){
    var status = result.status ? String(result.status) : '已更新';
    var message = '簽署狀態同步完成：'+status;
    if(result.filesPending && result.filesPending.length) message += '；待補檔案：'+result.filesPending.join('、');
    if(result.lockWarning)message += '；'+result.lockWarning;
    return message;
  });
}
