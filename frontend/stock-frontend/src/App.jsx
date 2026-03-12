import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useMarketTicker } from './hooks/useStocks';
import ThemeToggle from './components/ThemeToggle';
import StocksPage from './components/StocksPage';
import StocksPageOptimized from './components/StocksPageOptimized';
import StockAnalyticsPage from './components/StockAnalyticsPage';
import AuthPage from './components/AuthPage';
import Portfolio from './components/Portfolio';
import PredictionsPage from './components/PredictionsPage';

const API_BASE = '/api';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatTickerValue = (value) => {
  const numeric = toNumber(value);
  return numeric == null ? 'N/A' : numeric.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const formatSignedPercent = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'N/A';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

const tickerClassName = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'ticker-neutral';
  if (numeric > 0) return 'ticker-up';
  if (numeric < 0) return 'ticker-down';
  return 'ticker-neutral';
};

const AppLayout = ({ token, setToken }) => {
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const location = useLocation();
  
  // Use React Query for market ticker (auto-refreshes)
  const { data: tickerItems = [] } = useMarketTicker();

  useEffect(() => {
    if (location.pathname.startsWith('/predictions')) {
      setPredictionsOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const tickerStream = tickerItems.length ? [...tickerItems, ...tickerItems] : [];

  return (
    <div className="app dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <p className="brand-title">Stock EDA Pro</p>
          <p className="brand-sub">Quant Research Desk</p>
        </div>

        <nav className="sidebar-nav">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Navigation</span>
            <ThemeToggle />
          </div>
          
          <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
            <span className="sidebar-link-icon">M</span>
            <span>Market Explorer</span>
          </NavLink>

          <NavLink to="/portfolio" className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
            <span className="sidebar-link-icon">P</span>
            <span>My Portfolio</span>
          </NavLink>

          {token && (
            <div className="sidebar-group">
              <button
                onClick={() => setPredictionsOpen(!predictionsOpen)}
                className={`sidebar-link w-full flex justify-between items-center cursor-pointer ${predictionsOpen ? 'is-active' : ''}`}
                style={{ background: 'transparent', border: 'none', padding: '10px 15px', display: 'flex', alignItems: 'center' }}
              >
                <div className="flex items-center gap-3">
                  <span className="sidebar-link-icon"><TrendingUp size={18} /></span>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>Predictions</span>
                </div>
                {predictionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {predictionsOpen && (
                <div className="pl-12 pr-4 flex flex-col gap-2 mb-2">
                  <NavLink to="/predictions/Gold" className={({ isActive }) => `prediction-btn prediction-btn-gold ${isActive ? 'is-active' : ''}`}>
                    Gold
                  </NavLink>
                  <NavLink to="/predictions/Silver" className={({ isActive }) => `prediction-btn prediction-btn-silver ${isActive ? 'is-active' : ''}`}>
                    Silver
                  </NavLink>
                  <NavLink to="/predictions/BTC" className={({ isActive }) => `prediction-btn prediction-btn-btc ${isActive ? 'is-active' : ''}`}>
                    Bitcoin
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </nav>

        {token && (
          <button onClick={handleLogout} className="sidebar-logout-btn">
            Logout
          </button>
        )}
      </aside>

      <div className="dashboard-content-area">
        <div className="global-ticker-bar">
          <div className="global-ticker-track">
            {tickerStream.length === 0 ? (
              <div className="ticker-item ticker-neutral">Market ticker unavailable</div>
            ) : (
              tickerStream.map((item, index) => (
                <div key={`${item.symbol}-${index}`} className="ticker-item">
                  <span className="ticker-label">{item.label || item.symbol}</span>
                  <span className="ticker-price mono-num">{formatTickerValue(item.current_price)}</span>
                  <span className={`ticker-change mono-num ${tickerClassName(item.day_change_percent)}`}>
                    {formatSignedPercent(item.day_change_percent)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <main className="dashboard-main">
          <section className="glass-panel">
            <Routes>
              <Route path="/" element={<StocksPageOptimized />} />
              <Route path="/stocks/:symbol" element={<StockAnalyticsPage />} />
              <Route path="/predictions/:assetType" element={token ? <PredictionsPage /> : <Navigate to="/login" replace />} />
              <Route path="/login" element={<AuthPage setToken={setToken} />} />
              <Route path="/register" element={<AuthPage setToken={setToken} />} />
              <Route
                path="/portfolio"
                element={token ? <Portfolio /> : <Navigate to="/login" replace />}
              />
            </Routes>
          </section>
        </main>
      </div>
    </div>
  );
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  return (
    <BrowserRouter>
      <AppLayout token={token} setToken={setToken} />
    </BrowserRouter>
  );
}

export default App;
