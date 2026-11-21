# Ragic × BreezySign 電子簽署整合模組

以 **Cloudflare Workers** 串接 **Ragic** 與 **好好簽 BreezySign**，讓使用者直接從 Ragic 發起、取消與追蹤電子簽署任務，並將已簽署 PDF 與簽署軌跡文件回寫 Ragic。

**目前版本：v1.1.1**｜**部署模式：公開 GitHub → Cloudflare 自動建置**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/truzz2024/ragic-breezysign)

> **首次部署前請先閱讀下面的設定流程。** 按下部署按鈕只是建立您自己的 GitHub 副本與 Worker，**不代表 Ragic、好好簽和金鑰已設定完成**。本專案仍有示範用的 `RAGIC_TASK_FORM_URL`，每位安裝者都必須改成自己資料庫的網址，才能正式使用。

## 功能

- 在 Ragic 發起簽署、取消簽署、手動重新取得簽署狀態。
- 支援多位簽署人、同時／依序簽署，以及新增任務時自動帶入預先匯入的簽署人。
- 辨識 PDF 內 `[[SIGN:1]]`、`[[SIGN:2]]` 等標記與相應簽署框位置。
- 接收 BreezySign Callback，更新任務與個別簽署人的狀態。
- 將已簽署 PDF、簽署軌跡 PDF 回寫 Ragic；檔案尚未產生時可稍後手動補抓。
- 已確認**未建立簽署任務**的 API 失敗，可修正後重新發起；結果不明的「待確認」會阻擋重複發起。
- Ragic 的 Worker 驗證金鑰欄位可使用文字遮罩。

每個安裝者使用**自己的 Cloudflare、Ragic 與 BreezySign 帳號**，獨立持有 Worker、API 金鑰與簽署資料；模組提供者不代管這些憑證。

```text
Ragic 電子簽署任務 ──發起／取消／同步──► 您的 Cloudflare Worker ──API──► BreezySign
        ▲                                      ▲                              │
        └────────── 狀態及 PDF 回寫 ────────────┴──────── Callback ─────────────┘
```

## 一、部署前準備

請先準備：

1. **Ragic 資料庫**：已安裝本電子簽署模組，並有管理表單與 JavaScript Workflow 的權限。
2. **Ragic 服務帳戶 API Key**：帳戶應有讀取附件、讀取及更新電子簽署任務資料的權限（必要時包含受保護欄位的權限）。
3. **BreezySign 企業帳戶與 API Key**：已啟用 API 使用資格。
4. **Cloudflare 帳號**：用來運行自己的 Worker。
5. **GitHub 帳號**：用來保存部署後的程式碼副本，方便未來從 GitHub 網頁更新。
6. **Worker 驗證金鑰**：自行用密碼產生器建立 **64 個隨機英數字元**；稍後同時填入 Cloudflare 與 Ragic。

> 本專案是整合程式，不包含 Ragic、BreezySign 的服務授權或簽署費用。請先確認您使用的服務方案。

## 二、第一次部署（全程可使用網頁）

### 步驟 1｜確認 Ragic 任務表單網址

開啟自己 Ragic 的「電子簽署任務」，複製**表單網址**，移除最後的單筆紀錄編號。例如：

```text
https://ap12.ragic.com/YourDatabase/breezysign/3
```

此網址稍後用作 `RAGIC_TASK_FORM_URL`。它必須指向**您自己的資料庫**；不要沿用示範專案的 `TruzzDemo` 網址。

也請確認模組的「串接設定」與「電子簽署任務」表單路徑；若不是 `/breezysign/2` 與 `/breezysign/3`，必須同步修改兩份 Ragic JS 頂部的 `PATHS` 設定。

### 步驟 2｜從公開專案部署到自己的 Cloudflare

1. 點選頁首 **Deploy to Cloudflare** 按鈕。
2. 登入／授權 Cloudflare 與 GitHub，依畫面建立**自己的 GitHub Repository 副本**及 Worker。
3. 確認部署專案包含 `src/`、`ragic/`、`tests/`、`package.json`、`wrangler.jsonc`，而且沒有多包一層資料夾。
4. 在自己的 GitHub 副本開啟 `wrangler.jsonc`，點鉛筆編輯：
   - `name`：您的 Worker 名稱，必須與實際部署目標一致。
   - `vars.RAGIC_TASK_FORM_URL`：改成**步驟 1 您自己的 Ragic 任務表單網址**。
   - `vars.BREEZYSIGN_API_URL`：通常保留預設值。
   - 其他設定（包括 `main: "src/index.js"`、`ratelimits`）請保留。
5. 按 **Commit changes**，讓 Cloudflare 重新建置與部署，確認 Deployments／Builds 結果為成功。

若要手動連結 Repository，Cloudflare Worker 的 Builds 設定可使用：

| 項目 | 設定值 |
|---|---|
| Production branch | `main` |
| Root directory | 專案根目錄（留空） |
| Build command | `npm run check && npm run test` |
| Deploy command | `npx wrangler deploy` |

> **請勿將真實 API Key、Worker Token、簽署文件或客戶個資提交至公開 GitHub。** 此處的 GitHub 是存放原始碼，不是金鑰或正式簽署文件的存放位置。

### 步驟 3｜在 Cloudflare 設定三組 Secret

進入自己 Worker 的 **Settings → Variables and Secrets**，建立以下三個 **Secret**（不是一般明碼環境變數，也不是只供建置使用的變數）：

| Secret 名稱 | 內容 |
|---|---|
| `RAGIC_API_KEY` | 您的 Ragic 服務帳戶 API Key |
| `BREEZYSIGN_API_KEY` | 您的 BreezySign API Key |
| `WORKER_TOKEN` | 自行產生的 64 字元隨機金鑰 |

請確認 `RAGIC_TASK_FORM_URL` 與 `BREEZYSIGN_API_URL` 已依 `wrangler.jsonc` 正確設定。**不要只在 Cloudflare 控制台修改同名的設定值，因為之後的 GitHub 部署可能以設定檔內容覆蓋。**

### 步驟 4｜確認 Worker 已上線

開啟 Worker 網址加上 `/health`：

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health
```

v1.1.1 正常部署時應回傳：

```json
{"ok":true,"service":"ragic-breezysign-worker","version":"1.1.1"}
```

`/health` **只能確認程式已部署**，不代表 Secret、Ragic 權限及 BreezySign Callback 已正確。

### 步驟 5｜設定 BreezySign Callback

在好好簽的 API／開發者設定中，將 Callback URL 設為：

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/callback
```

Callback 必須是外部可存取的 HTTPS 網址；**不需在網址附加 API Key 或 Worker Token**。若找不到相關欄位，請參考 [BreezySign Callback 文件](https://dev.breezysign.com/getting-started/callback)，或向好好簽確認帳號權限。

### 步驟 6｜填寫 Ragic 串接設定

在 Ragic 的「串接設定」表單填入：

| 欄位 | 內容 |
|---|---|
| Cloudflare Worker URL（預設 ID `1001500`） | `https://...workers.dev`，**不加 `/start` 或 `/callback`** |
| Worker 驗證金鑰（預設 ID `1001508`） | 與 Cloudflare `WORKER_TOKEN` **完全相同**的金鑰 |

將 `1001508` 設為**文字遮罩**，並限制串接設定表單的檢視及編輯權限。內附 JS 會以 `addIgnoreMaskDomain()` 讀取指定欄位。**文字遮罩是顯示限制，不是加密儲存；有足夠管理／設計權限的人仍可能取得原值。**

### 步驟 7｜確認 Ragic JavaScript Workflow

如 Ragic 模組已預裝 JS，請確認與本版本一致；否則由資料庫管理者操作：

| 安裝位置 | 應貼入的檔案 |
|---|---|
| 電子簽署任務 → Installed Sheet Scope | `ragic/action-buttons.js` |
| 電子簽署任務 → Post-workflow | `ragic/post-workflow.js` |

三個動作按鈕使用：

```javascript
breezyStart({id});
breezyCancel({id});
breezySync({id});
```

若模組表單的**欄位 ID 與路徑不同**，必須先調整 `src/config.js` 與兩份 `ragic/*.js` 開頭的中文註解設定區，再部署及儲存 Workflow。欄位對照請參考 [`FIELD_IDS.md`](FIELD_IDS.md)。

**注意：GitHub 自動部署只更新 Cloudflare Worker；不會自動修改 Ragic 已安裝的 Workflow。**

## 三、第一次簽署測試

1. 在 Ragic 新增一筆測試任務，發起方式先選**手動**。
2. 上傳一份 PDF（目前支援**單一 PDF，檔案上限 8 MB**），在簽署框內加入可辨識的文字標記 `[[SIGN:1]]`；第二位簽署人使用 `[[SIGN:2]]`。
3. 填妥簽署人及必要欄位，儲存後按「發起簽署」。
4. 確認 Ragic 寫入**好好簽任務 ID**，且 API 執行狀態為「成功」。
5. 完成簽署後確認主表單與簽署關卡子表格的狀態，以及「已簽署 PDF」和「簽署軌跡 PDF」。
6. 如果軌跡檔較晚產生，可使用「重新取得狀態」再抓取。

**避免重複建立及計費：**當 API 執行狀態為「待確認」時，應先到好好簽確認是否已建立任務；不能直接再次發起。只有確認**未建立任務**、並判定為可重試的失敗，才可修正後重新發起。只要已有好好簽任務 ID，就不能用同一筆 Ragic 紀錄重新建立任務。

## 四、維護、更新與版本確認

### 已部署 Worker 的管理者如何改用 GitHub？

如果您**已經有正常運作的 Worker**，**不要點一鍵部署按鈕重新建立另一個 Worker**，而是：

1. 先備份現有 Ragic Installed Sheet Scope 與 Post-workflow 程式，並記錄 Worker URL、名稱、Secret 名稱及 Callback URL。
2. 將目前完整原始碼放入自己的 GitHub Repository，確認根目錄直接包含 `src/`、`ragic/`、`tests/`、`package.json`、`wrangler.jsonc`。
3. 確認 `wrangler.jsonc` 的 `name`、`vars.RAGIC_TASK_FORM_URL`、`ratelimits` 均對應**目前正式環境**。
4. 在現有 Worker 進入 **Settings → Builds → Connect**，連結自己的 Repository 與 `main` 分支。
5. 設定建置指令 `npm run check && npm run test`、部署指令 `npx wrangler deploy`，關閉「停用建置」。
6. GitHub Commit 後，至 Cloudflare Builds／Deployments 檢查成功，再看 `/health` 版本是否更新。
7. 若新版含 `ragic/*.js` 變更，**務必另外複製到 Ragic Workflow**。舊版 Ragic JS 不會因 Worker 部署自動更新。

從此以 **GitHub 的 `main` 分支作為 Worker 原始碼唯一來源**。PowerShell 可以用來本機測試，但不建議再交錯部署到相同正式 Worker，以免版本不一致。

### 每次更新什麼？

| 更新項目 | 正確做法 |
|---|---|
| Worker 程式碼 | GitHub 修改 `src/` → Commit → Cloudflare 自動測試／部署 |
| 環境設定／Worker 名稱 | GitHub 修改 `wrangler.jsonc` → Commit → 部署 |
| API Key、Worker Token | Cloudflare **Variables and Secrets** 修改 Secret；不得放進公開 GitHub |
| Ragic JS | GitHub 修改 `ragic/` 保存原始碼，**另外手動更新 Ragic Workflow** |
| Ragic 欄位 ID | 同步檢查 `src/config.js`、`ragic/action-buttons.js`、`ragic/post-workflow.js` 的設定區 |
| 客戶副本 | 原始公開 Repository 更新**不會自動更新客戶自己的副本／Worker** |

### v1.1.1 更新重點

- 修正 `ragic/post-workflow.js` 在新增任務時，從隱藏匯入欄位自動帶入簽署人子表格的變數名稱。
- 延續 v1.1：Worker 與兩份 Ragic JS 的欄位 ID 集中管理並加入中文註解。
- `/health` 版本號顯示 `1.1.1`，方便核對部署結果。
- 保留先前修正過的 PDF 座標、Callback、附件回寫、失敗重試及金鑰遮罩功能。

## 五、常見問題

| 問題 | 排查方法 |
|---|---|
| GitHub 上傳後有大量 JS 散落根目錄 | Worker JS 應放 `src/`，Ragic JS 應放 `ragic/`，測試檔應放 `tests/`；根目錄保留 `package.json`、`wrangler.jsonc` 等專案檔案。 |
| 在 VS Code for Web 刪檔，GitHub 卻還看得到 | 編輯器中的變更需要 **Commit & Push**，才會更新 GitHub 上的 `main`。 |
| Cloudflare 找不到 Repository | 確認已授權 Cloudflare 的 GitHub App 存取該 Repository。 |
| GitHub 更新了，但 `/health` 還是舊版 | 查看 Cloudflare Builds 是否成功、使用的是否為 `main` 與正確 Worker；並確認 `wrangler.jsonc` 的 `main` 是 `src/index.js`。 |
| Worker 回應缺少環境設定 | 確認 `RAGIC_TASK_FORM_URL`、三組 Secret 與部署目標是否一致。 |
| Ragic 出現 401／Unauthorized | 比對 Ragic 遮罩欄位 `1001508` 與 Cloudflare `WORKER_TOKEN` 是否相同。 |
| 無法取得或回寫 PDF | 檢查 Ragic 服務帳戶權限、任務表單網址及欄位 ID。 |
| 修改了 `ragic/*.js`，功能仍沒變 | 須將新版程式**另外貼入 Ragic Workflow**，GitHub／Cloudflare 不會自動安裝。 |
| API 狀態是「待確認」 | 先至 BreezySign 檢查是否已建立任務，避免重複發起。 |

## 六、檔案結構

```text
ragic-breezysign/
├── src/                 # Cloudflare Worker 程式碼
├── ragic/               # Ragic JavaScript Workflow
├── tests/               # 程式測試
├── .gitignore           # 排除本機密鑰、暫存與套件
├── package.json         # 相依套件及檢查／部署腳本
├── package-lock.json    # 相依版本鎖定（如果存在且與 package.json 相符，建議保留）
├── wrangler.jsonc       # Worker 設定、Ragic 表單網址、Rate Limiting
├── FIELD_IDS.md         # 欄位 ID 中文對照（技術參考）
└── README.md            # 唯一正式安裝與維護指南（本文件）
```

## 七、安全提醒與官方參考

- 不要把 API Key、Worker Token、`.env`、`.dev.vars`、簽署 PDF 或個資加入公開 Repository；若曾經提交真實金鑰，請立即輪替並處理 GitHub 歷史紀錄。
- `.gitignore` 只能防止部分**尚未追蹤**的檔案被提交，不能清除已公開的歷史。
- Ragic Worker Token 欄位使用文字遮罩，同時限制串接設定表單與 Workflow 的管理權限。
- 不同客戶必須部署到自己的 Worker，並設定自己的 `RAGIC_TASK_FORM_URL`、三組 Secret、Callback；不要共用維護者的憑證或測試網址。
- `/health` 是版本檢查，不是端對端簽署驗證；修改後仍應以測試任務檢查。

官方參考：

- [Cloudflare：Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Cloudflare：Workers Builds（GitHub 自動部署）](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare：Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Ragic：服務帳戶](https://www.ragic.com/intl/zh-TW/doc/170/service-account)
- [BreezySign：API 設定](https://dev.breezysign.com/getting-started/setup)
- [BreezySign：Callback](https://dev.breezysign.com/getting-started/callback)
