import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

const AddToPortfolioModal = ({ stock, onClose, onSuccess, defaultPortfolioName }) => {
  const [portfolioName, setPortfolioName] = useState(defaultPortfolioName || 'General');
  const [existingPortfolios, setExistingPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPortfolios, setFetchingPortfolios] = useState(true);
  const [error, setError] = useState('');
  const [isNewPortfolio, setIsNewPortfolio] = useState(false);

  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get(`${API_BASE}/my-portfolio/`, {
          headers: { Authorization: `Token ${token}` },
        });
        
        if (response.data && response.data.portfolio_names) {
          const names = response.data.portfolio_names;
          setExistingPortfolios(names);
          
          if (defaultPortfolioName) {
            if (names.includes(defaultPortfolioName)) {
               setPortfolioName(defaultPortfolioName);
               setIsNewPortfolio(false);
            } else {
               setPortfolioName(defaultPortfolioName);
               setIsNewPortfolio(true);
            }
          } else if (names.length > 0 && !names.includes(portfolioName)) {
             setPortfolioName(names[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching portfolios:', err);
      } finally {
        setFetchingPortfolios(false);
      }
    };
    
    fetchPortfolios();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        symbol: stock.symbol,
        portfolio_name: portfolioName
      };

      await axios.post(`${API_BASE}/my-portfolio/add-stock/`, payload, {
        headers: { Authorization: `Token ${token}` }
      });

      onSuccess(portfolioName);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add stock to portfolio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="text-xl font-bold text-white">Add to Portfolio</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
               <span className="text-gray-400 text-sm">Stock Symbol</span>
               <span className="text-blue-400 font-bold">{stock.symbol}</span>
            </div>
            <div className="flex items-center justify-between">
               <span className="text-gray-400 text-sm">Current Price</span>
               <span className="text-white font-mono">${stock.current_price?.toFixed(2)}</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-bold mb-2">
              Select Portfolio
            </label>
            
            {!isNewPortfolio ? (
              <div className="space-y-3">
                <select
                  value={portfolioName}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsNewPortfolio(true);
                      setPortfolioName('');
                    } else {
                      setPortfolioName(e.target.value);
                    }
                  }}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded p-2 focus:outline-none focus:border-blue-500"
                  disabled={fetchingPortfolios}
                >
                  {existingPortfolios.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="General">General</option>
                  <option value="__NEW__">+ Create New Portfolio...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="Enter new portfolio name"
                    className="flex-1 bg-gray-700 border border-gray-600 text-white rounded p-2 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setIsNewPortfolio(false);
                      setPortfolioName(existingPortfolios[0] || 'General');
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-300 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (isNewPortfolio && !portfolioName.trim())}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddToPortfolioModal;
