import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api';

const MarketContext = createContext();

const CACHE_KEY = 'market_data_cache';

export function MarketProvider({ children }) {
  const [prices, setPrices] = useState(() => {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      try {
        const { prices } = JSON.parse(saved);
        return prices || {};
      } catch { return {}; }
    }
    return {};
  });

  const [fxRates, setFxRates] = useState(() => {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      try {
        const { fxRates } = JSON.parse(saved);
        return fxRates || { USD: null, JPY: null, EUR: null, GBP: null, HKD: null };
      } catch { return { USD: null, JPY: null, EUR: null, GBP: null, HKD: null }; }
    }
    return { USD: null, JPY: null, EUR: null, GBP: null, HKD: null };
  });

  const [loading, setLoading] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      prices,
      fxRates,
      updatedAt: Date.now()
    }));
  }, [prices, fxRates]);

  const refreshMarketData = useCallback(async (holdings) => {
    if (!holdings || holdings.length === 0) return;
    setLoading(true);
    
    try {
      const newPrices = { ...prices };
      const newFx = { ...fxRates };

      // 1. Fetch FX rates
      const currencies = [...new Set(holdings.map(h => h.currency).filter(c => c !== 'TWD'))];
      await Promise.allSettled(currencies.map(async (cur) => {
        try {
          const data = await api.getFX(cur, 'TWD');
          newFx[cur] = data.rate;
        } catch {}
      }));
      setFxRates(newFx);

      // 2. Fetch stock prices
      await Promise.allSettled(holdings.map(async (h) => {
        if (h.asset_class === 'cash' || h.asset_class === 'forex') {
          newPrices[h.ticker] = h.currency === 'TWD' ? 1 : newFx[h.currency];
          return;
        }
        const symbol = h.currency === 'TWD' && !h.ticker.includes('.') ? `${h.ticker}.TW` : h.ticker;
        try {
          const data = await api.getPrice(symbol);
          newPrices[h.ticker] = data.price;
        } catch {}
      }));
      setPrices(newPrices);
    } finally {
      setLoading(false);
    }
  }, [prices, fxRates]);

  const updateSinglePrice = useCallback(async (ticker, currency, assetClass) => {
    try {
      let price;
      if (assetClass === 'forex' || assetClass === 'cash') {
        if (currency === 'TWD') {
          price = 1;
        } else {
          const data = await api.getFX(currency, 'TWD');
          price = data.rate;
        }
      } else {
        const symbol = currency === 'TWD' && !ticker.includes('.') ? `${ticker}.TW` : ticker;
        const data = await api.getPrice(symbol);
        price = data.price;
      }
      setPrices(prev => ({ ...prev, [ticker]: price }));
      return price;
    } catch {
      return null;
    }
  }, []);

  return (
    <MarketContext.Provider value={{ 
      prices, 
      fxRates, 
      loading, 
      refreshMarketData, 
      updateSinglePrice 
    }}>
      {children}
    </MarketContext.Provider>
  );
}

export const useMarket = () => useContext(MarketContext);
