# BreezySign × Ragic 電子簽署整合模組（v1.1.1）

以 Cloudflare Worker 連接 Ragic 與好好簽 BreezySign，支援發起、取消、狀態同步、PDF 簽章位置辨識，以及已簽署 PDF／簽署軌跡檔回寫。

**部署方式：公開 GitHub → Cloudflare Workers Builds。** 每位使用者部署到**自己的 Cloudflare 帳號**，不透過模組提供者代管金鑰。

## 第一次安裝

請閱讀 **[部署指南.md](部署指南.md)**：從公開 GitHub 建立自己的 Worker、設定 3 組 Secrets、Callback、Ragic，以及第一次簽署測試。**不需使用 PowerShell。**

> 維護者：如果要新增 GitHub 一鍵部署按鈕，請依 [維護者更新指南.md](維護者更新指南.md) 最後一節，替換成自己的公開 Repository 網址。尚未確認 URL 前，不放置無法使用的示意按鈕。

## 現有部署升級至 v1.1.1

請閱讀 **[維護者更新指南.md](維護者更新指南.md)**：從原本 PowerShell 部署轉為現有 Worker 連接 GitHub、自動建置部署，並更新 Ragic 的兩份 JS。

### v1.1.1 修正

- 修正 `ragic/post-workflow.js` 新增任務時，隱藏欄位自動拋轉簽署人子表格所使用的錯誤變數名稱。
- 延續 v1.1 集中欄位 ID 設定與中文註解。
- `/health` 現在回傳 `version: "1.1.1"`，可用於核對 Worker 是否真正部署新版。
- 新增 `.gitignore`、公開 GitHub 部署指南及版本檢查測試。

## 檔案說明

```text
src/                 Cloudflare Worker 程式
ragic/               Ragic JS Workflow（需要另外貼到 Ragic）
tests/               本地／Cloudflare 建置測試
wrangler.jsonc        Worker 名稱、Ragic 表單網址及 Rate Limiting 設定
package.json          相依套件和腳本
FIELD_IDS.md          欄位 ID 中文對照
部署指南.md           一般使用者安裝說明
維護者更新指南.md      現有 Worker 切換 GitHub、升級說明
```

## GitHub → Cloudflare 建置設定

| 設定 | 內容 |
|---|---|
| Branch | `main` |
| Root directory | 專案根目錄 |
| Build command | `npm run check && npm run test` |
| Deploy command | `npx wrangler deploy` |

只有 `main` 分支更新才會部署至既有正式 Worker。若 `wrangler.jsonc` 的 `name` 與現有 Worker 不同，部署可能失敗或指向錯誤的 Worker，務必確認。

## 安全提醒

- **公開 Repo 不得有任何真實 API Key、Worker Token、簽署文件或個資。**
- Worker 必須自行設定：`RAGIC_API_KEY`、`BREEZYSIGN_API_KEY`、`WORKER_TOKEN` 三組 Secret。
- `wrangler.jsonc` 的 `vars.RAGIC_TASK_FORM_URL` 是**環境專屬值**，客戶必須修改為自己的 Ragic 任務表單網址，**不能直接沿用維護者的測試網址**。
- `Ragic` 的 Worker Token 欄位應使用文字遮罩並限制檢視權限。
- GitHub 自動部署**只會更新 Worker**；更新 `ragic/` 程式後，仍須到 Ragic Workflow 手動替換。

## 欄位 ID 維護

在三份程式最前面的中文註解區集中修改：`src/config.js`、`ragic/action-buttons.js`、`ragic/post-workflow.js`。請參考 [`FIELD_IDS.md`](FIELD_IDS.md)。

官方資料：[Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) · [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
