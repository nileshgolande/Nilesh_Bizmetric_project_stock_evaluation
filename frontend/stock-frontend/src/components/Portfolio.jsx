import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
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

const formatCompactCurrency = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatNumber = (value) => {
  const numeric = toNumber(value);
  return numeric == null ? 'N/A' : numeric.toFixed(2);
};

const formatSignedPercent = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'N/A';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
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

const buildSparkline = (rawPoints, width = 110, height = 36, padding = 4) => {
  const points = Array.isArray(rawPoints)
    ? rawPoints
      .filter((point) => point && point.close != null)
      .map((point) => ({
        date: point.date,
        close: Number(point.close),
      }))
      .filter((point) => Number.isFinite(point.close))
    : [];

  if (points.length < 2) {
    return null;
  }

  const closes = points.map((point) => point.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const range = maxClose - minClose || 1;
  const innerWidth = width - (padding * 2);
  const innerHeight = height - (padding * 2);
  const denominator = Math.max(points.length - 1, 1);

  const chartPoints = points.map((point, index) => {
    const x = padding + ((index / denominator) * innerWidth);
    const y = padding + (((maxClose - point.close) / range) * innerHeight);
    return { ...point, x, y };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${chartPoints[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;

  return {
    linePath,
    areaPath,
    width,
    height,
  };
};

const Portfolio = () => {
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Token ${token}` } : {};

  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my-portfolio/`, {
        headers: authHeaders,
      });
      setPortfolio(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      setPortfolio([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        const results = Array.isArray(res.data) ? res.data : [];
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const resolveSymbolForAdd = () => {
    if (selectedSuggestion?.symbol) {
      return selectedSuggestion.symbol.toUpperCase();
    }
    const query = searchQuery.trim();
    if (!query) return '';
    return query.split(/[\s,-]+/)[0].toUpperCase();
  };

  const handleSelectSuggestion = (item) => {
    setSelectedSuggestion(item);
    setSearchQuery(`${item.symbol} - ${item.name || item.symbol}`);
    setShowSuggestions(false);
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    const symbol = resolveSymbolForAdd();
    if (!symbol) return;

    const optimisticId = `tmp-${Date.now()}`;
    const optimisticItem = {
      id: optimisticId,
      symbol,
      company_name: selectedSuggestion?.name || symbol,
      live_price: null,
      day_change_percent: null,
      market_cap: null,
      sparkline_7d: [],
      price_direction: 'neutral',
      stock_details: {
        symbol,
        company_name: selectedSuggestion?.name || symbol,
      },
    };

    setAdding(true);
    setPortfolio((prev) => [optimisticItem, ...prev]);
    setShowSuggestions(false);

    try {
      const res = await axios.post(
        `${API_BASE}/my-portfolio/add-stock/`,
        { symbol },
        { headers: authHeaders }
      );

      const serverItem = res.data?.item || null;
      if (serverItem) {
        setPortfolio((prev) => {
          const withoutTemp = prev.filter((item) => item.id !== optimisticId && item.id !== serverItem.id);
          return [serverItem, ...withoutTemp];
        });
      } else {
        setPortfolio((prev) => prev.filter((item) => item.id !== optimisticId));
        await fetchPortfolio();
      }

      setSearchQuery('');
      setSelectedSuggestion(null);
      setSearchResults([]);
    } catch (err) {
      setPortfolio((prev) => prev.filter((item) => item.id !== optimisticId));
      const msg = err.response?.data?.error
        || err.response?.data?.detail
        || 'Unable to add this stock right now.';
      alert(msg);
    } finally {
      setAdding(false);
    }
  };

  const removeFromPortfolio = async (portfolioId) => {
    const removedItem = portfolio.find((item) => item.id === portfolioId);
    setPortfolio((prev) => prev.filter((item) => item.id !== portfolioId));
    try {
      await axios.delete(`${API_BASE}/my-portfolio/${portfolioId}/`, {
        headers: authHeaders,
      });
    } catch {
      if (removedItem) {
        setPortfolio((prev) => [removedItem, ...prev]);
      }
      alert('Failed to remove stock from portfolio.');
    }
  };

  const summary = useMemo(() => {
    const valued = portfolio.map((item) => {
      const livePrice = toNumber(item.live_price ?? item.stock_details?.current_price);
      const changePercent = toNumber(item.day_change_percent);
      return {
        symbol: item.symbol || item.stock_details?.symbol || '-',
        livePrice,
        changePercent,
      };
    });

    const totalValue = valued.reduce((sum, item) => sum + (item.livePrice || 0), 0);
    const totalDelta = valued.reduce((sum, item) => {
      if (item.livePrice == null || item.changePercent == null) return sum;
      return sum + (item.livePrice * item.changePercent / 100);
    }, 0);
    const deltaPercent = totalValue > 0 ? (totalDelta / totalValue) * 100 : null;

    const topPerformer = valued
      .filter((item) => item.changePercent != null)
      .sort((a, b) => b.changePercent - a.changePercent)[0];

    return {
      totalValue,
      deltaPercent,
      topPerformer,
    };
  }, [portfolio]);

  if (loading) {
    return <div className="loading-text p-10 text-center font-bold">Loading portfolio...</div>;
  }

  return (
    <div className="container p-6 mx-auto portfolio-dashboard">
      <section className="portfolio-summary-grid">
        <article className="portfolio-summary-card">
          <p className="summary-label">Total Portfolio Value</p>
          <p className="summary-value mono-num">{formatCompactCurrency(summary.totalValue)}</p>
        </article>

        <article className="portfolio-summary-card">
          <p className="summary-label">Daily Gain / Loss</p>
          <p className={`summary-value mono-num ${changeClassName(summary.deltaPercent)}`}>
            {formatSignedPercent(summary.deltaPercent)}
          </p>
        </article>

        <article className="portfolio-summary-card">
          <p className="summary-label">Top Performing Stock</p>
          <p className="summary-value mono-num">
            {summary.topPerformer ? summary.topPerformer.symbol : 'N/A'}
          </p>
          <p className={`summary-sub ${changeClassName(summary.topPerformer?.changePercent)}`}>
            {summary.topPerformer ? formatSignedPercent(summary.topPerformer.changePercent) : 'No data'}
          </p>
        </article>
      </section>

      <section className="portfolio-search-panel" ref={searchRef}>
        <form onSubmit={handleAddStock} className="portfolio-search-form">
          <div className="portfolio-search-shell">
            <span className="portfolio-search-icon" aria-hidden="true">
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
                setSelectedSuggestion(null);
                setShowSuggestions(true);
              }}
              className="portfolio-search-input"
              placeholder="Find stocks by symbol or company (AAPL, RELIANCE.NS)"
            />
            {searching && <span className="portfolio-search-status">Searching...</span>}
          </div>

          <button
            type="submit"
            className="btn-add-stock"
            disabled={adding || !resolveSymbolForAdd()}
          >
            {adding ? 'Adding...' : 'Add Stock'}
          </button>
        </form>

        {showSuggestions && (searching || searchResults.length > 0 || searchQuery.trim()) && (
          <div className="portfolio-suggestions">
            {searching && <div className="suggestion-loading">Loading matches...</div>}

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
              <div className="suggestion-empty">No matches found. Press Add to try your input symbol.</div>
            )}
          </div>
        )}
      </section>

      <section className="portfolio-table-card">
        {portfolio.length === 0 ? (
          <div className="portfolio-empty">
            No stocks in your portfolio yet. Search and add your first stock.
            <div className="mt-6">
              <Link to="/" className="text-blue-400 hover:underline">Browse all stocks</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>P/E Ratio</th>
                    <th>52W High</th>
                    <th>52W Low</th>
                    <th>Avg 52W Discount</th>
                    <th>7D Trend</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((item) => {
                    const symbol = item.symbol || item.stock_details?.symbol || '-';
                    const company = item.company_name || item.stock_details?.company_name || symbol;
                    const sparkline = buildSparkline(item.sparkline_7d);
                    return (
                      <tr key={item.id} className={`portfolio-table-row ${String(item.id).startsWith('tmp-') ? 'is-pending' : ''}`}>
                        <td>
                          <div className="portfolio-symbol-cell">
                            <span className="symbol-badge">{symbol}</span>
                            <span className="portfolio-company">{company}</span>
                          </div>
                        </td>
                        <td className="mono-num">{formatCurrency(item.live_price ?? item.stock_details?.current_price)}</td>
                        <td className="mono-num">{formatNumber(item.stock_details?.pe_ratio)}</td>
                        <td className="mono-num">{formatCurrency(item.stock_details?.fifty_two_week_high)}</td>
                        <td className="mono-num">{formatCurrency(item.stock_details?.fifty_two_week_low)}</td>
                        <td className={`mono-num ${discountClassName(item.stock_details?.avg_discount_52w)}`}>
                          {formatCurrency(item.stock_details?.avg_discount_52w)}
                        </td>
                        <td>
                          {sparkline ? (
                            <svg
                              className="mini-sparkline"
                              viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                              aria-label={`${symbol} seven day trend`}
                            >
                              <path d={sparkline.areaPath} className="mini-sparkline-area" />
                              <path d={sparkline.linePath} className="mini-sparkline-line" />
                            </svg>
                          ) : (
                            <span className="sparkline-empty">--</span>
                          )}
                        </td>
                        <td>
                          {!String(item.id).startsWith('tmp-') ? (
                            <button
                              onClick={() => removeFromPortfolio(item.id)}
                              className="btn-remove"
                              title="Remove from portfolio"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="row-pending-tag">Syncing...</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="portfolio-mobile-cards">
              {portfolio.map((item) => {
                const symbol = item.symbol || item.stock_details?.symbol || '-';
                const sparkline = buildSparkline(item.sparkline_7d, 180, 44, 5);
                return (
                  <article key={`card-${item.id}`} className="portfolio-mobile-card">
                    <div className="card-head">
                      <span className="symbol-badge">{symbol}</span>
                      <span className={`mono-num ${discountClassName(item.stock_details?.avg_discount_52w)}`}>
                        {formatCurrency(item.stock_details?.avg_discount_52w)}
                      </span>
                    </div>
                    <div className="card-row">
                      <span>Price</span>
                      <span className="mono-num">{formatCurrency(item.live_price ?? item.stock_details?.current_price)}</span>
                    </div>
                    <div className="card-row">
                      <span>P/E Ratio</span>
                      <span className="mono-num">{formatNumber(item.stock_details?.pe_ratio)}</span>
                    </div>
                    <div className="card-row">
                      <span>52W High</span>
                      <span className="mono-num">{formatCurrency(item.stock_details?.fifty_two_week_high)}</span>
                    </div>
                    <div className="card-row">
                      <span>52W Low</span>
                      <span className="mono-num">{formatCurrency(item.stock_details?.fifty_two_week_low)}</span>
                    </div>
                    <div className="card-row">
                      <span>Avg 52W Discount</span>
                      <span className={`mono-num ${discountClassName(item.stock_details?.avg_discount_52w)}`}>
                        {formatCurrency(item.stock_details?.avg_discount_52w)}
                      </span>
                    </div>
                    <div className="card-sparkline">
                      {sparkline ? (
                        <svg
                          className="mini-sparkline"
                          viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                          aria-label={`${symbol} seven day trend`}
                        >
                          <path d={sparkline.areaPath} className="mini-sparkline-area" />
                          <path d={sparkline.linePath} className="mini-sparkline-line" />
                        </svg>
                      ) : (
                        <span className="sparkline-empty">No trend data</span>
                      )}
                    </div>
                    {!String(item.id).startsWith('tmp-') && (
                      <button onClick={() => removeFromPortfolio(item.id)} className="btn-remove">
                        Remove
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Portfolio;
