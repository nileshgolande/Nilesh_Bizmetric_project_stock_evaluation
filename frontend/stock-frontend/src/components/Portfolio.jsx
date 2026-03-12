import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTopSectors } from '../hooks/useStocks';
import './Login.css';

const API_BASE = '/api';
const DEFAULT_PORTFOLIO_NAME = 'General';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizePortfolioName = (value) => {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_PORTFOLIO_NAME;
};

const sortPortfolioNames = (names) => {
  const uniqueNames = [...new Set((Array.isArray(names) ? names : []).map(normalizePortfolioName))];
  return uniqueNames.sort((a, b) => {
    const aIsDefault = a.toLowerCase() === DEFAULT_PORTFOLIO_NAME.toLowerCase();
    const bIsDefault = b.toLowerCase() === DEFAULT_PORTFOLIO_NAME.toLowerCase();
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return a.localeCompare(b);
  });
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

const formatPercent = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'N/A';
  return `${numeric.toFixed(2)}%`;
};

const changeClassName = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'delta-neutral';
  if (numeric > 0) return 'delta-positive';
  if (numeric < 0) return 'delta-negative';
  return 'delta-neutral';
};

const recommendationClassName = (recommendation) => {
  const normalized = String(recommendation || '').toUpperCase();
  if (normalized === 'STRONG BUY') return 'recommendation-strong-buy';
  if (normalized === 'SELL/CAUTION') return 'recommendation-sell';
  return 'recommendation-hold';
};

const clusterColor = (clusterLabel) => {
  if (clusterLabel === 'Safe Haven') return '#34d399';
  if (clusterLabel === 'Aggressive Growth') return '#38bdf8';
  if (clusterLabel === 'Underperformers') return '#f87171';
  return '#94a3b8';
};

const discountClassName = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return 'delta-neutral';
  return numeric >= 0 ? 'delta-positive' : 'delta-negative';
};
const buildScatterPlotModel = (rawPoints, width = 760, height = 320, padding = 48) => {
  const points = Array.isArray(rawPoints)
    ? rawPoints
      .filter((point) => point && point.symbol && point.volatility != null && point.annualizedReturn != null)
      .map((point) => ({
        ...point,
        volatility: Number(point.volatility),
        annualizedReturn: Number(point.annualizedReturn),
      }))
      .filter((point) => Number.isFinite(point.volatility) && Number.isFinite(point.annualizedReturn))
    : [];

  if (points.length === 0) {
    return null;
  }

  const xValues = points.map((point) => point.volatility);
  const yValues = points.map((point) => point.annualizedReturn);
  let minX = Math.min(...xValues);
  let maxX = Math.max(...xValues);
  let minY = Math.min(...yValues);
  let maxY = Math.max(...yValues);

  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  minX -= xRange * 0.1;
  maxX += xRange * 0.1;
  minY -= yRange * 0.1;
  maxY += yRange * 0.1;

  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  const normalizedXRange = maxX - minX || 1;
  const normalizedYRange = maxY - minY || 1;

  const mapX = (value) => padding + (((value - minX) / normalizedXRange) * chartWidth);
  const mapY = (value) => (height - padding) - (((value - minY) / normalizedYRange) * chartHeight);

  const tickRatios = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = tickRatios.map((ratio) => {
    const value = minX + (normalizedXRange * ratio);
    return {
      x: mapX(value),
      value: Number(value.toFixed(2)),
    };
  });
  const yTicks = tickRatios.map((ratio) => {
    const value = minY + (normalizedYRange * ratio);
    return {
      y: mapY(value),
      value: Number(value.toFixed(2)),
    };
  });

  const mappedPoints = points.map((point) => ({
    ...point,
    x: mapX(point.volatility),
    y: mapY(point.annualizedReturn),
    color: clusterColor(point.clusterLabel),
  }));

  return {
    width,
    height,
    padding,
    xTicks,
    yTicks,
    points: mappedPoints,
  };
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

const normalizePortfolioItem = (item, fallbackPortfolioName) => ({
  ...item,
  portfolio_name: normalizePortfolioName(item?.portfolio_name || fallbackPortfolioName),
});

const mapPortfoliosFromPayload = (payload) => {
  const grouped = {};

  const pushItems = (portfolioName, items) => {
    const normalizedName = normalizePortfolioName(portfolioName);
    const normalizedItems = (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((item) => normalizePortfolioItem(item, normalizedName));
    if (normalizedItems.length === 0) return;
    grouped[normalizedName] = [...(grouped[normalizedName] || []), ...normalizedItems];
  };

  if (Array.isArray(payload)) {
    payload.forEach((item) => pushItems(item?.portfolio_name, [item]));
    return grouped;
  }

  if (!payload || typeof payload !== 'object') {
    return grouped;
  }

  if (payload.portfolios && typeof payload.portfolios === 'object' && !Array.isArray(payload.portfolios)) {
    Object.entries(payload.portfolios).forEach(([portfolioName, items]) => {
      pushItems(portfolioName, items);
    });
    return grouped;
  }

  if (Array.isArray(payload.items)) {
    payload.items.forEach((item) => pushItems(item?.portfolio_name, [item]));
    return grouped;
  }

  if (Array.isArray(payload.results)) {
    payload.results.forEach((item) => pushItems(item?.portfolio_name, [item]));
  }

  return grouped;
};

const addOrReplacePortfolioItem = (portfolioMap, item, portfolioNameOverride = null) => {
  const targetPortfolioName = normalizePortfolioName(portfolioNameOverride || item?.portfolio_name);
  const normalizedItem = normalizePortfolioItem(item, targetPortfolioName);
  const cleaned = {};

  Object.entries(portfolioMap).forEach(([portfolioName, items]) => {
    const filtered = (Array.isArray(items) ? items : []).filter((existingItem) => {
      if (!existingItem) return false;
      if (existingItem.id === normalizedItem.id) return false;
      if (
        String(existingItem.id).startsWith('tmp-')
        && String(normalizedItem.id).startsWith('tmp-')
        && existingItem.symbol === normalizedItem.symbol
      ) {
        return false;
      }
      if (
        String(existingItem.id).startsWith('tmp-')
        && !String(normalizedItem.id).startsWith('tmp-')
        && existingItem.symbol === normalizedItem.symbol
      ) {
        return false;
      }
      return true;
    });
    if (filtered.length > 0) {
      cleaned[portfolioName] = filtered;
    }
  });

  cleaned[targetPortfolioName] = [normalizedItem, ...(cleaned[targetPortfolioName] || [])];
  return cleaned;
};

const removePortfolioItemById = (portfolioMap, portfolioId) => {
  let removedItem = null;
  const nextMap = {};

  Object.entries(portfolioMap).forEach(([portfolioName, items]) => {
    const remainingItems = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (item?.id === portfolioId) {
        removedItem = normalizePortfolioItem(item, portfolioName);
      } else {
        remainingItems.push(item);
      }
    });
    if (remainingItems.length > 0) {
      nextMap[portfolioName] = remainingItems;
    }
  });

  return { nextMap, removedItem };
};
const Portfolio = () => {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem('token'));
  const authHeaders = useMemo(() => {
    const currentToken = localStorage.getItem('token');
    return currentToken ? { Authorization: `Token ${currentToken}` } : {};
  }, []);
  
  const handleStockClick = (item) => {
    const symbol = item.symbol || item.stock_details?.symbol;
    if (symbol) {
      navigate(`/stocks/${encodeURIComponent(symbol)}`, { 
        state: { 
          stock: {
            symbol,
            company_name: item.company_name || item.stock_details?.company_name,
            ...item
          }
        } 
      });
    }
  };

  const [portfolios, setPortfolios] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeScatterSymbol, setActiveScatterSymbol] = useState('');
  const [activePortfolioName, setActivePortfolioName] = useState(DEFAULT_PORTFOLIO_NAME);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const { data: topSectors = [] } = useTopSectors();

  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const portfolioNames = useMemo(
    () => sortPortfolioNames(Object.keys(portfolios)),
    [portfolios]
  );

  const resolvedActivePortfolioName = useMemo(() => {
    if (portfolioNames.length === 0) return DEFAULT_PORTFOLIO_NAME;
    if (portfolioNames.includes(activePortfolioName)) return activePortfolioName;
    return portfolioNames[0];
  }, [portfolioNames, activePortfolioName]);

  const activePortfolioItems = useMemo(
    () => portfolios[resolvedActivePortfolioName] || [],
    [portfolios, resolvedActivePortfolioName]
  );

  const handleCreateSectorPortfolio = (sectorName) => {
    if (!portfolios[sectorName]) {
      setPortfolios((prev) => ({ ...prev, [sectorName]: [] }));
    }
    setActivePortfolioName(sectorName);
  };

  const fetchPortfolio = async (options = {}) => {
    const {
      includeLive = liveLoaded,
      includeAnalytics = false,
      showLoading = true,
      silent = false,
      updateFlags = true,
    } = options;

    try {
      if (showLoading) {
        setError(null);
        setLoading(true);
      }
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        if (!silent) {
          setError('Please log in to view your portfolio.');
        }
        if (showLoading) {
          setLoading(false);
        }
        return false;
      }
      
      const res = await axios.get(`${API_BASE}/my-portfolio/`, {
        headers: { Authorization: `Token ${currentToken}` },
        params: {
          include_live: includeLive,
          include_analytics: includeAnalytics,
        },
      });
      setPortfolios(mapPortfoliosFromPayload(res.data));
      if (updateFlags) {
        setLiveLoaded(includeLive);
        setAnalyticsLoaded(includeAnalytics);
      }
      return true;
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return false;
      }

      if (!silent) {
        const errorMessage = err.response?.data?.error 
          || err.response?.data?.detail 
          || err.message 
          || 'Failed to load portfolio. Please try again.';
        setError(errorMessage);
        setPortfolios({});
      }
      return false;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      setError('Please log in to view your portfolio.');
      setLoading(false);
      return;
    }
    let isMounted = true;
    const load = async () => {
      const ok = await fetchPortfolio({
        includeLive: false,
        includeAnalytics: false,
        showLoading: true,
        silent: false,
        updateFlags: true,
      });
      if (!ok || !isMounted) return;
      fetchPortfolio({
        includeLive: true,
        includeAnalytics: false,
        showLoading: false,
        silent: true,
        updateFlags: true,
      });
    };
    load();
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (portfolioNames.length === 0) {
      if (activePortfolioName !== DEFAULT_PORTFOLIO_NAME) {
        setActivePortfolioName(DEFAULT_PORTFOLIO_NAME);
      }
      return;
    }
    if (!portfolioNames.includes(activePortfolioName)) {
      setActivePortfolioName(portfolioNames[0]);
    }
  }, [portfolioNames, activePortfolioName]);

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
        const params = { q: query };
        // If the active portfolio is not 'General', filter by sector
        if (resolvedActivePortfolioName !== DEFAULT_PORTFOLIO_NAME) {
          params.sector_name = resolvedActivePortfolioName;
        }
        
        const res = await axios.get(`${API_BASE}/stocks/search/`, { params });
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
      portfolio_name: resolvedActivePortfolioName,
      symbol,
      company_name: selectedSuggestion?.name || symbol,
      live_price: null,
      day_change_percent: null,
      market_cap: null,
      sparkline_7d: [],
      price_direction: 'neutral',
      annualized_return: null,
      volatility: null,
      cluster_label: 'Underperformers',
      predicted_price_7d: null,
      forecast_line_7d: [],
      rsi_14: null,
      recommendation: 'HOLD',
      buy_signal: false,
      stock_details: {
        symbol,
        company_name: selectedSuggestion?.name || symbol,
      },
    };

    setAdding(true);
    setPortfolios((prev) => addOrReplacePortfolioItem(prev, optimisticItem, resolvedActivePortfolioName));
    setShowSuggestions(false);

    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        alert('Please log in to add stocks to your portfolio.');
        return;
      }
      
      const res = await axios.post(
        `${API_BASE}/my-portfolio/add-stock/`,
        {
          symbol,
          portfolio_sector: resolvedActivePortfolioName,
        },
        { headers: { Authorization: `Token ${currentToken}` } }
      );

      const serverItem = res.data?.item || null;
      if (serverItem) {
        setPortfolios((prev) => {
          const { nextMap } = removePortfolioItemById(prev, optimisticId);
          return addOrReplacePortfolioItem(nextMap, serverItem, serverItem.portfolio_name);
        });
      } else {
        setPortfolios((prev) => removePortfolioItemById(prev, optimisticId).nextMap);
        await fetchPortfolio();
      }

      setSearchQuery('');
      setSelectedSuggestion(null);
      setSearchResults([]);
    } catch (err) {
      setPortfolios((prev) => removePortfolioItemById(prev, optimisticId).nextMap);
      const msg = err.response?.data?.error
        || err.response?.data?.detail
        || 'Unable to add this stock right now.';
      alert(msg);
    } finally {
      setAdding(false);
    }
  };
  const removeFromPortfolio = async (portfolioId) => {
    const { nextMap, removedItem } = removePortfolioItemById(portfolios, portfolioId);
    if (!removedItem) return;

    setPortfolios(nextMap);
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        alert('Please log in to manage your portfolio.');
        setPortfolios((prev) => addOrReplacePortfolioItem(prev, removedItem, removedItem.portfolio_name));
        return;
      }
      
      await axios.delete(`${API_BASE}/my-portfolio/${portfolioId}/`, {
        headers: { Authorization: `Token ${currentToken}` },
      });
    } catch (err) {
      setPortfolios((prev) => addOrReplacePortfolioItem(prev, removedItem, removedItem.portfolio_name));
      const errorMsg = err.response?.data?.error 
        || err.response?.data?.detail 
        || 'Failed to remove stock from portfolio.';
      alert(errorMsg);
    }
  };

  const summary = useMemo(() => {
    const valued = activePortfolioItems.map((item) => {
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
  }, [activePortfolioItems]);

  const scatterModel = useMemo(() => {
    const points = activePortfolioItems.map((item) => ({
      symbol: item.symbol || item.stock_details?.symbol || '-',
      annualizedReturn: toNumber(item.annualized_return),
      volatility: toNumber(item.volatility),
      clusterLabel: item.cluster_label || 'Underperformers',
      recommendation: item.recommendation || 'HOLD',
    }));
    return buildScatterPlotModel(points);
  }, [activePortfolioItems]);

  const activeScatterPoint = useMemo(() => {
    if (!scatterModel?.points?.length) return null;
    return scatterModel.points.find((point) => point.symbol === activeScatterSymbol) || scatterModel.points[0];
  }, [scatterModel, activeScatterSymbol]);

  const loadAnalytics = async () => {
    if (analyticsLoading || analyticsLoaded) return;
    setAnalyticsLoading(true);
    try {
      await fetchPortfolio({
        includeLive: true,
        includeAnalytics: true,
        showLoading: false,
        silent: true,
        updateFlags: true,
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (!scatterModel?.points?.length) {
      if (activeScatterSymbol) setActiveScatterSymbol('');
      return;
    }
    const stillExists = scatterModel.points.some((point) => point.symbol === activeScatterSymbol);
    if (!stillExists) {
      setActiveScatterSymbol(scatterModel.points[0].symbol);
    }
  }, [scatterModel, activeScatterSymbol]);

  if (loading) {
    return (
      <div className="portfolio-dashboard">
        <div className="loading-text p-10 text-center font-bold">Loading portfolio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-dashboard">
        <div className="analytics-error p-6 text-center">
          <h3 style={{ marginBottom: '1rem', color: 'var(--danger-light)' }}>Error Loading Portfolio</h3>
          <p>{error}</p>
          <button
            onClick={fetchPortfolio}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto portfolio-dashboard">
      <section className="portfolio-tabs-card">
        <div className="portfolio-tabs-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Sector Portfolios</h3>
            <p>Each tab tracks a separate portfolio by sector context.</p>
          </div>
          <div className="create-portfolio-dropdown">
            <select 
              className="portfolio-search-input" 
              onChange={(e) => {
                if (e.target.value) {
                  handleCreateSectorPortfolio(e.target.value);
                  e.target.value = ''; // Reset dropdown after selection
                }
              }}
              style={{ width: 'auto', minWidth: '180px', cursor: 'pointer' }}
            >
              <option value="">+ Create Portfolio</option>
              {topSectors.map((sector) => (
                <option key={sector.id} value={sector.name}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {portfolioNames.length === 0 ? (
          <div className="portfolio-empty">No sector portfolios yet.</div>
        ) : (
          <div className="portfolio-tabs" role="tablist" aria-label="Sector portfolios">
            {portfolioNames.map((portfolioName) => (
              <button
                key={portfolioName}
                type="button"
                role="tab"
                aria-selected={resolvedActivePortfolioName === portfolioName}
                className={`portfolio-tab ${resolvedActivePortfolioName === portfolioName ? 'is-active' : ''}`}
                onClick={() => setActivePortfolioName(portfolioName)}
              >
                <span>{portfolioName}</span>
                <span className="portfolio-tab-count mono-num">{(portfolios[portfolioName] || []).length}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="portfolio-summary-grid">
        <article className="portfolio-summary-card">
          <p className="summary-label">Total Value ({resolvedActivePortfolioName})</p>
          <p className="summary-value mono-num">{formatCompactCurrency(summary.totalValue)}</p>
        </article>

        <article className="portfolio-summary-card">
          <p className="summary-label">Daily Gain / Loss ({resolvedActivePortfolioName})</p>
          <p className={`summary-value mono-num ${changeClassName(summary.deltaPercent)}`}>
            {formatSignedPercent(summary.deltaPercent)}
          </p>
        </article>

        <article className="portfolio-summary-card">
          <p className="summary-label">Top Performer ({resolvedActivePortfolioName})</p>
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
              placeholder={resolvedActivePortfolioName === DEFAULT_PORTFOLIO_NAME 
                ? "Find stocks by symbol or company (AAPL, RELIANCE.NS)"
                : `Find ${resolvedActivePortfolioName} stocks`}
            />
            {searching && <span className="portfolio-search-status">Searching...</span>}
          </div>

          <button
            type="submit"
            className="btn-add-stock"
            disabled={adding || !resolveSymbolForAdd()}
          >
            {adding ? 'Adding...' : `Add To ${resolvedActivePortfolioName}`}
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
      <section className="portfolio-scatter-card">
        <div className="portfolio-scatter-head">
          <h3>Risk vs Return Cluster Map</h3>
          <p>
            Volatility on X-axis and annualized return on Y-axis for
            {' '}
            <strong>{resolvedActivePortfolioName}</strong>
            {' '}
            holdings.
          </p>
        </div>

        {!scatterModel ? (
          <div className="portfolio-empty">
            {activePortfolioItems.length === 0 ? (
              <>
                No stocks found in
                {' '}
                {resolvedActivePortfolioName}
                .
              </>
            ) : (
              <>
                <div>
                  {analyticsLoaded
                    ? `Risk/return data is still loading for the ${resolvedActivePortfolioName} portfolio.`
                    : `Advanced analytics are not loaded yet for the ${resolvedActivePortfolioName} portfolio.`}
                </div>
                {!analyticsLoaded && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: '0.75rem' }}
                    onClick={loadAnalytics}
                    disabled={analyticsLoading}
                  >
                    {analyticsLoading ? 'Loading analytics...' : 'Load analytics'}
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="portfolio-scatter-wrap">
              <svg
                className="portfolio-scatter-svg"
                viewBox={`0 0 ${scatterModel.width} ${scatterModel.height}`}
                role="img"
                aria-label="Risk versus return scatter chart"
              >
                <path
                  d={`M ${scatterModel.padding} ${scatterModel.height - scatterModel.padding} L ${scatterModel.width - scatterModel.padding} ${scatterModel.height - scatterModel.padding}`}
                  className="scatter-axis"
                />
                <path
                  d={`M ${scatterModel.padding} ${scatterModel.height - scatterModel.padding} L ${scatterModel.padding} ${scatterModel.padding}`}
                  className="scatter-axis"
                />

                {scatterModel.xTicks.map((tick) => (
                  <g key={`x-${tick.x}`}>
                    <path
                      d={`M ${tick.x} ${scatterModel.height - scatterModel.padding} L ${tick.x} ${scatterModel.padding}`}
                      className="scatter-grid"
                    />
                    <text
                      x={tick.x}
                      y={scatterModel.height - scatterModel.padding + 18}
                      className="scatter-tick-label"
                      textAnchor="middle"
                    >
                      {tick.value}%
                    </text>
                  </g>
                ))}

                {scatterModel.yTicks.map((tick) => (
                  <g key={`y-${tick.y}`}>
                    <path
                      d={`M ${scatterModel.padding} ${tick.y} L ${scatterModel.width - scatterModel.padding} ${tick.y}`}
                      className="scatter-grid"
                    />
                    <text
                      x={scatterModel.padding - 10}
                      y={tick.y + 4}
                      className="scatter-tick-label"
                      textAnchor="end"
                    >
                      {tick.value}%
                    </text>
                  </g>
                ))}

                {scatterModel.points.map((point) => {
                  const isActive = activeScatterPoint?.symbol === point.symbol;
                  return (
                    <g key={point.symbol}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isActive ? 8 : 5}
                        fill={point.color}
                        className="scatter-point"
                        onMouseEnter={() => setActiveScatterSymbol(point.symbol)}
                      />
                      {isActive && (
                        <text x={point.x + 10} y={point.y - 8} className="scatter-point-label">
                          {point.symbol}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="portfolio-scatter-footer">
              <div className="scatter-legend">
                <span><i className="legend-dot safe" /> Safe Haven</span>
                <span><i className="legend-dot growth" /> Aggressive Growth</span>
                <span><i className="legend-dot under" /> Underperformers</span>
              </div>

              {activeScatterPoint && (
                <div className="scatter-focus-card">
                  <p className="scatter-focus-symbol">{activeScatterPoint.symbol}</p>
                  <p className="scatter-focus-metric">Volatility: <span className="mono-num">{formatPercent(activeScatterPoint.volatility)}</span></p>
                  <p className="scatter-focus-metric">Annualized Return: <span className="mono-num">{formatSignedPercent(activeScatterPoint.annualizedReturn)}</span></p>
                  <p className="scatter-focus-metric">Cluster: <span>{activeScatterPoint.clusterLabel}</span></p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="portfolio-table-card">
        {portfolioNames.length === 0 ? (
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
                    <th>LR Forecast (2D)</th>
                    <th>AI Direction</th>
                    <th>CNN Prediction (2D)</th>
                    <th>RNN Prediction (2D)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activePortfolioItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="portfolio-empty">
                        No stocks found in
                        {' '}
                        {resolvedActivePortfolioName}
                        .
                      </td>
                    </tr>
                  ) : (
                    activePortfolioItems.map((item) => {
                      const symbol = item.symbol || item.stock_details?.symbol || '-';
                      const company = item.company_name || item.stock_details?.company_name || symbol;
                      const sparkline = buildSparkline(item.sparkline_7d);
                      return (
                        <tr
                          key={item.id}
                          className={`portfolio-table-row ${String(item.id).startsWith('tmp-') ? 'is-pending' : ''}`}
                          onMouseEnter={() => setActiveScatterSymbol(symbol)}
                          onClick={() => handleStockClick(item)}
                          style={{ cursor: 'pointer' }}
                        >
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
                             <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                               {item.lr_forecast_2d && item.lr_forecast_2d[0] != null ? (
                                 <>
                                   <span style={{ color: '#38bdf8' }}>D+1: {formatCurrency(item.lr_forecast_2d[0])}</span>
                                   <span style={{ color: '#818cf8' }}>D+2: {formatCurrency(item.lr_forecast_2d[1])}</span>
                                 </>
                               ) : (
                                 <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                               )}
                             </div>
                          </td>
                          <td className="mono-num">
                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                               {item.logistic_signal ? (
                                 <>
                                   <span className={`recommendation-badge ${item.logistic_signal === 'UP' ? 'recommendation-strong-buy' : 'recommendation-sell'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                                     {item.logistic_signal}
                                   </span>
                                   {item.logistic_accuracy != null && (
                                     <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                                       Acc: {formatPercent(item.logistic_accuracy * 100)}
                                     </span>
                                   )}
                                 </>
                               ) : <span className="text-gray-500">N/A</span>}
                             </div>
                          </td>
                          <td>
                             <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                               {item.cnn_next_2_days && item.cnn_next_2_days[0] != null ? (
                                 <>
                                   <span style={{ color: '#10b981' }}>D+1: {formatCurrency(item.cnn_next_2_days[0])}</span>
                                   <span style={{ color: '#059669' }}>D+2: {formatCurrency(item.cnn_next_2_days[1])}</span>
                                   {item.cnn_rmse != null && (
                                     <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>RMSE: {item.cnn_rmse.toFixed(2)}</span>
                                   )}
                                 </>
                               ) : <span className="text-gray-500">N/A</span>}
                             </div>
                          </td>
                          <td>
                             <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                               {item.rnn_next_2_days && item.rnn_next_2_days[0] != null ? (
                                 <>
                                   <span style={{ color: '#8b5cf6' }}>D+1: {formatCurrency(item.rnn_next_2_days[0])}</span>
                                   <span style={{ color: '#7c3aed' }}>D+2: {formatCurrency(item.rnn_next_2_days[1])}</span>
                                   {item.rnn_rmse != null && (
                                     <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>RMSE: {item.rnn_rmse.toFixed(2)}</span>
                                   )}
                                 </>
                               ) : <span className="text-gray-500">N/A</span>}
                             </div>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="portfolio-mobile-cards">
              {activePortfolioItems.map((item) => {
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
                    <div className="card-row">
                      <span>LR Forecast (2D)</span>
                      <div className="flex flex-col text-right">
                         {item.lr_forecast_2d && item.lr_forecast_2d[0] != null ? (
                           <>
                             <span style={{ color: '#38bdf8' }}>D+1: {formatCurrency(item.lr_forecast_2d[0])}</span>
                             <span style={{ color: '#818cf8' }}>D+2: {formatCurrency(item.lr_forecast_2d[1])}</span>
                           </>
                         ) : <span>N/A</span>}
                      </div>
                    </div>
                    <div className="card-row">
                      <span>AI Direction</span>
                      <div className="flex flex-col text-right">
                         {item.logistic_signal ? (
                           <>
                             <span className={`recommendation-badge ${item.logistic_signal === 'UP' ? 'recommendation-strong-buy' : 'recommendation-sell'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                               {item.logistic_signal}
                             </span>
                             {item.logistic_accuracy != null && (
                               <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Acc: {formatPercent(item.logistic_accuracy * 100)}</span>
                             )}
                           </>
                         ) : <span>N/A</span>}
                      </div>
                    </div>
                    <div className="card-row">
                      <span>CNN (2D)</span>
                      <div className="flex flex-col text-right">
                         {item.cnn_next_2_days && item.cnn_next_2_days[0] != null ? (
                           <>
                             <span style={{ color: '#10b981' }}>D+1: {formatCurrency(item.cnn_next_2_days[0])}</span>
                             <span style={{ color: '#059669' }}>D+2: {formatCurrency(item.cnn_next_2_days[1])}</span>
                           </>
                         ) : <span>N/A</span>}
                      </div>
                    </div>
                    <div className="card-row">
                      <span>RNN (2D)</span>
                      <div className="flex flex-col text-right">
                         {item.rnn_next_2_days && item.rnn_next_2_days[0] != null ? (
                           <>
                             <span style={{ color: '#8b5cf6' }}>D+1: {formatCurrency(item.rnn_next_2_days[0])}</span>
                             <span style={{ color: '#7c3aed' }}>D+2: {formatCurrency(item.rnn_next_2_days[1])}</span>
                           </>
                         ) : <span>N/A</span>}
                      </div>
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
