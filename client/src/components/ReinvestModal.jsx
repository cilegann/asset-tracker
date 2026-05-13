import { useState } from 'react';
import Modal from './Modal';

export default function ReinvestModal({ dividend, holdings, onSave, onClose }) {
  const pendingAmount = dividend.amount - (dividend.reinvested_amount ?? 0);
  const [form, setForm] = useState({
    target_ticker: '',
    amount: pendingAmount.toFixed(2),
    reinvest_date: new Date().toISOString().slice(0, 10),
    note: '',
    update_holding: false,
    holding_id: '',
    quantity_delta: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleHoldingSelect = (id) => {
    const h = holdings.find(h => h.id === parseInt(id));
    set('holding_id', id);
    if (h) set('target_ticker', h.ticker);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (amt <= 0 || amt > pendingAmount + 0.001) {
      alert(`金額需介於 0 和 ${pendingAmount.toFixed(2)} 之間`);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        target_ticker: form.target_ticker.toUpperCase(),
        amount: amt,
        reinvest_date: form.reinvest_date,
        note: form.note,
      };
      if (form.update_holding && form.holding_id && form.quantity_delta) {
        payload.update_holding = {
          holding_id: parseInt(form.holding_id),
          quantity_delta: parseFloat(form.quantity_delta),
        };
      }
      await onSave(dividend.id, payload);
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error ?? '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`登記再投入 — ${dividend.ticker}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info bar */}
        <div className="bg-slate-900 rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-slate-500 text-xs">股息總額</p>
            <p className="font-semibold">{dividend.amount.toLocaleString()} {dividend.currency}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">待投入餘額</p>
            <p className="font-semibold text-amber-400">{pendingAmount.toLocaleString()} {dividend.currency}</p>
          </div>
        </div>

        <div>
          <label className="label">再投入標的 *</label>
          <div className="space-y-2">
            <select className="input" value={form.holding_id}
              onChange={e => handleHoldingSelect(e.target.value)}>
              <option value="">— 從持倉選取或手動輸入 —</option>
              {holdings.map(h => (
                <option key={h.id} value={h.id}>{h.ticker} {h.name ? `(${h.name})` : ''}</option>
              ))}
            </select>
            <input className="input" placeholder="代號（自動帶入或手動輸入）"
              value={form.target_ticker}
              onChange={e => set('target_ticker', e.target.value.toUpperCase())} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">再投入金額 *</label>
            <input className="input" type="number" step="any" min="0.01"
              max={pendingAmount} value={form.amount}
              onChange={e => set('amount', e.target.value)} required />
            <p className="text-xs text-slate-500 mt-1">可部分投入，最多 {pendingAmount.toFixed(2)}</p>
          </div>
          <div>
            <label className="label">再投入日期 *</label>
            <input className="input" type="date" value={form.reinvest_date}
              onChange={e => set('reinvest_date', e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="label">備註</label>
          <input className="input" placeholder="選填" value={form.note}
            onChange={e => set('note', e.target.value)} />
        </div>

        {/* Optional: update holding */}
        <div className="border border-slate-700 rounded-xl p-3 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.update_holding}
              onChange={e => set('update_holding', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            <span className="text-sm text-slate-300">同時更新持倉數量</span>
          </label>
          {form.update_holding && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="label">目標持倉</label>
                <select className="input" value={form.holding_id}
                  onChange={e => handleHoldingSelect(e.target.value)}>
                  <option value="">— 選擇持倉 —</option>
                  {holdings.map(h => (
                    <option key={h.id} value={h.id}>{h.ticker} {h.name ? `(${h.name})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">增加股數</label>
                <input className="input" type="number" step="any" min="0"
                  placeholder="e.g. 10" value={form.quantity_delta}
                  onChange={e => set('quantity_delta', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? '儲存中…' : '確認再投入'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        </div>
      </form>
    </Modal>
  );
}
