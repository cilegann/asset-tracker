import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart2, DollarSign } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import Dividends from './pages/Dividends';

const NAV = [
  { to: '/',         label: '總覽',     Icon: LayoutDashboard },
  { to: '/holdings', label: '持倉管理', Icon: BarChart2 },
  { to: '/dividends',label: '現金流紀錄', Icon: DollarSign },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Top nav */}
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 flex items-center h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mr-auto sm:mr-8">
              <img src="/favicon.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-lg shadow-emerald-500/10" />
              <span className="font-semibold text-sm text-slate-200 hidden xs:block">資產追蹤</span>
            </div>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              {NAV.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-indigo-600/20 text-indigo-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`
                  }>
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/holdings"  element={<Holdings />} />
            <Route path="/dividends" element={<Dividends />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-600">
          個人投資追蹤系統 · 資料僅供參考，不構成投資建議
        </footer>
      </div>
    </BrowserRouter>
  );
}
