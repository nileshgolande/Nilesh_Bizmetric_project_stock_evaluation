import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
import AddToPortfolioModal from './AddToPortfolioModal';
import './Login.css';

const API_BASE = '/api';

const formatCurrency = (value) => (
  value == null || Number.isNaN(Number(value)) ? 'N/A' : `$${Number(value).toFixed(2)}`
);

const formatPercent = (value) => (
  value == null || Number.isNaN(Number(value)) ? 'N/A' : `${Number(value).toFixed(2)}%`
);

const formatMarketCap = (value) => (
  value == null || Number.isNaN(Number(value)) ? 'N/A' : `$${Number(value).toLocaleString()}`
);

const valueClass = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'value-neutral';
  if (Number(value) > 0) return 'value-positive';
  if (Number(value) < 0) return 'value-negative';
  return 'value-neutral';
};

const Dashboard = () => {
  const [view, setView] = useState('sectors');
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
  const [stockToAdd, setStockToAdd] = useState(null);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE}/sectors/`, {
          headers: { Authorization: `Token ${token}` },
        });
        setSectors(response.data);
      } catch (error) {
        console.error('Error fetching sectors:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
  }, []);

  const fetchStocks = async (sectorId) => {
    try {
      setStocksLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/sectors/${sectorId}/stocks/`, {
        headers: { Authorization: `Token ${token}` },
      });

      if (Array.isArray(response.data)) {
        setStocks(response.data);
      } else if (response.data.results) {
        setStocks(response.data.results);
      } else {
        setStocks([]);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
      setStocks([]);
    } finally {
      setStocksLoading(false);
    }
  };

  const fetchStockAnalytics = async (stock) => {
    setSelectedStock(stock);
    setAnalytics(null);
    setAnalyticsError('');
    setAnalyticsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const config = token ? { headers: { Authorization: `Token ${token}` } } : undefined;
      const response = await axios.get(`${API_BASE}/eda/analyze/${stock.symbol}/`, config);
      setAnalytics(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.error
        || error.response?.data?.details
        || 'Unable to load analytics for this stock.';
      setAnalyticsError(errorMsg);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-text p-10 text-center font-bold">Loading Market Sectors...</div>;
  }

  return (
    <div className="container p-6 mx-auto">
      {view === 'sectors' && (
        <>
          <h2 className="text-2xl font-bold mb-6 border-b pb-2">Market Sectors</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sectors.map((sector) => (
              <div
                key={sector.id}
                className="sector-card cursor-pointer group"
                onClick={() => {
                  setSelectedSector(sector);
                  setSelectedStock(null);
                  setAnalytics(null);
                  setAnalyticsError('');
                  fetchStocks(sector.id);
                  setView('stocks');
                }}
              >
                <h3 className="font-bold text-lg group-hover:text-blue-400">
                  {sector.name}
                </h3>
                <p className="text-sm text-gray-400">Sector ID: {sector.id}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'stocks' && (
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => {
              setView('sectors');
              setStocks([]);
              setSelectedSector(null);
              setSelectedStock(null);
              setAnalytics(null);
              setAnalyticsError('');
            }}
            className="text-blue-400 hover:underline mb-6 font-medium"
          >
            &lt;- Back to All Sectors
          </button>

          <h3 className="text-xl font-bold mb-6">
            Stocks in <span className="text-blue-400">{selectedSector?.name}</span>
          </h3>

          <div className="stock-list-wrapper">
            {stocksLoading && (
              <div className="p-10 text-center text-gray-400">Loading stocks...</div>
            )}

            {!stocksLoading && stocks.length === 0 && (
              <div className="p-10 text-center text-gray-400">No stocks found.</div>
            )}

            {!stocksLoading && stocks.map((stock) => (
              <div
                key={stock.id}
                className={`stock-row ${selectedStock?.id === stock.id ? 'is-selected' : ''}`}
                onClick={() => fetchStockAnalytics(stock)}
              >
                <div className="flex items-center gap-3">
                  <span className="symbol-badge">{stock.symbol}</span>
                  {token && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStockToAdd(stock);
                        setShowAddPortfolioModal(true);
                      }}
                      className="p-1 hover:bg-gray-700 rounded-full text-blue-400 transition-colors"
                      title="Add to Portfolio"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="metric-card bg-blue-metric">
                    <p className="text-xs text-gray-400">Price</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(stock.current_price)}</p>
                  </div>
                  <div className="metric-card bg-orange-metric">
                    <p className="text-xs text-gray-400">P/E Ratio</p>
                    <p className="text-lg font-bold text-white">
                      {stock.pe_ratio != null ? Number(stock.pe_ratio).toFixed(2) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="stock-analytics-panel">
            <div className="stock-analytics-header">
              <h2>Stock Analytics</h2>
              {selectedStock && <span className="selected-symbol">{selectedStock.symbol}</span>}
            </div>

            {analyticsLoading && <div className="analytics-state">Loading analytics...</div>}

            {!analyticsLoading && !selectedStock && (
              <div className="analytics-state">Select a stock to see analytics.</div>
            )}

            {!analyticsLoading && analyticsError && (
              <div className="analytics-error">{analyticsError}</div>
            )}

            {!analyticsLoading && analytics && !analyticsError && (
              <div className="analytics-grid">
                <div className="analytics-card">
                  <p className="analytics-label">Current Price</p>
                  <p className="analytics-value">{formatCurrency(analytics.current_price)}</p>
                </div>

                <div className="analytics-card">
                  <p className="analytics-label">Market Cap</p>
                  <p className="analytics-value">{analytics.market_capitalization?.category || 'Unknown'}</p>
                  <p className="analytics-subvalue">{formatMarketCap(analytics.market_capitalization?.value)}</p>
                </div>

                <div className="analytics-card">
                  <p className="analytics-label">1 Year Return</p>
                  <p className={`analytics-value ${valueClass(analytics.returns_percentage?.['1_year'])}`}>
                    {formatPercent(analytics.returns_percentage?.['1_year'])}
                  </p>
                </div>

                <div className="analytics-card">
                  <p className="analytics-label">30 Day Volatility</p>
                  <p className="analytics-value">{formatPercent(analytics.volatility_30d_percentage)}</p>
                </div>

                <div className="analytics-card">
                  <p className="analytics-label">Best Daily Return</p>
                  <p className={`analytics-value ${valueClass(analytics.daily_returns_percentage?.best)}`}>
                    {formatPercent(analytics.daily_returns_percentage?.best)}
                  </p>
                </div>

                <div className="analytics-card">
                  <p className="analytics-label">Worst Daily Return</p>
                  <p className={`analytics-value ${valueClass(analytics.daily_returns_percentage?.worst)}`}>
                    {formatPercent(analytics.daily_returns_percentage?.worst)}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {showAddPortfolioModal && stockToAdd && (
        <AddToPortfolioModal
          stock={stockToAdd}
          defaultPortfolioName={selectedSector?.name}
          onClose={() => setShowAddPortfolioModal(false)}
          onSuccess={(portfolioName) => {
            // Optional: Show a toast notification or update state if needed
            alert(`Added ${stockToAdd.symbol} to ${portfolioName} portfolio!`);
            setShowAddPortfolioModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
