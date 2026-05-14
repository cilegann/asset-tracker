import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { api, ASSET_CLASSES, getAssetClass, fmtNum } from '../api';

const FX_PAIRS = { USD: 'USD', JPY: 'JPY', EUR: 'EUR', GBP: 'GBP', HKD: 'HKD' };
const RADIAN = Math.PI / 180;



export default function Dashboard() {
  const [holdings, setHoldings] = useState([]);
  const [prices, setPrices] = useState({});
  const [fxRates, setFxRates] = useState({ USD: null, JPY: null, EUR: null, GBP: null, HKD: null });
  const [manualValues, setManualValues] = useState({});
  const [fetching, setFetching] = useState(false);
  const [errors, setErrors] = useState([]);

  const fetchHoldings = useCallback(async () => {
    const data = await api.getHoldings();
    setHoldings(data);
  }, []);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const fetchAllPrices = async () => {
    if (holdings.length === 0) return;
    setFetching(true);
    setErrors([]);
    const newPrices = { ...prices };
    const newFx = { ...fxRates };
    const errs = [];

    // Fetch FX rates
    const currencies = [...new Set(holdings.map(h => h.currency).filter(c => c !== 'TWD'))];
    await Promise.allSettled(currencies.map(async (cur) => {
      try {
        const data = await api.getFX(cur, 'TWD');
        newFx[cur] = data.rate;
      } catch { errs.push(`匯率 ${cur}/TWD 取得失敗`); }
    }));

    // Fetch stock prices
    await Promise.allSettled(holdings.map(async (h) => {
      if (h.asset_class === 'cash' || h.asset_class === 'forex') return;
      const symbol = h.currency === 'TWD' && !h.ticker.includes('.') ? `${h.ticker}.TW` : h.ticker;
      try {
        const data = await api.getPrice(symbol);
        newPrices[h.ticker] = data.price;
      } catch { errs.push(`${h.ticker} 市價取得失敗`); }
    }));

    setPrices(newPrices);
    setFxRates(newFx);
    setErrors(errs);
    setFetching(false);
  };

  // Compute TWD value for each holding
  const computeValue = (h) => {
    if (manualValues[h.id] != null) return manualValues[h.id];
    const fxRate = h.currency === 'TWD' ? 1 : (fxRates[h.currency] ?? null);
    if (h.asset_class === 'cash') return h.quantity * (fxRate ?? 1);
    if (h.asset_class === 'forex') return h.quantity * (fxRate ?? 1);
    const price = prices[h.ticker];
    if (price == null || fxRate == null) return null;
    return h.quantity * price * fxRate;
  };

  const holdingsWithValues = holdings.map(h => ({ ...h, twd_value: computeValue(h) }));
  const totalValue = holdingsWithValues.reduce((s, h) => s + (h.twd_value ?? 0), 0);
  const hasAnyValue = totalValue > 0;

  // Group by asset class
  const groupedDataMap = {
    '股票': { value: 0, color: '#3b82f6' }, // blue-500
    '債券': { value: 0, color: '#f59e0b' }, // amber-500
    '現金': { value: 0, color: '#10b981' }  // emerald-500
  };

  const chartData = ASSET_CLASSES.map(ac => {
    const items = holdingsWithValues.filter(h => h.asset_class === ac.value);
    const value = items.reduce((s, h) => s + (h.twd_value ?? 0), 0);
    
    if (ac.value === 'tw_stock' || ac.value === 'us_stock') groupedDataMap['股票'].value += value;
    else if (ac.value === 'bond') groupedDataMap['債券'].value += value;
    else if (ac.value === 'cash' || ac.value === 'forex') groupedDataMap['現金'].value += value;

    return { name: `${ac.emoji} ${ac.label}`, value, color: ac.color, key: ac.value };
  }).filter(d => d.value > 0);

  const groupedChartData = Object.entries(groupedDataMap).map(([name, data]) => ({
    name,
    value: data.value,
    color: data.color
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">資產配置總覽</h2>
          <p className="text-xs text-slate-500 mt-0.5">數值換算為 TWD</p>
        </div>
        <button onClick={fetchAllPrices} disabled={fetching} className="btn-primary w-full sm:w-auto justify-center">
          <RefreshCw size={15} className={fetching ? 'animate-spin' : ''} />
          {fetching ? '取得市價中…' : '更新所有市價'}
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="card border-red-700/40 bg-red-900/10 space-y-1">
          {errors.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={12} /> {e}
            </div>
          ))}
        </div>
      )}

      {/* Total value */}
      <div className="card bg-gradient-to-br from-indigo-900/40 to-slate-800/60">
        <p className="text-xs text-slate-400 mb-1">總資產估值 (TWD)</p>
        <p className="text-3xl sm:text-4xl font-bold text-white break-all">{fmtNum(totalValue)}</p>
        <p className="text-xs text-slate-500 mt-2">
          {holdingsWithValues.filter(h => h.twd_value == null).length > 0
            ? `⚠ ${holdingsWithValues.filter(h => h.twd_value == null).length} 筆尚未取得市價，未計入總值`
            : '所有持倉已計入'}
        </p>
      </div>

      {/* Chart + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4">資產配置圖</h3>
          {!hasAnyValue ? (
            <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
              <div className="text-center">
                <TrendingUp className="mx-auto mb-2 opacity-30" size={32} />
                <p>點擊「更新所有市價」或手動輸入價值</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={groupedChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={85}
                  dataKey="value" nameKey="name" stroke="none">
                  {groupedChartData.map((entry, index) => (
                    <Cell key={`inner-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={95} outerRadius={125}
                  dataKey="value" nameKey="name" stroke="none">
                  {chartData.map((entry) => (
                    <Cell key={`outer-${entry.key}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
                    return [`${fmtNum(value)} TWD (比例: ${pct}%)`, name];
                  }}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0' }}
                />
                <Legend
                  formatter={(value, entry) => {
                    const pct = totalValue > 0 && entry.payload.value ? ((entry.payload.value / totalValue) * 100).toFixed(1) : 0;
                    return <span style={{ color: '#94a3b8', fontSize: 12 }}>{value} ({pct}%)</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown table */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold">各類別明細</h3>
          {ASSET_CLASSES.map(ac => {
            const items = holdingsWithValues.filter(h => h.asset_class === ac.value);
            if (items.length === 0) return null;
            const subtotal = items.reduce((s, h) => s + (h.twd_value ?? 0), 0);
            const pct = totalValue > 0 ? (subtotal / totalValue * 100).toFixed(1) : 0;

            return (
              <div key={ac.value} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{ac.emoji} {ac.label}</span>
                  <div className="text-right">
                    <span className="font-semibold" style={{ color: ac.color }}>{fmtNum(subtotal)}</span>
                    <span className="text-slate-500 text-xs ml-2">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: ac.color }} />
                </div>
                {/* Individual holdings */}
                <div className="pl-2 space-y-0.5">
                  {items.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-xs text-slate-500 gap-2">
                      <span className="truncate max-w-[120px] sm:max-w-none">{h.ticker} {h.name ? `(${h.name})` : ''}</span>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {h.twd_value == null ? (
                          <span className="text-slate-600">
                            {fmtNum(h.quantity, 4)} 單位 · 待更新市價
                            <input type="number" inputMode="decimal" min="0" placeholder="手動輸入TWD總值"
                              className="ml-2 w-28 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300
                                focus:outline-none focus:border-indigo-500"
                              onChange={e => setManualValues(v => ({
                                ...v, [h.id]: parseFloat(e.target.value) || null
                              }))} />
                          </span>
                        ) : (
                          <span className="text-slate-400">{fmtNum(h.twd_value)} TWD</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FX rates */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3">目前匯率 (對 TWD)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(fxRates).map(([cur, rate]) => (
            <div key={cur} className="bg-slate-900 rounded-xl p-3 text-center">
              <div className="text-[10px] sm:text-xs text-slate-500 mb-1">{cur}/TWD</div>
              <div className="text-sm sm:text-base font-semibold text-emerald-400">
                {rate ? fmtNum(rate, 4) : <span className="text-slate-600">—</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
