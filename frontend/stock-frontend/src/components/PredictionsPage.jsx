import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import PredictionGraph from './PredictionGraph';

const API_BASE = '/api';

const PredictionsPage = () => {
  const { assetType } = useParams(); // Gold, Silver, BTC
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Token ${token}` } } : undefined;
        const response = await axios.get(`${API_BASE}/predictions/${assetType}/`, config);
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch predictions');
      } finally {
        setLoading(false);
      }
    };

    if (assetType) {
      fetchData();
    }
  }, [assetType]);

  return (
    <div className="p-6 text-white">
      <h2 className="text-3xl font-bold mb-6">{assetType} Price Predictions</h2>
      
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <div className="text-blue-400 font-medium">Training AI Models & Generating Predictions...</div>
            <div className="text-gray-500 text-sm mt-2">This usually takes 5-10 seconds.</div>
        </div>
      )}
      
      {error && <div className="text-center text-red-400 bg-red-900/20 p-4 rounded border border-red-900">{error}</div>}
      
      {!loading && !error && (
        <div className="space-y-6">
          <PredictionGraph data={data} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h4 className="text-blue-400 font-bold mb-2 text-lg">Linear Regression</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                    A statistical method that models the relationship between a scalar response and one or more explanatory variables using a linear predictor functions.
                </p>
             </div>
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h4 className="text-green-400 font-bold mb-2 text-lg">CNN (1D-Convolutional)</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                    A Deep Learning model that uses 1D convolution layers to extract local features and patterns from the time-series data, effective for spotting trends.
                </p>
             </div>
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h4 className="text-orange-400 font-bold mb-2 text-lg">RNN (Recurrent Neural Network)</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                    A class of artificial neural networks where connections between nodes form a directed graph along a temporal sequence, allowing it to exhibit temporal dynamic behavior.
                </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionsPage;
