import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, RefreshCw, BarChart2, ArrowUpDown, X, DollarSign, Clock, Info } from 'lucide-react';
import { api, ASSET_CLASSES, getAssetClass, fmtNum } from '../api';
import { useMarket } from '../contexts/MarketContext';
import HoldingForm from '../components/HoldingForm';
import AdjustQuantityModal from '../components/AdjustQuantityModal';
import Modal from '../components/Modal';

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailTarget, setDetailTarget] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('holdings_columns');
    return saved ? JSON.parse(saved) : ['ticker', 'asset_class', 'quantity', 'avg_cost', 'price', 'twd_value', 'actions'];
  });

  const [showColumnSettings, setShowColumnSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('holdings_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const COLUMNS = [
    { id: 'ticker',      label: '代號/名稱' },
    { id: 'asset_class', label: '類別' },
    { id: 'quantity',    label: '數量' },
    { id: 'avg_cost',    label: '平均成本' },
    { id: 'price',       label: '市價' },
    { id: 'twd_value',   label: '現值(TWD)' },
    { id: 'actions',     label: '操作' },
  ];

  const toggleColumn = (id) => {
    setVisibleColumns(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(c => c !== id);
      }
      return [...prev, id];
    });
  };

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

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tableData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tableData.map(h => h.id)));
    }
  };

  const selectedTotal = useMemo(() => {
    return tableData
      .filter(h => selectedIds.has(h.id))
      .reduce((sum, h) => sum + (h.twd_value || 0), 0);
  }, [tableData, selectedIds]);

  const grouped = ASSET_CLASSES.map(ac => ({
    ...ac,
    items: holdings.filter(h => h.asset_class === ac.value),
  }));

  // ─────────────────────────────────────────────────────────────────────────────
  // Position Detail Modal Component
  // ─────────────────────────────────────────────────────────────────────────────
  const PositionDetailModal = ({ h, onClose }) => {
    const ac = getAssetClass(h.asset_class);
    const price = prices[h.ticker];
    const twdValue = h.twd_value;
    const unrealizedGain = (price && h.avg_cost) ? (price - h.avg_cost) * h.quantity : null;
    const gainPercent = (price && h.avg_cost) ? ((price - h.avg_cost) / h.avg_cost) * 100 : null;

    return (
      <Modal title={`持倉詳情: ${h.ticker}`} onClose={onClose}>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-xl font-bold text-slate-100">{h.name || h.ticker}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge border ${STATUS_COLORS[h.asset_class]}`}>
                  {ac.emoji} {ac.label}
                </span>
                <span className="text-xs text-slate-500 uppercase">{h.currency}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase mb-1">現值 (TWD)</div>
              <div className="text-2xl font-bold text-indigo-400 font-mono">
                {twdValue != null ? fmtNum(twdValue, 0) : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card bg-slate-800/40 border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">持有數量</div>
              <div className="text-lg font-semibold font-mono">{fmtNum(h.quantity, 4)}</div>
            </div>
            <div className="card bg-slate-800/40 border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">目前市價</div>
              <div className="text-lg font-semibold font-mono text-emerald-400">
                {price != null ? fmtNum(price) : '—'}
              </div>
            </div>
            <div className="card bg-slate-800/40 border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">平均成本</div>
              <div className="text-lg font-semibold font-mono text-amber-400">
                {h.avg_cost ? fmtNum(h.avg_cost) : '—'}
              </div>
            </div>
            <div className="card bg-slate-800/40 border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">未實現損益</div>
              <div className={`text-lg font-semibold font-mono ${unrealizedGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {unrealizedGain != null ? (unrealizedGain >= 0 ? '+' : '') + fmtNum(unrealizedGain) : '—'}
                {gainPercent != null && (
                  <span className="text-xs ml-1 opacity-80">({gainPercent.toFixed(2)}%)</span>
                )}
              </div>
            </div>
          </div>

          {h.note && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase">備註</div>
              <div className="bg-slate-900/40 rounded-lg p-3 text-sm text-slate-300 border border-slate-800/50 whitespace-pre-wrap">
                {h.note}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setEditTarget(h); setShowForm(true); onClose(); }} className="btn-secondary text-xs">
              <Pencil size={14} /> 編輯
            </button>
            <button onClick={() => { setAdjustTarget(h); onClose(); }} className="btn-secondary text-xs">
              <TrendingUp size={14} /> 調整數量
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">載入中…</div>;

  const isVisible = (id) => visibleColumns.includes(id);

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
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
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative flex-1 sm:flex-none">
            <button onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="btn-secondary w-full justify-center shrink-0">
              <Pencil size={15} /> 欄位
            </button>
            {showColumnSettings && (
              <>
                {/* Mobile Backdrop */}
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 sm:hidden" onClick={() => setShowColumnSettings(false)} />

                <div className="fixed inset-x-4 top-1/4 sm:absolute sm:inset-auto sm:top-full sm:right-0 mt-2 z-50 card p-4 w-auto sm:w-48 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border-indigo-500/30">
                  <div className="flex items-center justify-between mb-3 sm:mb-2">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">顯示欄位</div>
                    <button className="sm:hidden p-1 text-slate-500" onClick={() => setShowColumnSettings(false)}>
                      <Plus size={18} className="rotate-45" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-1">
                    {COLUMNS.map(col => (
                      <label key={col.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/40 border border-slate-700/30 sm:bg-transparent sm:border-0 sm:p-1.5 sm:rounded hover:bg-slate-700/50 cursor-pointer transition-colors">
                        <input type="checkbox" checked={isVisible(col.id)} onChange={() => toggleColumn(col.id)} className="checkbox-custom" />
                        <span className="text-xs text-slate-200">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <button className="btn-primary w-full mt-4 sm:hidden justify-center" onClick={() => setShowColumnSettings(false)}>
                    完成設定
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={fetchAllPrices} disabled={fetchingAll}
            className="btn-secondary flex-1 sm:flex-none justify-center shrink-0">
            <RefreshCw size={15} className={fetchingAll ? 'animate-spin' : ''} />
            刷新現值
          </button>
          <button className="btn-primary flex-1 sm:flex-none justify-center shrink-0" onClick={() => { setEditTarget(null); setShowForm(true); }}>
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
        <div className="card p-0 overflow-x-auto relative">
          <table className={`w-full text-sm transition-all duration-300 ${visibleColumns.length > 4 ? 'min-w-[800px]' : 'min-w-full'} sm:min-w-full`}>
            <thead>
              <tr className="border-b border-slate-700/70 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left w-10 shrink-0">
                  <input type="checkbox" checked={selectedIds.size === tableData.length && tableData.length > 0}
                    onChange={toggleSelectAll}
                    className="checkbox-custom" />
                </th>
                {isVisible('ticker') && (
                  <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('ticker')}>
                    代號 / 名稱 {sortKey === 'ticker' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                {isVisible('asset_class') && (
                  <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('asset_class')}>
                    類別 {sortKey === 'asset_class' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                {isVisible('quantity') && (
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('quantity')}>
                    持有數量 {sortKey === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                {isVisible('avg_cost') && <th className="text-right px-4 py-3">平均成本</th>}
                {isVisible('price') && <th className="text-right px-4 py-3">目前市價</th>}
                {isVisible('twd_value') && (
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('twd_value')}>
                    現值 (TWD) {sortKey === 'twd_value' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                {isVisible('actions') && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {tableData.map((h, i) => {
                const ac = getAssetClass(h.asset_class);
                const price = prices[h.ticker];
                const twdValue = h.twd_value;
                const isSelected = selectedIds.has(h.id);
                return (
                  <tr key={h.id} 
                    onClick={() => setDetailTarget(h)}
                    className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors cursor-pointer
                    ${isSelected ? 'bg-indigo-900/10' : ''} ${i === tableData.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(h.id)}
                        className="checkbox-custom" />
                    </td>
                    {isVisible('ticker') && (
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">{h.ticker}</div>
                        {h.name && <div className="text-[11px] text-slate-500 truncate max-w-[150px]">{h.name}</div>}
                      </td>
                    )}
                    {isVisible('asset_class') && (
                      <td className="px-4 py-3">
                        <span className={`badge border ${STATUS_COLORS[h.asset_class]}`}>
                          {ac.emoji} {ac.label}
                        </span>
                      </td>
                    )}
                    {isVisible('quantity') && (
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {fmtNum(h.quantity, 4)}
                      </td>
                    )}
                    {isVisible('avg_cost') && (
                      <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">
                        {h.avg_cost ? fmtNum(h.avg_cost) : '—'}
                        <span className="ml-1 text-[9px] uppercase">{h.currency}</span>
                      </td>
                    )}
                    {isVisible('price') && (
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
                    )}
                    {isVisible('twd_value') && (
                      <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-300">
                        {twdValue != null ? fmtNum(twdValue, 0) : <span className="text-slate-700">—</span>}
                      </td>
                    )}
                    {isVisible('actions') && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Summary Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="card bg-indigo-600 shadow-2xl shadow-indigo-500/20 border-indigo-400/30 text-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">已選擇 {selectedIds.size} 項持倉</div>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs hover:underline opacity-80">取消</button>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-xs opacity-70 mb-1">所選現值總額 (TWD)</div>
              <div className="text-2xl font-bold font-mono">
                {fmtNum(selectedTotal, 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <HoldingForm holding={editTarget} onSave={editTarget ? handleUpdate : handleCreate} onClose={() => { setShowForm(false); setEditTarget(null); }} />
      )}
      {adjustTarget && (
        <AdjustQuantityModal holding={adjustTarget} onSave={handleAdjust} onClose={() => setAdjustTarget(null)} />
      )}
      {detailTarget && (
        <PositionDetailModal h={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}
