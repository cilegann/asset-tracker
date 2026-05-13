import { useState } from 'react';
import Modal from './Modal';

export default function AdjustQuantityModal({ holding, onSave, onClose }) {
  const [mode, setMode] = useState('buy'); // 'buy' | 'sell' | 'set'
  const [delta, setDelta] = useState('');
  const [newQty, setNewQty] = useState(holding.quantity);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let d;
      if (mode === 'set') {
        d = parseFloat(newQty) - holding.quantity;
      } else {
        d = mode === 'buy' ? parseFloat(delta) : -parseFloat(delta);
      }
      await onSave(d);
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error ?? '更新失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`調整持倉 — ${holding.ticker}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-900 rounded-xl p-3 text-sm flex justify-between">
          <span className="text-slate-400">目前持有數量</span>
          <span className="font-semibold">{holding.quantity.toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[['buy','買入','text-emerald-400'], ['sell','賣出','text-red-400'], ['set','直接設定','text-indigo-400']].map(([v, l, c]) => (
            <button key={v} type="button" onClick={() => setMode(v)}
              className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                mode === v ? `border-slate-500 bg-slate-700 ${c}` : 'border-slate-700 text-slate-500 hover:border-slate-600'
              }`}>{l}</button>
          ))}
        </div>

        {mode === 'set' ? (
          <div>
            <label className="label">新的持有數量</label>
            <input className="input" type="number" step="any" min="0" value={newQty}
              onChange={e => setNewQty(e.target.value)} required />
          </div>
        ) : (
          <div>
            <label className="label">{mode === 'buy' ? '買入數量' : '賣出數量'}</label>
            <input className="input" type="number" step="any" min="0.001" value={delta}
              onChange={e => setDelta(e.target.value)} required />
          </div>
        )}

        {mode !== 'set' && delta && (
          <div className="text-xs text-slate-400 text-right">
            更新後：<span className="font-semibold text-slate-200">
              {(holding.quantity + (mode === 'buy' ? +delta : -delta)).toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? '更新中…' : '確認'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        </div>
      </form>
    </Modal>
  );
}
