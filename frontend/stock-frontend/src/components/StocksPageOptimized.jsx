import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStocks, useStockSearch, useTopSectors } from '../hooks/useStocks';
import { StockTableSkeleton } from './SkeletonLoader';
import './Login.css';

const API_BASE = '/api';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatCurrency = (value) => {
  const numeric = toNumber(value);
  return numeric == null ? 'N/A' : `$${numeric.toFixed(2)}`;
};

const formatNumber = (value) => {
  const numeric = toNumber(value);
  return numeric == null ? 'N/A' : numeric.toFixed(2);
};

const changeClassName = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'delta-neutral';
  if (numeric > 0) return 'delta-positive';
  if (numeric < 0) return 'delta-negative';
  return 'delta-neutral';
};

const discountClassName = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'delta-neutral';
  return numeric >= 0 ? 'delta-positive' : 'delta-negative';
};

const insightClassName = (insight) => {
  if (insight === 'Undervalued') return 'insight-undervalued';
  if (insight === 'Overbought') return 'insight-overbought';
  return 'insight-neutral';
};

const buildSparkline = (rawPoints, width = 106, height = 34, padding = 4) => {
  const points = Array.isArray(rawPoints)
    ? rawPoints
      .filter((point) => point && point.close != null)
      .map((point) => Number(point.close))
      .filter((close) => Number.isFinite(close))
    : [];

  if (points.length < 2) {
    return null;
  }

  const minClose = Math.min(...points);
  const maxClose = Math.max(...points);
  const range = maxClose - minClose || 1;
  const innerWidth = width - (padding * 2);
  const innerHeight = height - (padding * 2);
  const denominator = Math.max(points.length - 1, 1);

  const chartPoints = points.map((close, index) => {
    const x = padding + ((index / denominator) * innerWidth);
    const y = padding + (((maxClose - close) / range) * innerHeight);
    return { x, y };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${chartPoints[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;

  return { linePath, areaPath, width, height };
};

const fallbackTrendPoints = (trend) => {
  if (trend === 'Uptrend') return [1.0, 1.08, 1.16, 1.26, 1.36, 1.5, 1.68];
  if (trend === 'Downtrend') return [1.72, 1.58, 1.44, 1.35, 1.22, 1.11, 1.0];
  return [1.24, 1.26, 1.22, 1.25, 1.23, 1.24, 1.24];
};

const StocksPageOptimized = () => {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const authHeaders = token ? { Authorization: `Token ${token}` } : {};

  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quickAdding, setQuickAdding] = useState('');
  const [quickAdded, setQuickAdded] = useState('');
  const [page, setPage] = useState(1);
  const [includeLive, setIncludeLive] = useState(true); // Default to live as per requirement

  const searchRef = useRef(null);

  // Use React Query hooks
  const { data: stocksData, isLoading, isFetching, error } = useStocks(page, includeLive, selectedSectorId);
  const { data: searchResults = [], isLoading: searching } = useStockSearch(
    searchQuery,
    showSuggestions && searchQuery.trim().length > 0
  );

  const predefinedSectors = [
    { id: 'IT', name: 'IT' },
    { id: 'Healthcare', name: 'Healthcare' },
    { id: 'Financial Services', name: 'Financial Services' },
    { id: 'Consumer Goods', name: 'Consumer Goods' },
    { id: 'Energy', name: 'Energy' },
    { id: 'Industrials', name: 'Industrials' },
    { id: 'Telecommunications', name: 'Telecommunications' },
    { id: 'Real Estate', name: 'Real Estate' },
    { id: 'Consumer Services', name: 'Consumer Services' },
    { id: 'Materials & Mining', name: 'Materials & Mining' },
    { id: 'Automobile', name: 'Automobile' },
    { id: 'Uncategorized', name: 'Uncategorized' }
  ];

  const stocks = useMemo(() => {
    if (!stocksData) return [];
    return Array.isArray(stocksData) ? stocksData : stocksData.results || [];
  }, [stocksData]);

  const filteredStocks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return stocks.filter((stock) => {
      if (!query) return true;
      const symbol = stock.symbol?.toLowerCase() || '';
      const company = stock.company_name?.toLowerCase() || '';
      const sector = stock.sector_name?.toLowerCase() || '';
      return symbol.includes(query) || company.includes(query) || sector.includes(query);
    });
  }, [stocks, searchQuery]);

  const handleSectorChange = (e) => {
    setSelectedSectorId(e.target.value);
    setPage(1); // Reset to first page when sector changes
  };

  const handleSelectSuggestion = (item) => {
    setSearchQuery(`${item.symbol}`);
    setShowSuggestions(false);
  };

  const openDeepAnalysis = (stock) => {
    navigate(`/stocks/${encodeURIComponent(stock.symbol)}`, { state: { stock } });
  };

  const handleQuickAdd = async (stock) => {
    if (!token) {
      navigate('/login');
      return;
    }

    const portfolioSector = selectedSectorId || stock.sector_id;

    setQuickAdding(stock.symbol);
    try {
      const axios = (await import('axios')).default;
      await axios.post(
        `${API_BASE}/my-portfolio/add-stock/`,
        {
          symbol: stock.symbol,
          portfolio_sector: portfolioSector,
        },
        { headers: authHeaders }
      );
      setQuickAdded(stock.symbol);
      setTimeout(() => setQuickAdded(''), 1500);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Unable to add stock.';
      alert(msg);
    } finally {
      setQuickAdding('');
    }
  };

  if (error) {
    return (
      <div className="stocks-page">
        <div className="analytics-error p-6 text-center">
          Error loading stocks. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="stocks-page stocks-dashboard-page">
      <header className="stocks-header">
        <h1>Stock Market Explorer</h1>
        <p className="subtitle">
          Live market watchlist with search intelligence, smart filters, and quick portfolio actions.
        </p>
        <div className="header-actions" style={{ marginTop: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeLive}
              onChange={(e) => setIncludeLive(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Enable Live Data (slower but real-time)
            </span>
          </label>
        </div>
      </header>

      <section className="explorer-controls">
        <div className="explorer-search" ref={searchRef}>
          <span className="explorer-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="icon-svg">
              <path d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            className="explorer-search-input"
            placeholder="Search stocks by symbol or company"
          />
          {searching && <span className="explorer-search-status">Searching...</span>}

          {showSuggestions && (searching || searchResults.length > 0 || searchQuery.trim()) && (
            <div className="explorer-suggestions">
              {searching && <div className="suggestion-loading">Fetching suggestions...</div>}

              {!searching &&
                searchResults.map((item) => (
                  <button
                    key={`${item.symbol}-${item.exchange || 'x'}`}
                    type="button"
                    className="suggestion-item"
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <span className="suggestion-symbol mono-num">{item.symbol}</span>
                    <span className="suggestion-name">{item.name || item.symbol}</span>
                  </button>
                ))}

              {!searching && searchResults.length === 0 && searchQuery.trim() && (
                <div className="suggestion-empty">No matching stocks found.</div>
              )}
            </div>
          )}
        </div>

        <div className="sector-filter-dropdown">
          <select 
            className="explorer-search-input sector-select" 
            value={selectedSectorId} 
            onChange={handleSectorChange}
            style={{ width: 'auto', minWidth: '200px', cursor: 'pointer' }}
          >
            <option value="">All Sectors</option>
            {predefinedSectors.map((sector) => (
              <option key={sector.id} value={sector.name}>
                {sector.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="stocks-table-card">
        <div className="stocks-table-wrapper">
          <table className="stocks-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Sector</th>
                <th>Price</th>
                <th>P/E Ratio</th>
                <th>52W High</th>
                <th>52W Low</th>
                <th>Avg 52W Discount</th>
                <th>7D Trend</th>
                <th>RNN</th>
                <th>AI Direction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <StockTableSkeleton rows={10} />
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan="11" className="no-data">
                    No stocks match current filters.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => {
                  const sparkline7d = buildSparkline(
                    stock.sparkline_7d?.length
                      ? stock.sparkline_7d
                      : fallbackTrendPoints(stock.trend).map((close, i) => ({
                          date: `${i}`,
                          close,
                        }))
                  );
                  const sparklineAI = buildSparkline(
                    stock.ai_direction_forecast?.map((price, i) => ({
                      date: `${i}`,
                      close: price,
                    })) || []
                  );
                  const priceValue =
                    stock.live_price != null ? stock.live_price : stock.current_price;
                  return (
                    <tr key={stock.id} className="stock-table-row rich-stock-row">
                      <td>
                        <div className="stock-primary-cell">
                          <span className="symbol-badge">{stock.symbol}</span>
                          <span className={`insight-pill ${insightClassName(stock.insight_badge)}`}>
                            {stock.insight_badge || 'Neutral'}
                          </span>
                          <span className="stock-company">{stock.company_name || '-'}</span>
                        </div>
                      </td>
                      <td className="sector-name">{stock.sector_name || 'Uncategorized'}</td>
                      <td className={`metric mono-num ${changeClassName(stock.day_change_percent)}`}>
                        {formatCurrency(priceValue)}
                        {stock.day_change_percent != null && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              marginLeft: '0.5rem',
                              opacity: 0.8,
                            }}
                          >
                            ({stock.day_change_percent > 0 ? '+' : ''}
                            {stock.day_change_percent.toFixed(2)}%)
                          </span>
                        )}
                      </td>
                      <td className="metric mono-num">{formatNumber(stock.pe_ratio)}</td>
                      <td className="metric mono-num">
                        {formatCurrency(stock.fifty_two_week_high)}
                      </td>
                      <td className="metric mono-num">
                        {formatCurrency(stock.fifty_two_week_low)}
                      </td>
                      <td className={`metric mono-num ${discountClassName(stock.avg_discount_52w)}`}>
                        {formatCurrency(stock.avg_discount_52w)}
                      </td>
                      <td>
                        {sparkline7d ? (
                          <svg
                            className="mini-sparkline"
                            viewBox={`0 0 ${sparkline7d.width} ${sparkline7d.height}`}
                            aria-label={`${stock.symbol} 7 day sparkline`}
                          >
                            <path d={sparkline7d.areaPath} className="mini-sparkline-area" />
                            <path d={sparkline7d.linePath} className="mini-sparkline-line" />
                          </svg>
                        ) : (
                          <span className="sparkline-empty">--</span>
                        )}
                      </td>
                      <td className="metric">
                        <span className={`insight-pill ${stock.rnn_signal === 'Strong Buy' ? 'insight-undervalued' : stock.rnn_signal === 'Sell' ? 'insight-overbought' : 'insight-neutral'}`}>
                          {stock.rnn_signal || 'Hold'}
                        </span>
                      </td>
                      <td>
                        {sparklineAI ? (
                          <svg
                            className="mini-sparkline"
                            viewBox={`0 0 ${sparklineAI.width} ${sparklineAI.height}`}
                            aria-label={`${stock.symbol} AI Direction forecast`}
                          >
                            <defs>
                              <linearGradient id="aiDirectionGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ECFEFF" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.1" />
                              </linearGradient>
                            </defs>
                            <path
                              d={sparklineAI.areaPath}
                              className="mini-sparkline-area"
                              style={{ fill: 'url(#aiDirectionGradient)' }}
                            />
                            <path
                              d={sparklineAI.linePath}
                              className="mini-sparkline-line"
                              style={{ stroke: '#22C55E' }}
                            />
                          </svg>
                        ) : (
                          <span className="sparkline-empty">--</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="quick-add-btn"
                            onClick={() => handleQuickAdd(stock)}
                            disabled={quickAdding === stock.symbol}
                            title="Quick Add to Portfolio"
                          >
                            {quickAdding === stock.symbol
                              ? '...'
                              : quickAdded === stock.symbol
                              ? '✓'
                              : '+'}
                          </button>
                          <button
                            type="button"
                            className="analysis-btn"
                            onClick={() => openDeepAnalysis(stock)}
                          >
                            Deep Analysis
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {isFetching && !isLoading && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Refreshing data...
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default StocksPageOptimized;

