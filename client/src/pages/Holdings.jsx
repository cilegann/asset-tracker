import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, RefreshCw, BarChart2, ArrowUpDown } from 'lucide-react';
import { api, ASSET_CLASSES, getAssetClass, fmtNum } from '../api';
import { useMarket } from '../contexts/MarketContext';
import HoldingForm from '../components/HoldingForm';
import AdjustQuantityModal from '../components/AdjustQuantityModal';

const STATUS_COLORS = {
  tw_stock: 'bg-indigo-600/20 text-indigo-300 border-indigo-700/50',
  us_stock: 'bg-cyan-600/20 text-cyan-300 border-cyan-700/50',
  bond:     'bg-amber-600/20 text-amber-300 border-amber-700/50',
  forex:    'bg-emerald-600/20 text-emerald-300 border-emerald-700/50',
  cash:     'bg-slate-600/20 text-slate-300 border-slate-700/50',
};

export default function Holdings() {
  const [holdings, setHoldings] = useState([]);
  const { prices, fxRates, loading: fetchingAll, refreshMarketData, updateSinglePrice } = useMarket();
  const [loadingPrices, setLoadingPrices] = useState({});
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('ticker');
  const [sortOrder, setSortOrder] = useState('asc');

  const fetchHoldings = useCallback(async () => {
    try {
      const data = await api.getHoldings();
      setHoldings(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const fetchPrice = async (ticker, currency, assetClass) => {
    setLoadingPrices(p => ({ ...p, [ticker]: true }));
    await updateSinglePrice(ticker, currency, assetClass);
    setLoadingPrices(p => ({ ...p, [ticker]: false }));
  };

  const fetchAllPrices = async () => {
    await refreshMarketData(holdings);
  };

  const handleCreate = async (data) => { await api.createHolding(data); fetchHoldings(); };
  const handleUpdate = async (data) => { await api.updateHolding(editTarget.id, data); fetchHoldings(); };
  const handleAdjust = async (delta) => { await api.adjustQuantity(adjustTarget.id, delta); fetchHoldings(); };
  const handleDelete = async (id) => {
    if (!confirm('確定刪除這筆持倉？')) return;
    await api.deleteHolding(id);
    fetchHoldings();
  };

  // Helper: compute TWD value
  const getTwdValue = (h) => {
    const fxRate = h.currency === 'TWD' ? 1 : (fxRates[h.currency] ?? null);
    if (h.asset_class === 'cash' || h.asset_class === 'forex') {
      return fxRate ? h.quantity * fxRate : null;
    }
    const price = prices[h.ticker];
    if (price == null || fxRate == null) return null;
    return h.quantity * price * fxRate;
  };

  const tableData = useMemo(() => {
    let data = filter === 'all' ? holdings : holdings.filter(h => h.asset_class === filter);
    
    // Attach twd_value for sorting
    data = data.map(h => ({ ...h, twd_value: getTwdValue(h) }));

    data.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      // Handle special sorting
      if (sortKey === 'asset_class') {
        valA = getAssetClass(a.asset_class).label;
        valB = getAssetClass(b.asset_class).label;
      }

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return data;
  }, [holdings, filter, sortKey, sortOrder, prices, fxRates]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const grouped = ASSET_CLASSES.map(ac => ({
    ...ac,
    items: holdings.filter(h => h.asset_class === ac.value),
  }));

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">載入中…</div>;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {grouped.map(g => (
          <button key={g.value} onClick={() => setFilter(filter === g.value ? 'all' : g.value)}
            className={`card p-2 sm:p-4 text-center cursor-pointer transition-all hover:border-slate-600
              ${filter === g.value ? 'border-indigo-500/60 bg-indigo-900/20' : ''}`}>
            <div className="text-lg sm:text-xl mb-1">{g.emoji}</div>
            <div className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">{g.label}</div>
            <div className="text-xs sm:text-sm font-semibold">{g.items.length} 檔</div>
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">投資部位</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            共 {tableData.length} 筆 {filter !== 'all' && `(${getAssetClass(filter).label})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAllPrices} disabled={Object.values(loadingPrices).some(Boolean)}
            className="btn-secondary w-full sm:w-auto justify-center">
            <RefreshCw size={15} className={Object.values(loadingPrices).some(Boolean) ? 'animate-spin' : ''} />
            刷新所有現值
          </button>
          <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => { setEditTarget(null); setShowForm(true); }}>
            <Plus size={16} /> 新增持倉
          </button>
        </div>
      </div>

      {/* Table */}
      {tableData.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <BarChart2 className="mx-auto mb-3 opacity-30" size={40} />
          <p>尚無持倉資料</p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[850px] sm:min-w-0">
            <thead>
              <tr className="border-b border-slate-700/70 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('ticker')}>
                  代號 / 名稱 {sortKey === 'ticker' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('asset_class')}>
                  類別 {sortKey === 'asset_class' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('quantity')}>
                  持有數量 {sortKey === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right px-4 py-3">平均成本</th>
                <th className="text-right px-4 py-3">目前市價</th>
                <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('twd_value')}>
                  現值 (TWD) {sortKey === 'twd_value' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((h, i) => {
                const ac = getAssetClass(h.asset_class);
                const price = prices[h.ticker];
                const twdValue = h.twd_value;
                return (
                  <tr key={h.id} className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${i === tableData.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{h.ticker}</div>
                      {h.name && <div className="text-[11px] text-slate-500 truncate max-w-[150px]">{h.name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${STATUS_COLORS[h.asset_class]}`}>
                        {ac.emoji} {ac.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {fmtNum(h.quantity, 4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">
                      {h.avg_cost ? fmtNum(h.avg_cost) : '—'}
                      <span className="ml-1 text-[9px] uppercase">{h.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {loadingPrices[h.ticker] ? (
                          <RefreshCw size={11} className="animate-spin text-slate-500" />
                        ) : price != null ? (
                          <span className="font-mono text-emerald-400 text-xs">{fmtNum(price)} <span className="text-[9px] text-slate-500">{h.currency}</span></span>
                        ) : (
                          <button onClick={() => fetchPrice(h.ticker, h.currency, h.asset_class)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                            <RefreshCw size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-300">
                      {twdValue != null ? fmtNum(twdValue, 0) : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setAdjustTarget(h)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-indigo-400" title="調整數量">
                          <TrendingUp size={14} />
                        </button>
                        <button onClick={() => { setEditTarget(h); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-amber-400" title="編輯">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(h.id)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400" title="刪除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <HoldingForm holding={editTarget} onSave={editTarget ? handleUpdate : handleCreate} onClose={() => { setShowForm(false); setEditTarget(null); }} />
      )}
      {adjustTarget && (
        <AdjustQuantityModal holding={adjustTarget} onSave={handleAdjust} onClose={() => setAdjustTarget(null)} />
      )}
    </div>
  );
}
