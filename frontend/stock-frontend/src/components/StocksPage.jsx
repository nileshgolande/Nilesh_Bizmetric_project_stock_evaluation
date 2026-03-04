import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE = 'http://127.0.0.1:8000/api';

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

const StocksPage = () => {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const authHeaders = token ? { Authorization: `Token ${token}` } : {};

  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSectors, setActiveSectors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quickAdding, setQuickAdding] = useState('');
  const [quickAdded, setQuickAdded] = useState('');

  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await axios.get(`${API_BASE}/stocks/`);
        setStocks(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch {
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/stocks/search/`, {
          params: { q: query },
        });
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!quickAdded) return undefined;
    const timeout = setTimeout(() => setQuickAdded(''), 1500);
    return () => clearTimeout(timeout);
  }, [quickAdded]);

  const sectors = useMemo(
    () => [...new Set(stocks.map((stock) => stock.sector_name).filter(Boolean))].sort(),
    [stocks]
  );

  const filteredStocks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return stocks.filter((stock) => {
      const sectorPass = activeSectors.length === 0 || activeSectors.includes(stock.sector_name);
      if (!sectorPass) return false;

      if (!query) return true;
      const symbol = stock.symbol?.toLowerCase() || '';
      const company = stock.company_name?.toLowerCase() || '';
      const sector = stock.sector_name?.toLowerCase() || '';
      return symbol.includes(query) || company.includes(query) || sector.includes(query);
    });
  }, [stocks, activeSectors, searchQuery]);

  const toggleSector = (sector) => {
    setActiveSectors((prev) => (
      prev.includes(sector)
        ? prev.filter((item) => item !== sector)
        : [...prev, sector]
    ));
  };

  const clearSectorFilter = () => setActiveSectors([]);

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

    setQuickAdding(stock.symbol);
    try {
      await axios.post(
        `${API_BASE}/my-portfolio/add-stock/`,
        { symbol: stock.symbol },
        { headers: authHeaders }
      );
      setQuickAdded(stock.symbol);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Unable to add stock.';
      alert(msg);
    } finally {
      setQuickAdding('');
    }
  };

  if (loading) {
    return (
      <div className="stocks-page">
        <div className="loading-text p-10 text-center font-bold">Loading stocks...</div>
      </div>
    );
  }

  return (
    <div className="stocks-page stocks-dashboard-page">
      <header className="stocks-header">
        <h1>Stock Market Explorer</h1>
        <p className="subtitle">Live market watchlist with search intelligence, smart filters, and quick portfolio actions.</p>
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

              {!searching && searchResults.map((item) => (
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

              {!searching && searchResults.length === 0 && (
                <div className="suggestion-empty">No matching stocks found.</div>
              )}
            </div>
          )}
        </div>

        <div className="sector-chip-wrap">
          <button
            type="button"
            className={`sector-chip ${activeSectors.length === 0 ? 'is-active' : ''}`}
            onClick={clearSectorFilter}
          >
            All Sectors
          </button>
          {sectors.map((sector) => (
            <button
              key={sector}
              type="button"
              className={`sector-chip ${activeSectors.includes(sector) ? 'is-active' : ''}`}
              onClick={() => toggleSector(sector)}
            >
              {sector}
            </button>
          ))}
        </div>
      </section>

      <section className="stocks-table-card">
        <div className="stocks-table-wrapper">
          <table className="stocks-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>P/E Ratio</th>
                <th>52W High</th>
                <th>52W Low</th>
                <th>Avg 52W Discount</th>
                <th>7D Trend</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">No stocks match current filters.</td>
                </tr>
              ) : (
                filteredStocks.map((stock) => {
                  const sparkline = buildSparkline(
                    stock.sparkline_7d?.length ? stock.sparkline_7d : fallbackTrendPoints(stock.trend).map((close, i) => ({ date: `${i}`, close }))
                  );
                  const priceValue = stock.live_price != null ? stock.live_price : stock.current_price;
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
                      <td className={`metric mono-num ${changeClassName(stock.day_change_percent)}`}>
                        {formatCurrency(priceValue)}
                      </td>
                      <td className="metric mono-num">
                        {formatNumber(stock.pe_ratio)}
                      </td>
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
                        {sparkline ? (
                          <svg
                            className="mini-sparkline"
                            viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                            aria-label={`${stock.symbol} 7 day sparkline`}
                          >
                            <path d={sparkline.areaPath} className="mini-sparkline-area" />
                            <path d={sparkline.linePath} className="mini-sparkline-line" />
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
                            {quickAdding === stock.symbol ? '...' : quickAdded === stock.symbol ? 'Added' : '+'}
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
        </div>

        <div className="stocks-mobile-cards">
          {filteredStocks.map((stock) => {
            const sparkline = buildSparkline(
              stock.sparkline_7d?.length ? stock.sparkline_7d : fallbackTrendPoints(stock.trend).map((close, i) => ({ date: `${i}`, close })),
              180,
              44,
              5
            );
            const priceValue = stock.live_price != null ? stock.live_price : stock.current_price;
            return (
              <article key={`mobile-${stock.id}`} className="stock-mobile-card">
                <div className="card-head">
                  <span className="symbol-badge">{stock.symbol}</span>
                  <span className={`insight-pill ${insightClassName(stock.insight_badge)}`}>
                    {stock.insight_badge || 'Neutral'}
                  </span>
                </div>
                <p className="stock-company">{stock.company_name || '-'}</p>
                <div className="card-row">
                  <span>Price</span>
                  <span className={`mono-num ${changeClassName(stock.day_change_percent)}`}>{formatCurrency(priceValue)}</span>
                </div>
                <div className="card-row">
                  <span>P/E Ratio</span>
                  <span className="mono-num">{formatNumber(stock.pe_ratio)}</span>
                </div>
                <div className="card-row">
                  <span>52W High</span>
                  <span className="mono-num">{formatCurrency(stock.fifty_two_week_high)}</span>
                </div>
                <div className="card-row">
                  <span>52W Low</span>
                  <span className="mono-num">{formatCurrency(stock.fifty_two_week_low)}</span>
                </div>
                <div className="card-row">
                  <span>Avg 52W Discount</span>
                  <span className={`mono-num ${discountClassName(stock.avg_discount_52w)}`}>{formatCurrency(stock.avg_discount_52w)}</span>
                </div>
                <div className="card-sparkline">
                  {sparkline ? (
                    <svg
                      className="mini-sparkline"
                      viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                      aria-label={`${stock.symbol} 7 day sparkline`}
                    >
                      <path d={sparkline.areaPath} className="mini-sparkline-area" />
                      <path d={sparkline.linePath} className="mini-sparkline-line" />
                    </svg>
                  ) : (
                    <span className="sparkline-empty">No trend data</span>
                  )}
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="quick-add-btn"
                    onClick={() => handleQuickAdd(stock)}
                    disabled={quickAdding === stock.symbol}
                  >
                    {quickAdding === stock.symbol ? '...' : quickAdded === stock.symbol ? 'Added' : 'Add'}
                  </button>
                  <button type="button" className="analysis-btn" onClick={() => openDeepAnalysis(stock)}>
                    Analysis
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default StocksPage;
