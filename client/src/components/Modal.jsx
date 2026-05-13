import { X } from 'lucide-react';

export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
