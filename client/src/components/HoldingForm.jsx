import { useState } from 'react';
import Modal from './Modal';
import { api, ASSET_CLASSES } from '../api';

const CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'GBP', 'HKD'];

export default function HoldingForm({ holding, onSave, onClose }) {
  const isEdit = !!holding;
  const [form, setForm] = useState({
    ticker: holding?.ticker ?? '',
    name: holding?.name ?? '',
    asset_class: holding?.asset_class ?? 'tw_stock',
    quantity: holding?.quantity ?? '',
    avg_cost: holding?.avg_cost ?? '',
    currency: holding?.currency ?? 'TWD',
    note: holding?.note ?? '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...form,
        quantity: parseFloat(form.quantity) || 0,
        avg_cost: form.avg_cost !== '' ? parseFloat(form.avg_cost) : null,
      });
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error ?? '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleTickerBlur = async () => {
    if (!form.ticker || form.name) return;
    
    let symbol = form.ticker;
    if (form.asset_class === 'tw_stock' && !symbol.includes('.')) {
      symbol += '.TW';
    }

    try {
      const data = await api.searchName(symbol);
      if (data && data.name) {
        set('name', data.name);
      }
    } catch {
      // Ignore on error
    }
  };

  return (
    <Modal title={isEdit ? '編輯持倉' : '新增持倉'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">代號 *</label>
            <input className="input" placeholder="e.g. 0050, AAPL" value={form.ticker}
              onChange={e => set('ticker', e.target.value.toUpperCase())}
              onBlur={handleTickerBlur} required />
          </div>
          <div>
            <label className="label">名稱</label>
            <input className="input" placeholder="e.g. 元大台灣50" value={form.name}
              onChange={e => set('name', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">資產類別 *</label>
          <div className="grid grid-cols-5 gap-1.5">
            {ASSET_CLASSES.map(ac => (
              <button key={ac.value} type="button"
                onClick={() => {
                  set('asset_class', ac.value);
                  // Auto-suggest currency based on asset class
                  if (ac.value === 'tw_stock') set('currency', 'TWD');
                  if (ac.value === 'us_stock') set('currency', 'USD');
                }}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all
                  ${form.asset_class === ac.value
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                <span className="text-lg">{ac.emoji}</span>
                <span>{ac.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">持有數量 *</label>
            <input className="input" type="number" inputMode="decimal" step="any" min="0" placeholder="0" value={form.quantity}
              onChange={e => set('quantity', e.target.value)} required />
          </div>
          <div>
            <label className="label">平均成本</label>
            <input className="input" type="number" inputMode="decimal" step="any" min="0" placeholder="選填" value={form.avg_cost}
              onChange={e => set('avg_cost', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">幣別</label>
          <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label">備註</label>
          <input className="input" placeholder="選填" value={form.note}
            onChange={e => set('note', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? '儲存中…' : '確認儲存'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        </div>
      </form>
    </Modal>
  );
}
