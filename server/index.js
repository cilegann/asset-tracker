const express = require('express');
const cors = require('cors');
const axios = require('axios');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 9458;

app.use(cors());
app.use(express.json());

// ── Validation Helpers ────────────────────────────────────────────────────────
const isInvalidNum = (val) => val === null || val === undefined || isNaN(parseFloat(val)) || !isFinite(val);
const sanitizeSymbol = (sym) => (sym || '').toString().toUpperCase().replace(/[^A-Z0-9.\-=]/g, '').slice(0, 20);

// ── TWSE/TPEx Stock Name Cache ───────────────────────────────────────────────
let twStockCache = null;
let twStockCacheTime = 0;

async function getTwStocks() {
  const now = Date.now();
  if (twStockCache && (now - twStockCacheTime < 1000 * 60 * 60 * 12)) {
    return twStockCache;
  }

  const map = new Map();
  try {
    const twseRes = await axios.get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', { timeout: 8000 });
    if (Array.isArray(twseRes.data)) {
      twseRes.data.forEach(item => {
        if (item.Code && item.Name) map.set(item.Code, item.Name);
      });
    }
  } catch (err) { console.error('TWSE fetch error:', err.message); }

  try {
    const tpexRes = await axios.get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes', { timeout: 8000 });
    if (Array.isArray(tpexRes.data)) {
      tpexRes.data.forEach(item => {
        if (item.SecuritiesCompanyCode && item.CompanyName) map.set(item.SecuritiesCompanyCode, item.CompanyName);
      });
    }
  } catch (err) { console.error('TPEx fetch error:', err.message); }

  if (map.size > 0) {
    twStockCache = map;
    twStockCacheTime = now;
  }
  return twStockCache || new Map();
}

// ── Holdings API ──────────────────────────────────────────────────────────────

// GET all holdings
app.get('/api/holdings', (req, res) => {
  const rows = db.prepare('SELECT * FROM holdings ORDER BY asset_class, ticker').all();
  res.json(rows);
});

// POST create holding
app.post('/api/holdings', (req, res) => {
  const { ticker, name, asset_class, quantity, avg_cost, currency, note } = req.body;
  if (!ticker || !asset_class) return res.status(400).json({ error: 'ticker and asset_class are required' });

  if (quantity !== undefined && isInvalidNum(quantity)) return res.status(400).json({ error: 'Invalid quantity' });
  if (avg_cost !== undefined && avg_cost !== null && isInvalidNum(avg_cost)) return res.status(400).json({ error: 'Invalid avg_cost' });

  const upperTicker = ticker.toUpperCase();

  const result = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM holdings WHERE ticker = ?').get(upperTicker);

    if (existing) {
      // Merge with existing
      const oldQty = existing.quantity || 0;
      const oldCost = existing.avg_cost || 0;
      const newQty = parseFloat(quantity) || 0;
      const newCost = parseFloat(avg_cost) || 0;

      let combinedAvgCost = existing.avg_cost;
      // Only recalculate average cost if a positive cost was provided for the new shares
      if (newQty > 0 && newCost > 0) {
        if (oldQty > 0 && oldCost > 0) {
          combinedAvgCost = ((oldQty * oldCost) + (newQty * newCost)) / (oldQty + newQty);
        } else {
          combinedAvgCost = newCost;
        }
      }

      db.prepare(`
        UPDATE holdings SET
          quantity = ?, avg_cost = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(oldQty + newQty, combinedAvgCost, existing.id);

      return { id: existing.id, status: 200 };
    }

    const stmt = db.prepare(`
      INSERT INTO holdings (ticker, name, asset_class, quantity, avg_cost, currency, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRes = stmt.run(
      upperTicker, name || '', asset_class,
      quantity ?? 0, avg_cost ?? null,
      currency || 'TWD', note || ''
    );
    return { id: insertRes.lastInsertRowid, status: 201 };
  })();

  const row = db.prepare('SELECT * FROM holdings WHERE id = ?').get(result.id);
  res.status(result.status).json(row);
});

// PUT update holding
app.put('/api/holdings/:id', (req, res) => {
  const { ticker, name, asset_class, quantity, avg_cost, currency, note } = req.body;

  if (quantity !== undefined && isInvalidNum(quantity)) return res.status(400).json({ error: 'Invalid quantity' });
  if (avg_cost !== undefined && avg_cost !== null && isInvalidNum(avg_cost)) return res.status(400).json({ error: 'Invalid avg_cost' });

  const existing = db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE holdings SET
      ticker = ?, name = ?, asset_class = ?, quantity = ?,
      avg_cost = ?, currency = ?, note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    ticker ?? existing.ticker, name ?? existing.name,
    asset_class ?? existing.asset_class, quantity ?? existing.quantity,
    avg_cost ?? existing.avg_cost, currency ?? existing.currency,
    note ?? existing.note, req.params.id
  );
  res.json(db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id));
});

// PATCH update holding quantity (buy/sell)
app.patch('/api/holdings/:id/quantity', (req, res) => {
  const { delta } = req.body; // positive = buy, negative = sell
  if (isInvalidNum(delta)) return res.status(400).json({ error: 'Invalid delta' });

  const existing = db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const newQty = existing.quantity + parseFloat(delta);
  if (newQty < 0) return res.status(400).json({ error: 'Insufficient quantity' });

  db.prepare(`UPDATE holdings SET quantity = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newQty, req.params.id);
  res.json(db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id));
});

// DELETE holding
app.delete('/api/holdings/:id', (req, res) => {
  const result = db.prepare('DELETE FROM holdings WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Dividends API ─────────────────────────────────────────────────────────────

// GET all dividends (with reinvestments joined)
app.get('/api/dividends', (req, res) => {
  const dividends = db.prepare(`
    SELECT d.*, 
      COALESCE(d.asset_class, h.asset_class, (SELECT asset_class FROM holdings WHERE ticker = d.ticker LIMIT 1)) as asset_class,
      COALESCE(SUM(r.amount), 0) as reinvested_amount
    FROM dividends d
    LEFT JOIN holdings h ON d.holding_id = h.id
    LEFT JOIN reinvestments r ON r.dividend_id = d.id
    GROUP BY d.id
    ORDER BY d.received_date DESC
  `).all();

  const result = dividends.map(d => ({
    ...d,
    pending_amount: d.amount - d.reinvested_amount,
    reinvestments: db.prepare('SELECT * FROM reinvestments WHERE dividend_id = ? ORDER BY reinvest_date').all(d.id)
  }));
  res.json(result);
});

// GET unified cashflow: dividends + reinvestments merged and sorted by date
app.get('/api/cashflow', (req, res) => {
  const dividends = db.prepare(`
    SELECT d.*, 
      COALESCE(d.asset_class, h.asset_class, (SELECT asset_class FROM holdings WHERE ticker = d.ticker LIMIT 1)) as asset_class,
      COALESCE(SUM(r.amount), 0) as reinvested_amount
    FROM dividends d
    LEFT JOIN holdings h ON d.holding_id = h.id
    LEFT JOIN reinvestments r ON r.dividend_id = d.id
    GROUP BY d.id
  `).all();

  const divFlows = dividends.map(d => ({
    id: `d-${d.id}`,
    type: 'dividend',
    date: d.received_date,
    ticker: d.ticker,
    asset_class: d.asset_class,
    amount: d.amount,
    currency: d.currency,
    note: d.note,
    status: d.status,
    raw_id: d.id,
  }));

  const reinvestments = db.prepare(`
    SELECT r.*, d.ticker as source_ticker, d.currency
    FROM reinvestments r
    JOIN dividends d ON d.id = r.dividend_id
    ORDER BY r.reinvest_date DESC
  `).all();

  const reinvestFlows = reinvestments.map(r => ({
    id: `r-${r.id}`,
    type: 'reinvestment',
    date: r.reinvest_date,
    ticker: r.target_ticker,
    source_ticker: r.source_ticker,
    asset_class: 'reinvest',
    amount: -r.amount,
    currency: r.currency,
    note: r.note,
    raw_id: r.id,
  }));

  const all = [...divFlows, ...reinvestFlows].sort((a, b) => b.date.localeCompare(a.date));
  res.json(all);
});


// POST create dividend record
app.post('/api/dividends', (req, res) => {
  const { holding_id, ticker, received_date, amount, currency, note, asset_class } = req.body;
  if (!ticker || !received_date || amount == null)
    return res.status(400).json({ error: 'ticker, received_date, amount are required' });

  if (isInvalidNum(amount) || amount < 0) return res.status(400).json({ error: 'Invalid amount' });

  const result = db.prepare(`
    INSERT INTO dividends (holding_id, ticker, received_date, amount, currency, note, asset_class)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(holding_id ?? null, ticker.toUpperCase(), received_date, amount, currency || 'TWD', note || '', asset_class || null);

  res.status(201).json(db.prepare('SELECT * FROM dividends WHERE id = ?').get(result.lastInsertRowid));
});

// DELETE dividend
app.delete('/api/dividends/:id', (req, res) => {
  const result = db.prepare('DELETE FROM dividends WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Reinvestments API ─────────────────────────────────────────────────────────

// POST add reinvestment to a dividend
app.post('/api/dividends/:id/reinvestments', (req, res) => {
  const { target_ticker, amount, reinvest_date, note, update_holding } = req.body;
  const dividend = db.prepare('SELECT * FROM dividends WHERE id = ?').get(req.params.id);
  if (!dividend) return res.status(404).json({ error: 'Dividend not found' });
  if (!target_ticker || !amount || !reinvest_date)
    return res.status(400).json({ error: 'target_ticker, amount, reinvest_date are required' });

  // Check remaining amount
  const { reinvested_amount } = db.prepare(
    'SELECT COALESCE(SUM(amount),0) as reinvested_amount FROM reinvestments WHERE dividend_id = ?'
  ).get(req.params.id);
  if (amount > dividend.amount - reinvested_amount + 0.001)
    return res.status(400).json({ error: 'Amount exceeds remaining pending amount' });

  const doWork = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO reinvestments (dividend_id, target_ticker, amount, reinvest_date, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, target_ticker.toUpperCase(), amount, reinvest_date, note || '');

    // Update dividend status
    const newTotal = reinvested_amount + amount;
    const newStatus = newTotal >= dividend.amount - 0.001 ? 'reinvested' : 'partial';
    db.prepare('UPDATE dividends SET status = ? WHERE id = ?').run(newStatus, req.params.id);

    // Optional: update holding quantity
    if (update_holding && update_holding.holding_id && update_holding.quantity_delta) {
      const h = db.prepare('SELECT * FROM holdings WHERE id = ?').get(update_holding.holding_id);
      if (h) {
        db.prepare(`UPDATE holdings SET quantity = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(h.quantity + update_holding.quantity_delta, update_holding.holding_id);
      }
    }
    return result.lastInsertRowid;
  });

  const newId = doWork();
  res.status(201).json(db.prepare('SELECT * FROM reinvestments WHERE id = ?').get(newId));
});

// POST auto reinvest from pool of dividends (smallest pending first)
app.post('/api/reinvestments/auto', (req, res) => {
  const { currency, source_ticker, source_tickers, target_ticker, amount, reinvest_date, note, update_holding } = req.body;
  if (!currency || !target_ticker || !amount || !reinvest_date)
    return res.status(400).json({ error: 'currency, target_ticker, amount, reinvest_date are required' });

  // Get all pending dividends for this currency (and optional source_ticker/source_tickers)
  let query = `
    SELECT d.id, d.amount, d.ticker, COALESCE(SUM(r.amount), 0) as reinvested_amount
    FROM dividends d
    LEFT JOIN reinvestments r ON r.dividend_id = d.id
    WHERE d.currency = ? AND d.status != 'reinvested'
  `;
  const params = [currency];

  if (source_tickers && Array.isArray(source_tickers) && source_tickers.length > 0) {
    const placeholders = source_tickers.map(() => '?').join(',');
    query += ` AND d.ticker IN (${placeholders})`;
    params.push(...source_tickers);
  } else if (source_ticker) {
    query += ` AND d.ticker = ?`;
    params.push(source_ticker);
  }

  query += ` GROUP BY d.id`;

  const dividends = db.prepare(query).all(...params);

  const pendingDividends = dividends.map(d => ({
    ...d,
    pending_amount: d.amount - d.reinvested_amount
  })).filter(d => d.pending_amount > 0);

  // Sort by smallest pending amount first
  pendingDividends.sort((a, b) => a.pending_amount - b.pending_amount);

  const totalAvailable = pendingDividends.reduce((s, d) => s + d.pending_amount, 0);
  if (amount > totalAvailable + 0.001) {
    return res.status(400).json({ error: 'Amount exceeds total available pending dividends in this currency' });
  }

  const doWork = db.transaction(() => {
    let amountNeeded = amount;
    const createdIds = [];

    for (const d of pendingDividends) {
      if (amountNeeded <= 0.001) break;

      const deductAmount = Math.min(amountNeeded, d.pending_amount);
      const result = db.prepare(`
        INSERT INTO reinvestments (dividend_id, target_ticker, amount, reinvest_date, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(d.id, target_ticker.toUpperCase(), deductAmount, reinvest_date, note || '');

      createdIds.push(result.lastInsertRowid);
      amountNeeded -= deductAmount;

      // Update dividend status
      const newTotal = d.reinvested_amount + deductAmount;
      const newStatus = newTotal >= d.amount - 0.001 ? 'reinvested' : 'partial';
      db.prepare('UPDATE dividends SET status = ? WHERE id = ?').run(newStatus, d.id);
    }

    // Optional: update holding quantity
    if (update_holding && update_holding.holding_id && update_holding.quantity_delta) {
      const h = db.prepare('SELECT * FROM holdings WHERE id = ?').get(update_holding.holding_id);
      if (h) {
        db.prepare(`UPDATE holdings SET quantity = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(h.quantity + update_holding.quantity_delta, update_holding.holding_id);
      }
    }
    return createdIds;
  });

  const ids = doWork();
  const newRecords = ids.map(id => db.prepare('SELECT * FROM reinvestments WHERE id = ?').get(id));
  res.status(201).json(newRecords);
});

// DELETE reinvestment
app.delete('/api/reinvestments/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM reinvestments WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });

  db.transaction(() => {
    db.prepare('DELETE FROM reinvestments WHERE id = ?').run(req.params.id);
    // Recalculate dividend status
    const dividend = db.prepare('SELECT * FROM dividends WHERE id = ?').get(r.dividend_id);
    if (dividend) {
      const { reinvested_amount } = db.prepare(
        'SELECT COALESCE(SUM(amount),0) as reinvested_amount FROM reinvestments WHERE dividend_id = ?'
      ).get(r.dividend_id);
      const newStatus = reinvested_amount <= 0 ? 'pending' :
        reinvested_amount >= dividend.amount - 0.001 ? 'reinvested' : 'partial';
      db.prepare('UPDATE dividends SET status = ? WHERE id = ?').run(newStatus, r.dividend_id);
    }
  })();

  res.json({ success: true });
});

// ── Market Data API (Yahoo Finance proxy) ─────────────────────────────────────

app.get('/api/market/price', async (req, res) => {
  const symbol = sanitizeSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const fetchYahoo = async (sym) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d&lang=zh-Hant&region=TW`;
    return axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.yahoo.com/'
      },
      timeout: 8000
    });
  };

  try {
    let response;
    try {
      response = await fetchYahoo(symbol);
    } catch (err) {
      if (err.response?.status === 404 && symbol.endsWith('.TW')) {
        const fallbackSymbol = symbol.replace('.TW', '.TWO');
        response = await fetchYahoo(fallbackSymbol);
      } else {
        throw err;
      }
    }

    const meta = response.data?.chart?.result?.[0]?.meta;
    if (!meta) return res.status(502).json({ error: 'No data from Yahoo Finance' });

    let displayName = meta.shortName || meta.longName || '';

    // ── Try to get Chinese name for Taiwan stocks ──
    const upperSym = (meta.symbol || symbol).toUpperCase();
    if (upperSym.endsWith('.TW') || upperSym.endsWith('.TWO')) {
      const cleanSymbol = upperSym.replace('.TW', '').replace('.TWO', '');
      const map = await getTwStocks();
      if (map.has(cleanSymbol)) {
        displayName = map.get(cleanSymbol);
      }
    }

    res.json({
      symbol: meta.symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency,
      exchange: meta.exchangeName,
      timestamp: meta.regularMarketTime,
      name: displayName
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch market data', detail: err.message });
  }
});

app.get('/api/market/search', async (req, res) => {
  const symbol = sanitizeSymbol(req.query.symbol);
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  // 1. Try Taiwan stock local cache
  const isNumeric = /^\d{4,6}$/.test(symbol);
  if (symbol.endsWith('.TW') || symbol.endsWith('.TWO') || isNumeric) {
    const cleanSymbol = symbol.replace('.TW', '').replace('.TWO', '');
    const map = await getTwStocks();
    if (map.has(cleanSymbol)) {
      return res.json({ name: map.get(cleanSymbol) });
    }
  }

  // 2. Fallback to Yahoo Finance
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&lang=zh-Hant&region=TW&quotesCount=1`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });
    const quote = response.data?.quotes?.[0];
    if (!quote) return res.json({ name: '' });

    res.json({ name: quote.longname || quote.shortname || '' });
  } catch (err) {
    res.status(502).json({ error: 'Failed to search market data', detail: err.message });
  }
});

// FX rate: TWD to target currency using Yahoo Finance
app.get('/api/market/fx', async (req, res) => {
  const { from = 'USD', to = 'TWD' } = req.query;
  try {
    const symbol = `${from}${to}=X`;
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d&lang=zh-Hant&region=TW`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });
    const meta = response.data?.chart?.result?.[0]?.meta;
    if (!meta) return res.status(502).json({ error: 'No FX data' });

    res.json({ from, to, rate: meta.regularMarketPrice, timestamp: meta.regularMarketTime });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch FX data', detail: err.message });
  }
});

// ── Summary (for pie chart) ───────────────────────────────────────────────────

app.get('/api/summary', (req, res) => {
  const holdings = db.prepare('SELECT * FROM holdings WHERE quantity > 0').all();
  res.json({ holdings });
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Financial Tracker API running on http://localhost:${PORT}`);
  // Pre-fetch Taiwan stock names in the background
  getTwStocks().catch(() => {});
});
