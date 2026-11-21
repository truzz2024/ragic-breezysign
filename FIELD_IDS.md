# 欄位 ID 快速對照（TruzzDemo）

以下數值來自你提供的 Ragic 定義文件，已對應到此版本程式。每個 ID 只須修改**所屬檔案的頂部變數區**，不需要搜尋流程程式。

| 變數 | 中文欄位 | Field ID | 出現位置 |
|---|---|---:|---|
| `taskNo` | Ragic 任務編號 | `1001458` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `status` | 簽署狀態（主表單） | `1001459` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `startMode` | 發起方式：直接／手動 | `1001461` | Worker、Ragic Post-workflow |
| `taskName` | 任務文件名稱 | `1001462` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `pdf` | 待簽署 PDF（單一檔案） | `1001465` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `sourceRecordUrl` | 拋轉來源 Ragic URL | `1001511` | Ragic 按鈕、Ragic Post-workflow |
| `sourceTemplateId` | 拋轉來源客製列印報表 ID | `1001512` | Ragic 按鈕、Ragic Post-workflow |
| `expiry` | 文件簽署期限 | `1001466` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signedPdf` | 已簽署 PDF | `1001467` | Worker |
| `schedule` | 排程簽署發送時間 | `1001468` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `trackPdf` | 簽署軌跡檔案 | `1001469` | Worker |
| `emailSubject` | 簽署信件主旨 | `1001482` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `emailMessage` | 簽署邀請信訊息內容 | `1001501` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `overlay` | 顯示前一人簽署內容 | `1001483` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `sendDone` | 寄送完成通知給簽署人 | `1001485` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `returnUrl` | 簽署完成後前往網址 | `1001484` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `orderMode` | 簽署順序模式：同時／依序 | `1001486` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `instanceId` | 好好簽任務 ID | `1001487` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `initiatorName` | 簽署發起人名稱 | `1001489` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `cancelName` | 簽署取消人名稱 | `1001509` | Worker、Ragic 按鈕 |
| `startTime` | 任務開始時間 | `1001491` | Worker |
| `endTime` | 任務結束時間 | `1001492` | Worker |
| `signUrl` | 現場簽署網址 | `1001490` | Worker |
| `apiStatus` | API 執行狀態 | `1001497` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `apiMessage` | API 訊息 | `1001498` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `syncedAt` | API 最後同步時間 | `1001499` | Worker |
| `subtable` | 簽署關卡子表格 Key | `1001494` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerOrder` | 簽署順序 | `1001470` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerName` | 簽署人姓名 | `1001471` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerEmail` | 簽署人 Email | `1001472` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerPhone` | 簽署人手機號碼 | `1001473` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerStatus` | 簽署人個別狀態 | `1001474` | Worker |
| `signerSignedTime` | 簽署時間 | `1001475` | Worker |
| `signerReason` | 簽署原因／拒簽原因 | `1001495` | Worker |
| `signerFace` | 現場簽署 | `1001477` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerOtp` | 需要 OTP 驗證 | `1001478` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerHostEmail` | 現場簽主持人 Email | `1001479` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerHostName` | 現場簽主持人姓名 | `1001480` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerCulture` | 通知語言 | `1001481` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `signerVideo` | 需要聲明錄影 | `1001496` | Worker、Ragic 按鈕、Ragic Post-workflow |
| `workerUrl` | 串接設定：Cloudflare Worker URL | `1001500` | Ragic 按鈕、Ragic Post-workflow |
| `importName1` | 第１位簽核人姓名（拋轉隱藏欄位） | `1001502` | Ragic Post-workflow |
| `importEmail1` | 第１位簽核人信箱（拋轉隱藏欄位） | `1001504` | Ragic Post-workflow |
| `importPhone1` | 第１位簽核人電話（拋轉隱藏欄位） | `1001506` | Ragic Post-workflow |
| `importName2` | 第２位簽核人姓名（拋轉隱藏欄位） | `1001503` | Ragic Post-workflow |
| `importEmail2` | 第２位簽核人信箱（拋轉隱藏欄位） | `1001505` | Ragic Post-workflow |
| `importPhone2` | 第２位簽核人電話（拋轉隱藏欄位） | `1001507` | Ragic Post-workflow |

**另外：**兩份 Ragic JS 的 `SETTING_FIELDS.workerUrl = 1001500`、`SETTING_FIELDS.workerToken = 1001508`，分別是串接設定的 Worker URL 與遮罩金鑰。`PATHS.task`、`PATHS.settings` 是表單路徑設定，Worker 的完整任務表單網址在 `wrangler.jsonc` 的 `RAGIC_TASK_FORM_URL`。

> 特別注意：Ragic Workflow 無法直接 import Cloudflare Worker 的設定檔，三份變數表必須保持一致；附帶的 Node 測試可檢查共用欄位值是否同步。

## 拋轉 PDF 與上鎖規則（Ragic JS V1.2）

- 新增任務時，若 `pdf` 空白且 `sourceRecordUrl`、`sourceTemplateId` 皆有值，透過 `.carbone?fileFormat=pdf&ragicCustomPrintTemplateId=...` 下載報表並將附件寫入 `pdf`。
- 已有 `pdf` 時絕不覆寫；來源值不完整時顯示錯誤並標記 API 執行狀態「失敗」。
- 手動發起按鈕會在呼叫 Worker 前再檢查一次 PDF，讓先前失敗的來源可以修正後重試。
- Worker 成功回寫 Instance ID 才執行 `entry.lock()`；取消或失敗時不自動解鎖；同步成功時也會補嘗試上鎖。
- 只鎖定**電子簽署任務表單這筆記錄**，不會修改或鎖定原始來源表單。
- `1001511` 目前接受 `https://*.ragic.com/.../表單編號/記錄編號`，若來源使用自訂網域需另評估放行。
- Cloudflare Worker 本身沒有變更，`/health` 仍可顯示 `1.1.1`，此為正常現象。
