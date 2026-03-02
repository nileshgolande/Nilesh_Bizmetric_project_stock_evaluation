import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Login.css';

const API_BASE = 'http://127.0.0.1:8000/api';

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addStockId, setAddStockId] = useState('');
  const [stocks, setStocks] = useState([]);
  const [adding, setAdding] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await axios.get(`${API_BASE}/my-portfolio/`, {
          headers: { Authorization: `Token ${token}` },
        });
        setPortfolio(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        console.error('Error fetching portfolio:', err);
        setPortfolio([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, [token]);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await axios.get(`${API_BASE}/stocks/`);
        setStocks(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        setStocks([]);
      }
    };
    fetchStocks();
  }, []);

  const addToPortfolio = async (e) => {
    e.preventDefault();
    if (!addStockId) return;
    setAdding(true);
    try {
      await axios.post(
        `${API_BASE}/my-portfolio/`,
        { stock: parseInt(addStockId, 10) },
        { headers: { Authorization: `Token ${token}` } }
      );
      const res = await axios.get(`${API_BASE}/my-portfolio/`, {
        headers: { Authorization: `Token ${token}` },
      });
      setPortfolio(Array.isArray(res.data) ? res.data : res.data.results || []);
      setAddStockId('');
    } catch (err) {
      alert(err.response?.data?.stock?.[0] || err.response?.data?.detail || 'Failed to add stock');
    } finally {
      setAdding(false);
    }
  };

  const removeFromPortfolio = async (portfolioId) => {
    try {
      await axios.delete(`${API_BASE}/my-portfolio/${portfolioId}/`, {
        headers: { Authorization: `Token ${token}` },
      });
      setPortfolio(prev => prev.filter(p => p.id !== portfolioId));
    } catch (err) {
      alert('Failed to remove');
    }
  };

  const portfolioStockIds = portfolio.map(p => p.stock);
  const availableStocks = stocks.filter(s => !portfolioStockIds.includes(s.id));

  if (loading) {
    return <div className="loading-text p-10 text-center font-bold">Loading portfolio...</div>;
  }

  return (
    <div className="container p-6 mx-auto">
      <div className="portfolio-header">
        <h2 className="text-2xl font-bold mb-2">My Portfolio</h2>
        <p className="text-gray-400 mb-6">Your saved stocks for tracking</p>
      </div>

      <div className="add-stock-form">
        <form onSubmit={addToPortfolio} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-400">Add stock</span>
            <select
              value={addStockId}
              onChange={e => setAddStockId(e.target.value)}
              className="stock-select"
              disabled={adding || availableStocks.length === 0}
            >
              <option value="">Choose a stock...</option>
              {availableStocks.map(s => (
                <option key={s.id} value={s.id}>
                  {s.symbol} - {s.company_name || s.sector_name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-add" disabled={adding || !addStockId}>
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      <div className="stock-list-wrapper mt-6">
        {portfolio.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            No stocks in your portfolio yet. Add some from the dropdown above or browse{' '}
            <Link to="/" className="text-blue-400 hover:underline">all stocks</Link>.
          </div>
        ) : (
          portfolio.map((item) => {
            const s = item.stock_details || item.stock;
            if (!s) return null;
            return (
              <div key={item.id} className="stock-row portfolio-row">
                <span className="symbol-badge">{s.symbol}</span>
                <div className="flex gap-4 flex-1">
                  <div className="metric-card bg-blue-metric">
                    <p className="text-xs text-gray-400">Price</p>
                    <p className="text-lg font-bold text-white">
                      {s.current_price != null ? `$${Number(s.current_price).toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div className="metric-card bg-orange-metric">
                    <p className="text-xs text-gray-400">P/E</p>
                    <p className="text-lg font-bold text-white">{s.pe_ratio ?? 'N/A'}</p>
                  </div>
                  <div className="metric-card">
                    <p className="text-xs text-gray-400">Sector</p>
                    <p className="text-sm font-bold text-white">{s.sector_name || '—'}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFromPortfolio(item.id)}
                  className="btn-remove"
                  title="Remove from portfolio"
                >
                  Remove
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6">
        <Link to="/" className="text-blue-400 hover:underline">← Back to All Stocks</Link>
      </div>
    </div>
  );
};

export default Portfolio;
