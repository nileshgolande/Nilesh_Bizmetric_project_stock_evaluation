import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import StocksPage from './components/StocksPage';
import AuthPage from './components/AuthPage';
import Portfolio from './components/Portfolio';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<StocksPage />} />
          <Route path="/login" element={<AuthPage setToken={setToken} />} />
          <Route path="/register" element={<AuthPage setToken={setToken} />} />
          <Route
            path="/portfolio"
            element={
              token ? (
                <>
                  <nav className="app-nav">
                    <Link to="/" className="nav-brand">Stock EDA</Link>
                    <div className="nav-links">
                      <Link to="/">All Stocks</Link>
                      <span className="nav-sep">|</span>
                      <Link to="/portfolio">My Portfolio</Link>
                      <button onClick={handleLogout} className="btn-logout">Logout</button>
                    </div>
                  </nav>
                  <Portfolio />
                </>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
