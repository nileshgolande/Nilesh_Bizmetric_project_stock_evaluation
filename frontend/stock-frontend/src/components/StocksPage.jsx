import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Login.css';

const API_BASE = 'http://127.0.0.1:8000/api';

const StocksPage = () => {
  const token = localStorage.getItem('token');
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSector, setFilterSector] = useState('');

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await axios.get(`${API_BASE}/stocks/`);
        setStocks(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        console.error('Error fetching stocks:', err);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
  }, []);

  const sectors = [...new Set(stocks.map(s => s.sector_name).filter(Boolean))];
  const filteredStocks = filterSector
    ? stocks.filter(s => s.sector_name === filterSector)
    : stocks;

  if (loading) {
    return (
      <div className="stocks-page">
        <div className="loading-text p-10 text-center font-bold">Loading stocks...</div>
      </div>
    );
  }

  return (
    <div className="stocks-page">
      <header className="stocks-header">
        <h1>Stock Market Explorer</h1>
        <p className="subtitle">Browse all available stocks. Log in to manage your portfolio.</p>
        <div className="header-actions">
          {token ? (
            <Link to="/portfolio" className="btn-primary">My Portfolio</Link>
          ) : (
            <>
              <Link to="/login" className="btn-primary">Login</Link>
              <Link to="/register" className="btn-secondary">Register</Link>
            </>
          )}
        </div>
      </header>

      <div className="stocks-filters">
        <label>
          Filter by sector:
          <select
            value={filterSector}
            onChange={e => setFilterSector(e.target.value)}
            className="sector-select"
          >
            <option value="">All Sectors</option>
            {sectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="stocks-table-wrapper">
        <table className="stocks-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Price</th>
              <th>P/E Ratio</th>
              <th>52W High</th>
              <th>52W Low</th>
              <th>Discount Price</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">No stocks found. Run <code>python manage.py fetch_stocks</code> to populate data.</td>
              </tr>
            ) : (
              filteredStocks.map(stock => (
                <tr key={stock.id}>
                  <td><span className="symbol-badge">{stock.symbol}</span></td>
                  <td>{stock.company_name || '—'}</td>
                  <td>{stock.sector_name || '—'}</td>
                  <td className="metric">${stock.current_price != null ? Number(stock.current_price).toFixed(2) : 'N/A'}</td>
                  <td className="metric">{stock.pe_ratio != null ? Number(stock.pe_ratio).toFixed(2) : 'N/A'}</td>
                  <td className="metric">${stock.fifty_two_week_high != null ? Number(stock.fifty_two_week_high).toFixed(2) : 'N/A'}</td>
                  <td className="metric">${stock.fifty_two_week_low != null ? Number(stock.fifty_two_week_low).toFixed(2) : 'N/A'}</td>
                  <td className="metric">${stock.discount_price != null ? Number(stock.discount_price).toFixed(2) : 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StocksPage;
