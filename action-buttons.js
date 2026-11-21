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
    return request(ROUTES.sync,{recordId:Number(id),instanceId:inst});
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
  breezyAction(BreezyModule.start,id,function(){ return '簽署任務已成功發起。'; });
}
function breezyCancel(id) {
  breezyAction(BreezyModule.cancel,id,function(){ return '簽署任務已成功取消。'; });
}
function breezySync(id) {
  breezyAction(BreezyModule.sync,id,function(result){
    var status = result.status ? String(result.status) : '已更新';
    var message = '簽署狀態同步完成：'+status;
    if(result.filesPending && result.filesPending.length) message += '；待補檔案：'+result.filesPending.join('、');
    return message;
  });
}
