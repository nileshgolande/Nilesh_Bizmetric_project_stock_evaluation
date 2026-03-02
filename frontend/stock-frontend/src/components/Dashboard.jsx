import React, { useEffect, useState } from "react";
import axios from "axios";
import './Login.css';

const Dashboard = () => {
  const [view, setView] = useState("sectors");
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);

  // Fetch sectors on mount
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://127.0.0.1:8000/api/sectors/", {
          headers: { Authorization: `Token ${token}` },
        });
        setSectors(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching sectors:", error);
        setLoading(false);
      }
    };
    fetchSectors();
  }, []);

  // Fetch stocks by sector
  const fetchStocks = async (sectorId) => {
    try {
      setStocksLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`http://127.0.0.1:8000/api/sectors/${sectorId}/stocks/`, {
        headers: { Authorization: `Token ${token}` },
      });

      if (Array.isArray(response.data)) {
        setStocks(response.data);
      } else if (response.data.results) {
        setStocks(response.data.results);
      } else {
        setStocks([]);
      }
      setStocksLoading(false);
    } catch (error) {
      console.error("Error fetching stocks:", error);
      setStocksLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-text p-10 text-center font-bold">Loading Market Sectors...</div>;
  }

  return (
    <div className="container p-6 mx-auto">
      {/* VIEW 1 : SECTORS */}
      {view === "sectors" && (
        <>
          <h2 className="text-2xl font-bold mb-6 border-b pb-2">Market Sectors</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sectors.map((sector) => (
              <div
                key={sector.id}
                className="sector-card cursor-pointer group"
                onClick={() => {
                  setSelectedSector(sector);
                  fetchStocks(sector.id);
                  setView("stocks");
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

      {/* VIEW 2 : STOCKS */}
      {view === "stocks" && (
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => {
              setView("sectors");
              setStocks([]);
              setSelectedSector(null);
            }}
            className="text-blue-400 hover:underline mb-6 font-medium"
          >
            ← Back to All Sectors
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
                className="stock-row"
                onClick={() => alert("Ready to fetch EDA for " + stock.symbol)}
              >
                <span className="symbol-badge">{stock.symbol}</span>

                <div className="flex gap-4">
                  <div className="metric-card bg-blue-metric">
                    <p className="text-xs text-gray-400">Price</p>
                    <p className="text-lg font-bold text-white">{stock.current_price || 'N/A'}</p>
                  </div>
                  <div className="metric-card bg-orange-metric">
                    <p className="text-xs text-gray-400">P/E Ratio</p>
                    <p className="text-lg font-bold text-white">{stock.pe_ratio || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;