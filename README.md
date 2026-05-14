# 投資追蹤系統 · Personal Investment Tracker

一個極簡、高效且美觀的個人投資追蹤系統。專為管理多幣別持倉、自動化股息再投入（DRIP）與現金流分析而設計。

![App Icon](client/public/logo.png)

---

## 🌟 核心功能 (Features)

- **資產配置總覽**：視覺化圓餅圖展示資產分布（台股、美股、債券、現金等），自動換算 TWD。
- **持倉管理**：支援多幣別（TWD, USD, JPY, EUR...）持倉記錄，整合 Yahoo Finance 即時市價與匯率。
- **現金流時間軸**：統一管理股息收益與再投入紀錄，支援同幣別合併再投入。
- **一鍵同步**：全局快取機制，一鍵更新所有市價與匯率。
- **深色模式優化**：原生深色主題介面，配備精緻的微動畫。

---

## 🛠 系統架構 (Architecture)

### 技術棧 (Tech Stack)
- **Frontend**: React (Vite), Tailwind CSS, Lucide React, Recharts.
- **Backend**: Node.js, Express, SQLite (better-sqlite3).
- **Data Source**: Yahoo Finance API (axios).

### 目錄結構 (Project Structure)
- `/client`: React 前端應用程式。
  - `/src/pages`: 核心頁面（Dashboard, Holdings, Dividends）。
  - `/src/contexts`: 全局狀態管理（MarketContext）。
  - `/src/api.js`: API 介面定義與公用函式。
- `/server`: Node.js 後端服務。
  - `index.js`: API 路由、資料庫邏輯與數據抓取。
  - `database.db`: SQLite 資料庫文件。
- `/start_app.sh`: 一鍵啟動腳本。

---

## 🚀 快速啟動 (Quick Start)

1. **安裝依賴**：
   ```bash
   # 安裝後端依賴
   cd server && npm install
   # 安裝前端依賴
   cd ../client && npm install
   ```

2. **啟動開發環境**：
   ```bash
   # 使用一鍵啟動腳本
   ./start_app.sh
   ```
   後端將運行於 `9458` 埠，前端 Vite 開發服務將自動啟動。

---

## 🤖 AI Agent 指南 (AI Agent Instructions)

如果您是正在維護此專案的 AI 助手，請遵循以下技術規範：

### 1. 資料庫架構 (Database Schema)
- **holdings**: 存儲資產持倉。關鍵欄位：`ticker`, `asset_class`, `quantity`, `avg_cost`, `currency`。
- **dividends**: 存儲股息紀錄。關鍵欄位：`holding_id`, `amount`, `currency`, `received_date`, `status`。
- **reinvestments**: 存儲再投入紀錄。透過 `dividend_id` 與股息關聯。

### 2. 重要 API 端點 (Key API Endpoints)
- `GET /api/holdings`: 獲取所有持倉。
- `GET /api/cashflow`: 獲取合併後的股息與再投入紀錄（時間軸）。
- `POST /api/reinvestments/auto`: 執行自動再投入邏輯。
- `GET /api/market/fx`: 獲取匯率（例如 `from=USD&to=TWD`）。
- `GET /api/market/price`: 獲取特定代號市價。

### 3. 狀態管理慣例
- 市價與匯率應優先透過 `MarketContext` 的 `useMarket` 存取，以確保全局數據一致性並減少不必要的 API 呼叫。
- 所有的換算邏輯（例如外幣轉台幣）應集中處理，並處理匯率缺失的 `null` 情況。

### 4. 樣式規範
- 保持 `slate-950` 的背景色與 `indigo`/`emerald` 的主題色。
- 所有的卡片應遵循 `.card` CSS 類別定義。

---

## 📝 授權 (License)
MIT License.
