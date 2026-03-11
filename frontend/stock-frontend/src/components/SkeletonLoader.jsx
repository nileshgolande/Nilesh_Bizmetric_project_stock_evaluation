import React from 'react';
import './SkeletonLoader.css';

export const StockRowSkeleton = () => (
  <tr className="skeleton-row">
    <td>
      <div className="skeleton-flex">
        <div className="skeleton-badge"></div>
        <div className="skeleton-pill"></div>
        <div className="skeleton-text" style={{ width: '150px' }}></div>
      </div>
    </td>
    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
    <td><div className="skeleton-text" style={{ width: '60px' }}></div></td>
    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
    <td><div className="skeleton-text" style={{ width: '100px' }}></div></td>
    <td>
      <div className="skeleton-sparkline">
        <svg viewBox="0 0 110 38" className="skeleton-svg">
          <path d="M 0 38 L 110 38" className="skeleton-line" />
        </svg>
      </div>
    </td>
    <td>
      <div className="skeleton-actions">
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
      </div>
    </td>
  </tr>
);

export const StockTableSkeleton = ({ rows = 10 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <StockRowSkeleton key={i} />
    ))}
  </>
);

export const CardSkeleton = () => (
  <div className="skeleton-card">
    <div className="skeleton-header"></div>
    <div className="skeleton-content">
      <div className="skeleton-line"></div>
      <div className="skeleton-line"></div>
      <div className="skeleton-line short"></div>
    </div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="skeleton-chart">
    <div className="skeleton-chart-bars">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton-bar" style={{ height: `${30 + Math.random() * 70}%` }}></div>
      ))}
    </div>
  </div>
);
