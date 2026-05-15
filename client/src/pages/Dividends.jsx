import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, DollarSign, RefreshCw, CheckCircle2, Clock,
  BarChart2, ArrowUpDown, TrendingUp, TrendingDown, ArrowRight, X
} from 'lucide-react';
import { api, fmtNum, getAssetClass } from '../api';
import DividendForm from '../components/DividendForm';
import PoolReinvestModal from '../components/PoolReinvestModal';
import Modal from '../components/Modal';

// ─────────────────────────────────────────────────────────────────────────────
// Cashflow row component
// ─────────────────────────────────────────────────────────────────────────────

function CashflowRow({ flow, onDeleteDividend, onDeleteReinvestment }) {
  const isDividend = flow.type === 'dividend';

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-700/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isDividend ? (
            <span className="w-5 h-5 rounded-full bg-emerald-900/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <TrendingUp size={11} />
            </span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-indigo-900/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <RefreshCw size={11} />
            </span>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{getAssetClass(flow.asset_class).emoji}</span>
              <div className="font-semibold text-sm">{flow.ticker}</div>
            </div>
            {!isDividend && flow.source_ticker && (
              <div className="text-[10px] text-slate-500 flex items-center gap-0.5 ml-4">
                來自 {flow.source_ticker} <ArrowRight size={8} />
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{flow.date}</td>
      <td className="px-4 py-3 text-right font-mono">
        <span className={isDividend ? 'text-emerald-400' : 'text-indigo-300'}>
          {isDividend ? '+' : ''}{fmtNum(flow.amount)}
        </span>
        <div className="text-[10px] text-slate-500 uppercase">{flow.currency}</div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">
        {flow.note || '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => isDividend ? onDeleteDividend(flow.raw_id) : onDeleteReinvestment(flow.raw_id)}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticker summary card
// ─────────────────────────────────────────────────────────────────────────────

function TickerCard({ t, selected, disabled, onToggle, onShowDetail, getHoldingName }) {
  const hasPending = t.pending > 0.001;

  return (
    <div
      onClick={() => onShowDetail(t)}
      className={`relative flex flex-col border rounded-xl p-3 cursor-pointer transition-all select-none group
        ${selected
          ? 'border-emerald-500 bg-emerald-900/20 ring-1 ring-emerald-500/30'
          : hasPending
            ? 'border-amber-500/40 bg-amber-900/10 hover:border-amber-500/60'
            : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700'
        }`}
    >
      {/* Selection Checkbox */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled || selected) onToggle(t);
        }}
        className={`absolute top-2 right-2 w-5 h-5 rounded-lg border flex items-center justify-center transition-all
          ${selected 
            ? 'bg-emerald-500 border-emerald-500' 
            : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
          }
          ${disabled && !selected ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
        `}
      >
        {selected && <CheckCircle2 size={12} className="text-white" />}
      </div>

      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs">{getAssetClass(t.asset_class).emoji}</span>
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide group-hover:text-slate-300 transition-colors">{t.ticker}</span>
      </div>
      <span className="text-[10px] text-slate-600 truncate mb-2" title={getHoldingName(t.ticker)}>
        {getHoldingName(t.ticker) || <span className="italic">—</span>}
      </span>

      {/* Total received */}
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-bold text-slate-200 text-sm">{fmtNum(t.total)}</span>
        <span className="text-[9px] text-slate-500 uppercase">{t.currency}</span>
      </div>

      {/* Pending Indicator */}
      {hasPending ? (
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={9} className="text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-400 font-mono font-medium">{fmtNum(t.pending)} 待投入</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-0.5 opacity-40">
          <CheckCircle2 size={9} className="text-slate-500 flex-shrink-0" />
          <span className="text-[10px] text-slate-500 font-mono">已全數投入</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticker Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

function TickerDetailModal({ ticker, currency, cashflows, onClose, onDeleteDividend, onDeleteReinvestment }) {
  const filtered = cashflows.filter(f => f.ticker === ticker && f.currency === currency);
  
  return (
    <Modal title={`${ticker} 現金流歷史 (${currency})`} onClose={onClose}>
      <div className="max-h-[60vh] overflow-y-auto -mx-6">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 z-10">
            <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left px-6 py-3">日期</th>
              <th className="text-left px-6 py-3">類型</th>
              <th className="text-right px-6 py-3">金額</th>
              <th className="text-left px-6 py-3">備註</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(flow => (
              <CashflowRow 
                key={flow.id} 
                flow={flow} 
                onDeleteDividend={onDeleteDividend} 
                onDeleteReinvestment={onDeleteReinvestment} 
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-10 text-slate-500">尚無紀錄</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'total_desc', label: '總收益↓' },
  { value: 'total_asc',  label: '總收益↑' },
  { value: 'pending_desc', label: '待投入↓' },
  { value: 'ticker_asc', label: '代號 A→Z' },
];

export default function Dividends() {
  const [dividends, setDividends] = useState([]);
  const [cashflows, setCashflows] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [poolModalState, setPoolModalState] = useState(null);
  const [detailTicker, setDetailTicker] = useState(null);

  // Ticker summary panel state
  const [sortKey, setSortKey] = useState('total_desc');
  const [selectedTickers, setSelectedTickers] = useState([]); // [{ticker, currency}]

  const fetchAll = useCallback(async () => {
    const [d, h, cf] = await Promise.all([
      api.getDividends(),
      api.getHoldings(),
      api.getCashflow(),
    ]);
    setDividends(d);
    setHoldings(h);
    setCashflows(cf);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (data) => { await api.createDividend(data); fetchAll(); };

  const handlePoolReinvest = async (data) => { await api.autoReinvest(data); fetchAll(); };

  const handleDeleteDividend = async (id) => {
    if (!confirm('確定刪除這筆股息紀錄？')) return;
    await api.deleteDividend(id);
    fetchAll();
  };

  const handleDeleteReinvestment = async (id) => {
    if (!confirm('確定刪除這筆再投入紀錄？')) return;
    await api.deleteReinvestment(id);
    fetchAll();
  };

  // ── Ticker summary data ──
  const tickerMap = dividends.reduce((acc, d) => {
    const key = `${d.ticker}-${d.currency}`;
    if (!acc[key]) acc[key] = { ticker: d.ticker, currency: d.currency, asset_class: d.asset_class, total: 0, pending: 0 };
    acc[key].total += d.amount;
    acc[key].pending += d.pending_amount ?? 0;
    return acc;
  }, {});

  const sortedTickerList = Object.values(tickerMap).sort((a, b) => {
    if (sortKey === 'total_desc')   return b.total - a.total;
    if (sortKey === 'total_asc')    return a.total - b.total;
    if (sortKey === 'pending_desc') return b.pending - a.pending;
    if (sortKey === 'ticker_asc')   return a.ticker.localeCompare(b.ticker);
    return 0;
  });

  // ── Selection logic (same currency only) ──
  const selectedCurrency = selectedTickers.length > 0 ? selectedTickers[0].currency : null;

  const toggleTicker = (t) => {
    const key = `${t.ticker}-${t.currency}`;
    const alreadySelected = selectedTickers.some(s => `${s.ticker}-${s.currency}` === key);
    if (alreadySelected) {
      setSelectedTickers(prev => prev.filter(s => `${s.ticker}-${s.currency}` !== key));
    } else {
      setSelectedTickers(prev => [...prev, t]);
    }
  };

  const selectedSum = selectedTickers.reduce((sum, t) => sum + t.pending, 0);

  const openReinvestModal = () => {
    if (selectedTickers.length === 0) return;
    const currency = selectedTickers[0].currency;
    const tickers = selectedTickers.map(t => t.ticker);
    setPoolModalState({ currency, maxAmount: selectedSum, sourceTickers: tickers });
  };

  // ── Summary stats ──
  const totalReceived  = dividends.reduce((s, d) => s + d.amount, 0);
  const totalPending   = dividends.reduce((s, d) => s + (d.pending_amount ?? 0), 0);
  const totalReinvested = dividends.reduce((s, d) => s + (d.reinvested_amount ?? 0), 0);

  const getHoldingName = (ticker) => holdings.find(h => h.ticker === ticker)?.name || '';

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">載入中…</div>;

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '累計收益', value: totalReceived,  color: 'text-slate-200',   icon: <DollarSign size={16} /> },
          { label: '待再投入', value: totalPending,   color: 'text-amber-400',   icon: <Clock size={16} /> },
          { label: '已再投入', value: totalReinvested, color: 'text-emerald-400', icon: <CheckCircle2 size={16} /> },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <span className={s.color}>{s.icon}</span>
              {s.label}
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{fmtNum(s.value)}</div>
          </div>
        ))}
      </div>

      {/* ── Ticker Summary + Selection ── */}
      {sortedTickerList.length > 0 && (
        <div className="card space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <BarChart2 size={16} className="text-indigo-400" />
              <h3 className="text-sm font-semibold text-indigo-300">各標的累計收益</h3>
              {selectedCurrency && (
                <span className="text-xs text-slate-500">
                  · 限選 {selectedCurrency} 幣別
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ArrowUpDown size={12} />
                <select
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value)}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Reinvest button */}
              {selectedTickers.length > 0 && (
                <button
                  onClick={openReinvestModal}
                  className="btn-success py-1 px-3 text-xs animate-fade-in flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  合併再投入
                  <span className="bg-emerald-700 text-emerald-200 rounded-md px-1.5 py-0.5 font-mono text-[10px]">
                    {fmtNum(selectedSum)} {selectedCurrency}
                  </span>
                </button>
              )}
              {selectedTickers.length > 0 && (
                <button
                  onClick={() => setSelectedTickers([])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  清除選取
                </button>
              )}
            </div>
          </div>

          {/* Grid of ticker cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {sortedTickerList.map(t => {
              const key = `${t.ticker}-${t.currency}`;
              const isSelected = selectedTickers.some(s => `${s.ticker}-${s.currency}` === key);
              // Disable if different currency already selected, or no pending
              const isCurrencyLocked = selectedCurrency && selectedCurrency !== t.currency;
              const isDisabled = isCurrencyLocked || t.pending <= 0.001;

              return (
                <TickerCard
                  key={key}
                  t={t}
                  selected={isSelected}
                  disabled={isDisabled}
                  onToggle={toggleTicker}
                  onShowDetail={setDetailTicker}
                  getHoldingName={getHoldingName}
                />
              );
            })}
          </div>

          {selectedTickers.length === 0 && (
            <p className="text-xs text-slate-600 text-center pt-1">
              點擊有「待投入」餘額的卡片來勾選，再按「合併再投入」
            </p>
          )}
        </div>
      )}

      {/* ── Cash Flow ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">現金流紀錄</h2>
        <button className="btn-primary justify-center" onClick={() => setShowForm(true)}>
          <Plus size={16} /> 新增紀錄
        </button>
      </div>

      {cashflows.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <DollarSign className="mx-auto mb-3 opacity-30" size={40} />
          <p>尚無紀錄</p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-700/70 text-xs text-slate-500">
                <th className="text-left px-4 py-3">標的</th>
                <th className="text-left px-4 py-3">日期</th>
                <th className="text-right px-4 py-3">金額</th>
                <th className="text-left px-4 py-3">備註</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cashflows.map(flow => (
                <CashflowRow
                  key={flow.id}
                  flow={flow}
                  onDeleteDividend={handleDeleteDividend}
                  onDeleteReinvestment={handleDeleteReinvestment}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {showForm && (
        <DividendForm holdings={holdings} onSave={handleCreate} onClose={() => setShowForm(false)} />
      )}

      {poolModalState && (
        <PoolReinvestModal
          currency={poolModalState.currency}
          sourceTicker={poolModalState.sourceTicker}
          sourceTickers={poolModalState.sourceTickers}
          maxAmount={poolModalState.maxAmount}
          holdings={holdings}
          onSave={handlePoolReinvest}
          onClose={() => { setPoolModalState(null); setSelectedTickers([]); }}
        />
      )}

      {detailTicker && (
        <TickerDetailModal
          ticker={detailTicker.ticker}
          currency={detailTicker.currency}
          cashflows={cashflows}
          onClose={() => setDetailTicker(null)}
          onDeleteDividend={handleDeleteDividend}
          onDeleteReinvestment={handleDeleteReinvestment}
        />
      )}
    </div>
  );
}
