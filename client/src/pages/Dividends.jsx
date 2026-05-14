import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, DollarSign, RefreshCw, CheckCircle2, Clock, CircleDot, Layers, BarChart2 } from 'lucide-react';
import { api, fmtNum } from '../api';
import DividendForm from '../components/DividendForm';
import ReinvestModal from '../components/ReinvestModal';
import PoolReinvestModal from '../components/PoolReinvestModal';

const STATUS_MAP = {
  pending:    { label: '待再投入', cls: 'bg-amber-600/20 text-amber-300 border-amber-700/50', Icon: Clock },
  partial:    { label: '部分投入', cls: 'bg-blue-600/20 text-blue-300 border-blue-700/50',   Icon: CircleDot },
  reinvested: { label: '已再投入', cls: 'bg-emerald-600/20 text-emerald-300 border-emerald-700/50', Icon: CheckCircle2 },
};

function DividendRow({ dividend, holdings, onReinvest, onDeleteDividend, onDeleteReinvestment }) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const st = STATUS_MAP[dividend.status] ?? STATUS_MAP.pending;
  const hasPending = dividend.pending_amount > 0.001;

  return (
    <>
      <tr className="border-b border-slate-800 hover:bg-slate-700/20 transition-colors">
        <td className="px-4 py-3">
          <div className="font-semibold">{dividend.ticker}</div>
          <div className="text-xs text-slate-500">{dividend.received_date}</div>
        </td>
        <td className="px-4 py-3 text-right font-mono">
          <div>{fmtNum(dividend.amount)}</div>
          <div className="text-xs text-slate-500">{dividend.currency}</div>
        </td>
        <td className="px-4 py-3 text-right font-mono">
          {hasPending ? (
            <span className="text-amber-400">{fmtNum(dividend.pending_amount)}</span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`badge border ${st.cls}`}>
            <st.Icon size={11} className="mr-1" />
            {st.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end">
            {hasPending && (
              <button onClick={() => setShowModal(true)} className="btn-success">
                <RefreshCw size={11} /> 再投入
              </button>
            )}
            {dividend.reinvestments?.length > 0 && (
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <button onClick={() => onDeleteDividend(dividend.id)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      {/* Reinvestment detail rows */}
      {expanded && dividend.reinvestments?.map(r => (
        <tr key={r.id} className="border-b border-slate-800/50 bg-slate-900/30">
          <td className="pl-10 pr-4 py-2 text-xs text-slate-400 flex items-center gap-2">
            <CheckCircle2 size={11} className="text-emerald-500" />
            → {r.target_ticker}
            {r.note && <span className="text-slate-600">（{r.note}）</span>}
          </td>
          <td className="px-4 py-2 text-right font-mono text-xs text-emerald-400">
            {fmtNum(r.amount)}
          </td>
          <td className="px-4 py-2 text-right text-xs text-slate-500">{r.reinvest_date}</td>
          <td />
          <td className="px-4 py-2 text-right">
            <button onClick={() => onDeleteReinvestment(r.id)}
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </td>
        </tr>
      ))}

      {showModal && (
        <ReinvestModal
          dividend={dividend}
          holdings={holdings}
          onSave={onReinvest}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default function Dividends() {
  const [dividends, setDividends] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [poolModalState, setPoolModalState] = useState(null);
  const [poolSelection, setPoolSelection] = useState({});

  const togglePoolSelection = (currency, ticker) => {
    setPoolSelection(prev => {
      const curSel = prev[currency] || {};
      return {
        ...prev,
        [currency]: {
          ...curSel,
          [ticker]: !curSel[ticker]
        }
      };
    });
  };

  const fetchAll = useCallback(async () => {
    const [d, h] = await Promise.all([api.getDividends(), api.getHoldings()]);
    setDividends(d);
    setHoldings(h);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (data) => {
    await api.createDividend(data);
    fetchAll();
  };

  const handleReinvest = async (dividendId, data) => {
    await api.addReinvestment(dividendId, data);
    fetchAll();
  };

  const handlePoolReinvest = async (data) => {
    await api.autoReinvest(data);
    fetchAll();
  };

  const handleDeleteDividend = async (id) => {
    if (!confirm('確定刪除這筆紀錄？')) return;
    await api.deleteDividend(id);
    fetchAll();
  };

  const handleDeleteReinvestment = async (id) => {
    if (!confirm('確定刪除這筆再投入紀錄？')) return;
    await api.deleteReinvestment(id);
    fetchAll();
  };

  const filtered = filterStatus === 'all' ? dividends : dividends.filter(d => d.status === filterStatus);

  // Group pending amounts by currency and ticker
  const pendingByCurrency = dividends.reduce((acc, d) => {
    if (d.pending_amount > 0.001) {
      if (!acc[d.currency]) acc[d.currency] = { total: 0, tickers: {} };
      acc[d.currency].total += d.pending_amount;
      if (!acc[d.currency].tickers[d.ticker]) {
        acc[d.currency].tickers[d.ticker] = 0;
      }
      acc[d.currency].tickers[d.ticker] += d.pending_amount;
    }
    return acc;
  }, {});

  // Summary stats (overall total values without currency conversion, which might be rough, but we keep the UI same)
  const totalReceived = dividends.reduce((s, d) => s + d.amount, 0);
  const totalPending = dividends.reduce((s, d) => s + (d.pending_amount ?? 0), 0);
  const totalReinvested = dividends.reduce((s, d) => s + (d.reinvested_amount ?? 0), 0);

  // Group total received amounts by ticker
  const totalByTicker = dividends.reduce((acc, d) => {
    const key = `${d.ticker}-${d.currency}`;
    if (!acc[key]) acc[key] = { ticker: d.ticker, currency: d.currency, total: 0 };
    acc[key].total += d.amount;
    return acc;
  }, {});
  const sortedTickers = Object.values(totalByTicker).sort((a, b) => b.total - a.total);

  const getHoldingName = (ticker) => {
    const h = holdings.find(h => h.ticker === ticker);
    return h?.name || '';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">載入中…</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '累計收益', value: totalReceived, color: 'text-slate-200', icon: <DollarSign size={16} /> },
          { label: '待再投入', value: totalPending, color: 'text-amber-400', icon: <Clock size={16} /> },
          { label: '已再投入', value: totalReinvested, color: 'text-emerald-400', icon: <CheckCircle2 size={16} /> },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <span className={s.color}>{s.icon}</span>
              {s.label}
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>
              {fmtNum(s.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Historical summary by ticker */}
      {sortedTickers.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-indigo-400" />
            <h3 className="text-sm font-semibold text-indigo-300">各標的累計收益</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sortedTickers.map(t => (
              <div key={`${t.ticker}-${t.currency}`} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 transition-all hover:border-slate-700">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-medium">{t.ticker}</span>
                  <span className="text-[10px] text-slate-600 truncate mb-1" title={getHoldingName(t.ticker)}>
                    {getHoldingName(t.ticker) || '—'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-slate-200">{fmtNum(t.total)}</span>
                    <span className="text-[9px] text-slate-500 uppercase">{t.currency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending pool */}
      {Object.entries(pendingByCurrency).length > 0 && (
        <div className="card border-amber-700/40 bg-amber-900/10 space-y-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">待再投入資金池</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(pendingByCurrency).map(([currency, data]) => {
              const selectedObj = poolSelection[currency] || {};
              const selectedTickers = Object.keys(selectedObj).filter(k => selectedObj[k]);
              const selectedSum = selectedTickers.reduce((sum, t) => sum + (data.tickers[t] || 0), 0);

              return (
                <div key={currency} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
                    <span className="font-semibold text-amber-400">{currency} 資金池</span>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-amber-400">{fmtNum(data.total)}</span>
                        {selectedSum > 0 && (
                          <span className="text-emerald-400 text-xs font-semibold animate-fade-in">
                            已選: {fmtNum(selectedSum)}
                          </span>
                        )}
                      </div>
                      <button onClick={() => setPoolModalState({ currency, maxAmount: selectedSum > 0 ? selectedSum : data.total })} 
                        className="btn-success py-1 px-2 text-xs">
                        <RefreshCw size={11} /> 合併再投入
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {Object.entries(data.tickers).map(([ticker, amt]) => (
                      <div key={ticker} className="flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 p-1 -mx-1 rounded hover:bg-slate-800/50 transition-colors">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input type="checkbox" 
                            className="rounded border-slate-600 bg-slate-900/50 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900" 
                            checked={!!selectedObj[ticker]}
                            onChange={() => togglePoolSelection(currency, ticker)}
                          />
                          <span className="flex items-baseline gap-1 truncate">
                            <span>{ticker}</span>
                            {getHoldingName(ticker) && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[120px] sm:max-w-none" title={getHoldingName(ticker)}>
                                ({getHoldingName(ticker)})
                              </span>
                            )}
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{fmtNum(amt)}</span>
                          <button onClick={() => setPoolModalState({ currency, sourceTicker: ticker, maxAmount: amt })} 
                            className="btn-success py-0.5 px-1.5 text-[10px]">
                            <RefreshCw size={10} /> 再投入
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <h2 className="text-lg font-semibold">現金流紀錄</h2>
          <div className="flex gap-1 overflow-x-auto pb-2 sm:pb-0 sm:ml-2 no-scrollbar">
            {[['all','全部'], ['pending','待投入'], ['partial','部分'], ['reinvested','已投入']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                  ${filterStatus === v ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => setShowForm(true)}>
          <Plus size={16} /> 新增紀錄
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <DollarSign className="mx-auto mb-3 opacity-30" size={40} />
          <p>尚無紀錄</p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px] sm:min-w-0">
            <thead>
              <tr className="border-b border-slate-700/70 text-xs text-slate-500">
                <th className="text-left px-4 py-3">標的 / 日期</th>
                <th className="text-right px-4 py-3">收益金額</th>
                <th className="text-right px-4 py-3">待投入</th>
                <th className="text-left px-4 py-3">狀態</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <DividendRow key={d.id} dividend={d} holdings={holdings}
                  onReinvest={handleReinvest}
                  onDeleteDividend={handleDeleteDividend}
                  onDeleteReinvestment={handleDeleteReinvestment}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DividendForm holdings={holdings} onSave={handleCreate} onClose={() => setShowForm(false)} />
      )}

      {poolModalState && (
        <PoolReinvestModal
          currency={poolModalState.currency}
          sourceTicker={poolModalState.sourceTicker}
          maxAmount={poolModalState.maxAmount}
          holdings={holdings}
          onSave={handlePoolReinvest}
          onClose={() => setPoolModalState(null)}
        />
      )}
    </div>
  );
}
