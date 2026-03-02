import React, { useEffect, useState } from "react";
import axios from "axios";

const Dashboard = () => {

  const [view, setView] = useState("sectors");
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);

  // ------------------------------------
  // Fetch sectors
  // ------------------------------------
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const token = localStorage.getItem("token");

        const response = await axios.get(
          "http://127.0.0.1:8000/api/sectors/",
          {
            headers: {
              Authorization: `Token ${token}`,
            },
          }
        );

        setSectors(response.data);   // <-- array
        setLoading(false);

      } catch (error) {
        console.error("Error fetching sectors:", error);
        setLoading(false);
      }
    };

    fetchSectors();
  }, []);

  // ------------------------------------
  // Fetch stocks by sector
  // ------------------------------------
  const fetchStocks = async (sectorId) => {
    try {
      setStocksLoading(true);

      const token = localStorage.getItem("token");

      const response = await axios.get(
        `http://127.0.0.1:8000/api/sectors/${sectorId}/stocks/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      console.log("STOCK API DATA:", response.data);

      // ✅ FIX BASED ON REAL RESPONSE SHAPE
      if (Array.isArray(response.data)) {
        setStocks(response.data);
      } else if (response.data.results) {
        setStocks(response.data.results);   // pagination case
      } else if (response.data.stocks) {
        setStocks(response.data.stocks);    // nested case
      } else {
        setStocks([]);
      }

      setStocksLoading(false);

    } catch (error) {
      console.error("Error fetching stocks:", error);
      setStocksLoading(false);
    }
  };

  // ------------------------------------
  // UI
  // ------------------------------------
  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-blue-600">
        Loading Market Sectors...
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto">

      {/* ===============================
          VIEW 1 : SECTORS
      =============================== */}
      {view === "sectors" && (
        <>
          <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">
            Market Sectors
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {sectors.map((sector) => (
              <div
                key={sector.id}
                className="p-6 bg-white border-2 border-transparent rounded-xl shadow-md hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => {
                  setSelectedSector(sector);
                  fetchStocks(sector.id);
                  setView("stocks");
                }}
              >
                <h3 className="font-bold text-lg group-hover:text-blue-600">
                  {sector.name}
                </h3>

                <p className="text-sm text-gray-500">
                  Sector ID : {sector.id}
                </p>
              </div>
            ))}

          </div>
        </>
      )}

      {/* ===============================
          VIEW 2 : STOCKS
      =============================== */}
      {view === "stocks" && (
        <div className="max-w-2xl mx-auto">

          <button
            onClick={() => {
              setView("sectors");
              setStocks([]);
              setSelectedSector(null);
            }}
            className="text-blue-600 hover:underline mb-6 font-medium"
          >
            ← Back to All Sectors
          </button>

          <h3 className="text-xl font-bold mb-6">
            Stocks in{" "}
            <span className="text-blue-600">
              {selectedSector?.name}
            </span>
          </h3>

          <div className="bg-white rounded-xl shadow-md overflow-hidden border">

            {stocksLoading && (
              <div className="p-10 text-center text-gray-500">
                Loading stocks...
              </div>
            )}

            {!stocksLoading && stocks.length === 0 && (
              <div className="p-10 text-center text-gray-500">
                No stocks found.
              </div>
            )}

            {!stocksLoading &&
              stocks.map((stock) => (
                <div
                  key={stock.id}
                  className="p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                  onClick={() =>
                    alert("Ready to fetch EDA for " + stock.symbol)
                  }
                >
                  
                  <span className="font-mono font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded">
                    {stock.symbol}
                  </span>
                  <div id="results" class="mt-8 hidden border-t pt-6">
                    <h3 class="text-lg font-bold text-gray-800 mb-4" id="res-symbol"></h3>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div class="p-4 bg-blue-50 rounded">
                        <p class="text-sm text-gray-500">Current Price</p>
                        <p class="text-xl font-bold" >{stock.current_price}</p>
                      </div>
                      <div class="p-4 bg-orange-50 rounded">
                        <p class="text-sm text-gray-500">PE ratio</p>
                        <p class="text-xl font-bold" >{stock.pe_ratio}</p>
                      </div>
                    </div>
                    <pre id="raw-json" class="mt-6 p-4 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto"></pre>
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