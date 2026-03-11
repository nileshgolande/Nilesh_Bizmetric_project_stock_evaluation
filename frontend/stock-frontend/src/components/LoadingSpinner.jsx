import React from 'react';
import './LoadingSpinner.css';

export const LoadingSpinner = ({ size = 'medium', text = 'Loading...' }) => (
  <div className="loading-spinner-container">
    <div className={`loading-spinner ${size}`}>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
    </div>
    {text && <div className="loading-text">{text}</div>}
  </div>
);

export const InlineSpinner = ({ size = 'small' }) => (
  <div className={`inline-spinner ${size}`}>
    <div className="spinner-dot"></div>
    <div className="spinner-dot"></div>
    <div className="spinner-dot"></div>
  </div>
);
