const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS holdings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL,
    name        TEXT    NOT NULL DEFAULT '',
    asset_class TEXT    NOT NULL CHECK(asset_class IN ('tw_stock','us_stock','bond','forex','cash')),
    quantity    REAL    NOT NULL DEFAULT 0 CHECK(quantity >= -1000000), -- Allow some negative for shorting if needed, but usually positive
    avg_cost    REAL    CHECK(avg_cost >= 0),
    currency    TEXT    NOT NULL DEFAULT 'TWD',
    note        TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dividends (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    holding_id      INTEGER REFERENCES holdings(id) ON DELETE SET NULL,
    ticker          TEXT    NOT NULL,
    received_date   TEXT    NOT NULL,
    amount          REAL    NOT NULL CHECK(amount >= 0),
    currency        TEXT    NOT NULL DEFAULT 'TWD',
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','reinvested')),
    note            TEXT    DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reinvestments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dividend_id     INTEGER NOT NULL REFERENCES dividends(id) ON DELETE CASCADE,
    target_ticker   TEXT    NOT NULL,
    amount          REAL    NOT NULL CHECK(amount >= 0),
    reinvest_date   TEXT    NOT NULL,
    note            TEXT    DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
