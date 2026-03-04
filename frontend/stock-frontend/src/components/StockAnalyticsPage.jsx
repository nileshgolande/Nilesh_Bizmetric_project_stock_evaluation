import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useParams } from 'react-router-dom';
import './Login.css';

const API_BASE = 'http://127.0.0.1:8000/api';

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

const CHART_WIDTH = 960;
const CHART_HEIGHT = 280;
const CHART_PADDING = 28;

const buildTrendChart = (rawPoints) => {
  const points = Array.isArray(rawPoints)
    ? rawPoints.filter(
      (point) => point && point.date && point.close != null && !Number.isNaN(Number(point.close))
    )
    : [];

  if (points.length < 2) {
    return null;
  }

  const closes = points.map((point) => Number(point.close));
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const range = maxClose - minClose || 1;
  const plotWidth = CHART_WIDTH - (CHART_PADDING * 2);
  const plotHeight = CHART_HEIGHT - (CHART_PADDING * 2);
  const denominator = Math.max(1, points.length - 1);

  const chartPoints = points.map((point, index) => {
    const x = CHART_PADDING + ((index / denominator) * plotWidth);
    const y = CHART_PADDING + (((maxClose - Number(point.close)) / range) * plotHeight);
    return {
      date: point.date,
      close: Number(point.close),
      x,
      y,
    };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${(CHART_HEIGHT - CHART_PADDING).toFixed(2)} L ${chartPoints[0].x.toFixed(2)} ${(CHART_HEIGHT - CHART_PADDING).toFixed(2)} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = CHART_PADDING + (ratio * plotHeight);
    return `M ${CHART_PADDING} ${y.toFixed(2)} L ${(CHART_WIDTH - CHART_PADDING).toFixed(2)} ${y.toFixed(2)}`;
  });

  return {
    firstDate: chartPoints[0].date,
    lastDate: chartPoints[chartPoints.length - 1].date,
    minClose,
    maxClose,
    linePath,
    areaPath,
    gridLines,
    lastPoint: chartPoints[chartPoints.length - 1],
  };
};

const StockAnalyticsPage = () => {
  const token = localStorage.getItem('token');
  const location = useLocation();
  const { symbol = '' } = useParams();
  const normalizedSymbol = symbol.toUpperCase();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockInfo, setStockInfo] = useState(location.state?.stock || null);
  const trendChart = analytics ? buildTrendChart(analytics.trend_graph) : null;

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError('');
      setAnalytics(null);

      try {
        const config = token ? { headers: { Authorization: `Token ${token}` } } : undefined;
        const response = await axios.get(
          `${API_BASE}/eda/analyze/${encodeURIComponent(normalizedSymbol)}/`,
          config
        );
        setAnalytics(response.data);
      } catch (err) {
        const errorMsg = err.response?.data?.error
          || err.response?.data?.details
          || 'Unable to load analytics for this stock.';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (normalizedSymbol) {
      fetchAnalytics();
    } else {
      setError('Missing stock symbol.');
      setLoading(false);
    }
  }, [normalizedSymbol, token]);

  useEffect(() => {
    const fetchStockInfo = async () => {
      if (stockInfo || !normalizedSymbol) return;

      try {
        const response = await axios.get(`${API_BASE}/stocks/`);
        const allStocks = Array.isArray(response.data) ? response.data : response.data.results || [];
        const matched = allStocks.find((item) => item.symbol === normalizedSymbol);
        if (matched) setStockInfo(matched);
      } catch {
        // Stock metadata is optional for this page; analytics data is primary.
      }
    };

    fetchStockInfo();
  }, [normalizedSymbol, stockInfo]);

  return (
    <div className="stocks-page">
      <div className="analytics-page-nav">
        <Link to="/" className="btn-secondary">Back to Stocks</Link>
        {token && <Link to="/portfolio" className="btn-primary">My Portfolio</Link>}
      </div>

      <header className="stocks-header">
        <h1>{normalizedSymbol} Analytics</h1>
        <p className="subtitle">
          {stockInfo?.company_name || 'Performance and risk metrics for the selected stock.'}
        </p>
      </header>

      {loading && <div className="analytics-state">Loading analytics...</div>}
      {!loading && error && <div className="analytics-error">{error}</div>}

      {!loading && analytics && !error && (
        <section className="stock-analytics-panel">
          <div className="stock-analytics-header">
            <h2>Stock Analytics</h2>
            <span className="selected-symbol">{analytics.symbol || normalizedSymbol}</span>
          </div>

          {trendChart ? (
            <div className="trend-chart-card">
              <div className="trend-chart-head">
                <h3>1 Year Trend Graph</h3>
                <span className="trend-chart-range">{trendChart.firstDate} to {trendChart.lastDate}</span>
              </div>

              <div className="trend-chart-wrap">
                <svg
                  className="trend-chart-svg"
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  role="img"
                  aria-label={`${normalizedSymbol} one-year price trend graph`}
                >
                  {trendChart.gridLines.map((gridPath) => (
                    <path key={gridPath} d={gridPath} className="trend-chart-grid" />
                  ))}
                  <path d={trendChart.areaPath} className="trend-chart-area" />
                  <path d={trendChart.linePath} className="trend-chart-line" />
                  <circle
                    className="trend-chart-dot"
                    cx={trendChart.lastPoint.x}
                    cy={trendChart.lastPoint.y}
                    r="4"
                  />
                </svg>
              </div>

              <div className="trend-chart-meta">
                <span>Start: {trendChart.firstDate}</span>
                <span>End: {trendChart.lastDate}</span>
                <span>Low: {formatCurrency(trendChart.minClose)}</span>
                <span>High: {formatCurrency(trendChart.maxClose)}</span>
              </div>
            </div>
          ) : (
            <div className="analytics-state">Trend graph data is unavailable for this stock.</div>
          )}

          <div className="analytics-grid">
            <div className="analytics-card">
              <p className="analytics-label">Company</p>
              <p className="analytics-value">{stockInfo?.company_name || 'N/A'}</p>
              <p className="analytics-subvalue">{stockInfo?.sector_name || 'Sector: N/A'}</p>
            </div>

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
              <p className="analytics-label">3 Month Return</p>
              <p className={`analytics-value ${valueClass(analytics.returns_percentage?.['3_month'])}`}>
                {formatPercent(analytics.returns_percentage?.['3_month'])}
              </p>
            </div>

            <div className="analytics-card">
              <p className="analytics-label">6 Month Return</p>
              <p className={`analytics-value ${valueClass(analytics.returns_percentage?.['6_month'])}`}>
                {formatPercent(analytics.returns_percentage?.['6_month'])}
              </p>
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

            <div className="analytics-card">
              <p className="analytics-label">Maximum Drawdown</p>
              <p className={`analytics-value ${valueClass(analytics.maximum_drawdown?.percentage)}`}>
                {formatPercent(analytics.maximum_drawdown?.percentage)}
              </p>
              <p className="analytics-subvalue">{analytics.maximum_drawdown?.date || 'N/A'}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default StockAnalyticsPage;
