import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { api, ASSET_CLASSES, fmtNum } from '../api';
import { useMarket } from '../contexts/MarketContext';

const FX_PAIRS = { USD: 'USD', JPY: 'JPY', EUR: 'EUR', GBP: 'GBP', HKD: 'HKD' };
const RADIAN = Math.PI / 180;

export default function Dashboard() {
  const [holdings, setHoldings] = useState([]);
  const { prices, fxRates, loading: fetching, refreshMarketData } = useMarket();
  const [manualValues, setManualValues] = useState({});
  const [errors, setErrors] = useState([]);

  const fetchHoldings = useCallback(async () => {
    const data = await api.getHoldings();
    setHoldings(data);
  }, []);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const fetchAllPrices = async () => {
    await refreshMarketData(holdings);
  };

  const computeValue = (h) => {
    if (manualValues[h.id] != null) return manualValues[h.id];
    const fxRate = h.currency === 'TWD' ? 1 : (fxRates[h.currency] ?? null);
    
    if (h.asset_class === 'cash' || h.asset_class === 'forex') {
      return fxRate ? h.quantity * fxRate : null;
    }
    
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

  // Rebalancing logic
  const [targets, setTargets] = useState(() => {
    const saved = localStorage.getItem('asset_targets_v2');
    return saved ? JSON.parse(saved) : { stocks: 70, bonds: 30, emergencyFund: 300000 };
  });

  useEffect(() => {
    localStorage.setItem('asset_targets_v2', JSON.stringify(targets));
  }, [targets]);

  const rebalanceData = useMemo(() => {
    const stocksVal = groupedDataMap['股票'].value;
    const bondsVal = groupedDataMap['債券'].value;
    const cashVal = groupedDataMap['現金'].value;
    
    const targetCashVal = Number(targets.emergencyFund) || 0;
    const remainingValue = Math.max(0, totalValue - targetCashVal);
    const stockRatio = Number(targets.stocks) || 0;
    const bondRatio = Number(targets.bonds) || 0;
    const totalRatio = stockRatio + bondRatio || 1;
    
    const targetStocksVal = (remainingValue * stockRatio) / totalRatio;
    const targetBondsVal = (remainingValue * bondRatio) / totalRatio;

    return [
      { key: 'stocks', label: '股票', current: stocksVal, targetVal: targetStocksVal, ratio: targets.stocks },
      { key: 'bonds', label: '債券', current: bondsVal, targetVal: targetBondsVal, ratio: targets.bonds },
      { key: 'cash', label: '現金 (預備金)', current: cashVal, targetVal: targetCashVal },
    ].map(item => ({ ...item, diff: item.targetVal - item.current }));
  }, [targets, totalValue, groupedDataMap]);

  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);

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

      {/* Rebalancing Section */}
      <div className="card border-indigo-500/20 bg-indigo-950/5 overflow-hidden">
        <button onClick={() => setIsRebalanceOpen(!isRebalanceOpen)}
          className="w-full flex items-center justify-between group">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-400" />
            <h3 className="text-sm font-semibold">資產再平衡建議</h3>
          </div>
          <div className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-300 ${isRebalanceOpen ? 'rotate-180' : ''}`}>
            <AlertCircle size={18} className="rotate-180" style={{ display: 'none' }} /> {/* dummy for layout if needed */}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </button>
        
        {isRebalanceOpen && (
          <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rebalanceData.map(item => (
                <div key={item.key} className="space-y-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      {item.key === 'cash' ? '緊急預備金目標' : `${item.label} 期望比例`}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.key === 'cash' ? (
                        <input type="number" value={targets.emergencyFund}
                          onChange={e => setTargets(prev => ({ ...prev, emergencyFund: e.target.value }))}
                          className="w-28 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-indigo-300 text-right focus:outline-none focus:border-indigo-500" />
                      ) : (
                        <input type="number" value={item.ratio}
                          onChange={e => setTargets(prev => ({ ...prev, [item.key]: e.target.value }))}
                          className="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-indigo-300 text-center focus:outline-none focus:border-indigo-500" />
                      )}
                      <span className="text-xs text-slate-500">{item.key === 'cash' ? 'TWD' : '%'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">當前現值</span>
                    <span className="text-slate-300">{fmtNum(Math.round(item.current))} TWD</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">應調整金額 (TWD)</div>
                    <div className={`text-lg font-mono font-bold ${item.diff > 0 ? 'text-emerald-400' : item.diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {item.diff > 0 ? '+' : ''}{fmtNum(Math.round(item.diff))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">目標總額: {fmtNum(Math.round(item.targetVal))}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-3 bg-slate-900/30 rounded-lg text-[11px] text-slate-500">
              <p>※ 邏輯：先扣除「緊急預備金」絕對值，剩餘資產再依據「股債比例」進行分配。</p>
            </div>
          </div>
        )}
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
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  {/* 子項目 (內圈) */}
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={70}
                    dataKey="value" nameKey="name" stroke="none">
                    {chartData.map((entry) => (
                      <Cell key={`inner-${entry.key}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {/* 大類別 (外圈) */}
                  <Pie data={groupedChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={115}
                    dataKey="value" nameKey="name" stroke="none">
                    {groupedChartData.map((entry, index) => (
                      <Cell key={`outer-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
                      return [`${fmtNum(value)} TWD (比例: ${pct}%)`, name];
                    }}
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* 自訂圖例 */}
              <div className="mt-4 space-y-4 px-2">
                <div>
                  <div className="text-xs text-slate-500 mb-2 border-b border-slate-700/50 pb-1">大類別</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {groupedChartData.map(entry => {
                      const pct = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : 0;
                      return (
                        <div key={entry.name} className="flex items-center text-xs">
                          <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-slate-300">{entry.name} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2 border-b border-slate-700/50 pb-1">子項目</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {chartData.map(entry => {
                      const pct = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : 0;
                      return (
                        <div key={entry.name} className="flex items-center text-xs">
                          <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-slate-300">{entry.name} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
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
