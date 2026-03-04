import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import StocksPage from './components/StocksPage';
import StockAnalyticsPage from './components/StockAnalyticsPage';
import AuthPage from './components/AuthPage';
import Portfolio from './components/Portfolio';

const API_BASE = 'http://127.0.0.1:8000/api';

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
  const [tickerItems, setTickerItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    let intervalId = null;

    const fetchTicker = async () => {
      try {
        const res = await axios.get(`${API_BASE}/market/ticker/`);
        const data = Array.isArray(res.data) ? res.data : [];
        if (mounted) setTickerItems(data);
      } catch {
        if (mounted) setTickerItems([]);
      }
    };

    fetchTicker();
    intervalId = setInterval(fetchTicker, 45000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

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
          <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
            <span className="sidebar-link-icon">M</span>
            <span>Market Explorer</span>
          </NavLink>

          <NavLink to="/portfolio" className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
            <span className="sidebar-link-icon">P</span>
            <span>My Portfolio</span>
          </NavLink>

          {!token && (
            <>
              <NavLink to="/login" className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
                <span className="sidebar-link-icon">L</span>
                <span>Login</span>
              </NavLink>
              <NavLink to="/register" className="sidebar-link sidebar-link-cta">
                <span className="sidebar-link-icon">R</span>
                <span>Register</span>
              </NavLink>
            </>
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
              <Route path="/" element={<StocksPage />} />
              <Route path="/stocks/:symbol" element={<StockAnalyticsPage />} />
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
