import { useState } from 'react';
import Modal from './Modal';
import { ASSET_CLASSES } from '../api';

const CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'GBP', 'HKD'];

export default function DividendForm({ holdings, onSave, onClose }) {
  const [form, setForm] = useState({
    holding_id: '',
    ticker: '',
    asset_class: 'tw_stock',
    received_date: new Date().toISOString().slice(0, 10),
    amount: '',
    currency: 'TWD',
    note: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleHoldingChange = (id) => {
    const h = holdings.find(h => h.id === parseInt(id));
    set('holding_id', id);
    if (h) set('ticker', h.ticker);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...form,
        holding_id: form.holding_id ? parseInt(form.holding_id) : null,
        // If linked to a holding, let the DB/server handle asset_class via link
        asset_class: form.holding_id ? null : form.asset_class,
        amount: parseFloat(form.amount),
      });
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error ?? '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="新增股息紀錄" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">關聯持倉（選填）</label>
          <select className="input" value={form.holding_id} onChange={e => handleHoldingChange(e.target.value)}>
            <option value="">— 不關聯 / 手動輸入代號 —</option>
            {holdings.map(h => (
              <option key={h.id} value={h.id}>{h.ticker} {h.name ? `(${h.name})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">標的代號 *</label>
          <input className="input" placeholder="e.g. 0050" value={form.ticker}
            onChange={e => set('ticker', e.target.value.toUpperCase())} required />
        </div>

        {!form.holding_id && (
          <div>
            <label className="label">資產類別 *</label>
            <select className="input" value={form.asset_class} onChange={e => set('asset_class', e.target.value)}>
              {ASSET_CLASSES.filter(ac => ac.value !== 'reinvest').map(ac => (
                <option key={ac.value} value={ac.value}>{ac.emoji} {ac.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">收到日期 *</label>
            <input className="input" type="date" max="9999-12-31" value={form.received_date}
              onChange={e => set('received_date', e.target.value)} required />
          </div>
          <div>
            <label className="label">幣別</label>
            <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">收益金額 *</label>
          <input className="input" type="number" inputMode="decimal" step="any" min="0.01" placeholder="0.00"
            value={form.amount} onChange={e => set('amount', e.target.value)} required />
        </div>

        <div>
          <label className="label">備註</label>
          <input className="input" placeholder="選填" value={form.note}
            onChange={e => set('note', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? '儲存中…' : '確認新增'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        </div>
      </form>
    </Modal>
  );
}
