# 資產追蹤系統 · Personal Asset Tracker

一個用於管理個人投資持倉、股息紀錄與現金流的工具。支援多幣別換算與自動化股息再投入記錄。

---

## 🛠 功能說明 (Features)

- **資產配置總覽**：提供資產分布圓餅圖（台股、美股、債券、現金等），並統一換算為 TWD 顯示。
- **持倉管理**：記錄不同幣別的持倉，整合 Yahoo Finance 獲取市價與匯率。
- **現金流紀錄**：整合股息收益與再投入動作，提供時間軸檢視。
- **一鍵更新**：支援批次更新所有持倉的最新市價與匯率。
- **深色介面**：採用深色系主題設計。

---

## 🏗 系統架構 (Architecture)

### 技術棧 (Tech Stack)
- **前端**: React (Vite), Tailwind CSS, Lucide React, Recharts.
- **後端**: Node.js, Express, SQLite.
- **數據源**: Yahoo Finance API。

### 目錄結構 (Project Structure)
- `/client`: 前端 React 原始碼。
  - `/src/pages`: 主要頁面組件。
  - `/src/contexts`: 市場數據上下文（MarketContext）。
- `/server`: 後端 Express 伺服器與 SQLite 資料庫。
- `/start_app.sh`: 啟動腳本。

---

## 🚀 啟動方式 (Setup)

1. **安裝依賴**：
   在 `client` 與 `server` 目錄下分別執行 `npm install`。

2. **執行專案**：
   執行根目錄的 `./start_app.sh` 啟動服務。

---

## 🤖 AI Agent 指南 (AI Agent Instructions)

### 1. 資料庫與資料模型
- 持倉資料存於 `holdings` 表，股息存於 `dividends` 表，再投入紀錄存於 `reinvestments` 表。
- `reinvestments` 透過 `dividend_id` 與來源股息關聯。

### 2. API 規範
- 獲取市場數據請調用 `/api/market/fx` 與 `/api/market/price`。
- 現金流時間軸資料由 `/api/cashflow` 提供。

### 3. 狀態管理
- 應使用 `MarketContext` 提供的 `useMarket` hook 存取全局價格與匯率數據，避免在各組件內重複請求 API。
- 換算邏輯中需處理匯率或市價為空 (`null`) 的情況。

---

## 📝 授權 (License)
MIT License.
