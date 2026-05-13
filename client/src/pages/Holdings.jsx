import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';
import { api, ASSET_CLASSES, getAssetClass, fmtNum } from '../api';
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
  const [prices, setPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState({});
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [loading, setLoading] = useState(true);

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
    try {
      if (assetClass === 'forex' || assetClass === 'cash') {
        if (currency === 'TWD') {
          setPrices(p => ({ ...p, [ticker]: 1 }));
        } else {
          const data = await api.getFX(currency, 'TWD');
          setPrices(p => ({ ...p, [ticker]: data.rate }));
        }
      } else {
        const symbol = currency === 'TWD' && !ticker.includes('.') ? `${ticker}.TW` : ticker;
        const data = await api.getPrice(symbol);
        setPrices(p => ({ ...p, [ticker]: data.price }));
      }
    } catch {
      setPrices(p => ({ ...p, [ticker]: null }));
    } finally {
      setLoadingPrices(p => ({ ...p, [ticker]: false }));
    }
  };

  const handleCreate = async (data) => {
    await api.createHolding(data);
    fetchHoldings();
  };

  const handleUpdate = async (data) => {
    await api.updateHolding(editTarget.id, data);
    fetchHoldings();
  };

  const handleAdjust = async (delta) => {
    await api.adjustQuantity(adjustTarget.id, delta);
    fetchHoldings();
  };

  const handleDelete = async (id) => {
    if (!confirm('確定刪除這筆持倉？')) return;
    await api.deleteHolding(id);
    fetchHoldings();
  };

  const filtered = filter === 'all' ? holdings : holdings.filter(h => h.asset_class === filter);

  const grouped = ASSET_CLASSES.map(ac => ({
    ...ac,
    items: holdings.filter(h => h.asset_class === ac.value),
    total: holdings.filter(h => h.asset_class === ac.value).reduce((s, h) => s + h.quantity, 0),
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">載入中…</div>
  );

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
            共 {filtered.length} 筆 {filter !== 'all' && `(${getAssetClass(filter).label})`}
          </p>
        </div>
        <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => { setEditTarget(null); setShowForm(true); }}>
          <Plus size={16} /> 新增持倉
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <BarChart2 className="mx-auto mb-3 opacity-30" size={40} />
          <p>尚無持倉資料</p>
          <p className="text-xs mt-1">點擊右上角「新增持倉」開始記錄</p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px] sm:min-w-0">
            <thead>
              <tr className="border-b border-slate-700/70 text-xs text-slate-500">
                <th className="text-left px-4 py-3">代號 / 名稱</th>
                <th className="text-left px-4 py-3">類別</th>
                <th className="text-right px-4 py-3">持有數量</th>
                <th className="text-right px-4 py-3">平均成本</th>
                <th className="text-right px-4 py-3">目前市價</th>
                <th className="text-right px-4 py-3">幣別</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => {
                const ac = getAssetClass(h.asset_class);
                const price = prices[h.ticker];
                return (
                  <tr key={h.id}
                    className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors
                      ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{h.ticker}</div>
                      {h.name && <div className="text-xs text-slate-500">{h.name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${STATUS_COLORS[h.asset_class]}`}>
                        {ac.emoji} {ac.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtNum(h.quantity, 4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {h.avg_cost ? fmtNum(h.avg_cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {loadingPrices[h.ticker] ? (
                          <RefreshCw size={12} className="animate-spin text-slate-500" />
                        ) : price != null ? (
                          <span className="font-mono text-emerald-400">{fmtNum(price)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                        <button onClick={() => fetchPrice(h.ticker, h.currency, h.asset_class)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                          title="刷新市價">
                          <RefreshCw size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">{h.currency}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setAdjustTarget(h)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-indigo-400 transition-colors"
                          title="調整數量">
                          <TrendingUp size={14} />
                        </button>
                        <button onClick={() => { setEditTarget(h); setShowForm(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-amber-400 transition-colors"
                          title="編輯">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(h.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors"
                          title="刪除">
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
        <HoldingForm
          holding={editTarget}
          onSave={editTarget ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
      {adjustTarget && (
        <AdjustQuantityModal
          holding={adjustTarget}
          onSave={handleAdjust}
          onClose={() => setAdjustTarget(null)}
        />
      )}
    </div>
  );
}
