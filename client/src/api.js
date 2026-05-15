import axios from 'axios';

const BASE = '/api';

export const api = {
  // Holdings
  getHoldings: () => axios.get(`${BASE}/holdings`).then(r => r.data),
  createHolding: (data) => axios.post(`${BASE}/holdings`, data).then(r => r.data),
  updateHolding: (id, data) => axios.put(`${BASE}/holdings/${id}`, data).then(r => r.data),
  adjustQuantity: (id, delta) => axios.patch(`${BASE}/holdings/${id}/quantity`, { delta }).then(r => r.data),
  deleteHolding: (id) => axios.delete(`${BASE}/holdings/${id}`).then(r => r.data),

  // Dividends
  getDividends: () => axios.get(`${BASE}/dividends`).then(r => r.data),
  createDividend: (data) => axios.post(`${BASE}/dividends`, data).then(r => r.data),
  deleteDividend: (id) => axios.delete(`${BASE}/dividends/${id}`).then(r => r.data),

  // Reinvestments
  addReinvestment: async (dividendId, data) => {
    const res = await axios.post(`${BASE}/dividends/${dividendId}/reinvestments`, data);
    return res.data;
  },
  autoReinvest: async (data) => {
    const res = await axios.post(`${BASE}/reinvestments/auto`, data);
    return res.data;
  },
  deleteReinvestment: (id) => axios.delete(`${BASE}/reinvestments/${id}`).then(r => r.data),

  // Market
  getPrice: (symbol) => axios.get(`${BASE}/market/price`, { params: { symbol } }).then(r => r.data),
  searchName: (symbol) => axios.get(`${BASE}/market/search`, { params: { symbol } }).then(r => r.data),
  getFX: (from, to) => axios.get(`${BASE}/market/fx`, { params: { from, to } }).then(r => r.data),

  // Cashflow (merged dividends + reinvestments)
  getCashflow: () => axios.get(`${BASE}/cashflow`).then(r => r.data),

  // Summary
  getSummary: () => axios.get(`${BASE}/summary`).then(r => r.data),
};

export const ASSET_CLASSES = [
  { value: 'tw_stock', label: '台股', color: '#6366f1', emoji: '🇹🇼' },
  { value: 'us_stock', label: '美股', color: '#22d3ee', emoji: '🇺🇸' },
  { value: 'bond',     label: '債券', color: '#f59e0b', emoji: '📄' },
  { value: 'forex',    label: '外幣', color: '#10b981', emoji: '💱' },
  { value: 'cash',     label: '現金', color: '#94a3b8', emoji: '💵' },
  { value: 'reinvest', label: '再投入', color: '#6366f1', emoji: '🔄' },
];

export const getAssetClass = (value) => {
  if (!value) return { label: '未分類', color: '#64748b', emoji: '📈' };
  return ASSET_CLASSES.find(a => a.value === value) ?? { label: value, color: '#888', emoji: '❓' };
};

export const fmtNum = (n, digits = 2) =>
  n == null ? '—' : Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: digits });
