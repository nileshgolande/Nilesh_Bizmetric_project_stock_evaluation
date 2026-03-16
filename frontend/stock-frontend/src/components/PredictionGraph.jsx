// import React, { useState, useEffect } from "react";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Label,
} from "recharts";

const PredictionGraph = ({ data }) => {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef(null);

  // Zoom and Pan State
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(null);

  const [visibleModels, setVisibleModels] = useState({
    actual: true,
    lr: true,
    rnn: true,
    cnn: true,
  });

  useEffect(() => {
    setMounted(true);
    if (data && data.length > 0) {
      // Default view: Show last 50 points or all points if less than 50
      const count = data.length;
      const initialCount = Math.min(count, 50);
      setZoomRange({
        start: ((count - initialCount) / count) * 100,
        end: 100
      });
    }
  }, [data]);

  const toggleModel = (model) => {
    setVisibleModels((prev) => ({ ...prev, [model]: !prev[model] }));
  };

  const handleResetZoom = () => {
    setZoomRange({ start: 0, end: 100 });
  };

  const transformedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const futureIndex = data.findIndex(d => d.is_future);
    const lastHIndex = futureIndex > 0 ? futureIndex - 1 : (futureIndex === 0 ? -1 : data.length - 1);

    return data.map((item, idx) => {
      const isFuture = item.is_future;
      const isTransition = idx === lastHIndex;
      
      return {
        ...item,
        // Model split keys for solid/dashed rendering
        lr_h: !isFuture || isTransition ? item.lr_prediction : null,
        lr_p: isFuture || isTransition ? item.lr_prediction : null,
        cnn_h: !isFuture || isTransition ? item.cnn_prediction : null,
        cnn_p: isFuture || isTransition ? item.cnn_prediction : null,
        rnn_h: !isFuture || isTransition ? item.rnn_prediction : null,
        rnn_p: isFuture || isTransition ? item.rnn_prediction : null,
        // Actual price only for historical
        actual_h: !isFuture ? item.actual_price : null
      };
    });
  }, [data]);

  const visibleData = useMemo(() => {
    if (!transformedData || transformedData.length === 0) return [];
    const startIndex = Math.floor((zoomRange.start / 100) * transformedData.length);
    const endIndex = Math.ceil((zoomRange.end / 100) * transformedData.length);
    return transformedData.slice(startIndex, endIndex);
  }, [transformedData, zoomRange]);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? zoomIntensity : -zoomIntensity;
    
    setZoomRange(prev => {
      const range = prev.end - prev.start;
      const center = prev.start + range / 2;
      const newRange = Math.max(5, Math.min(100, range * (1 + delta)));
      
      let newStart = center - newRange / 2;
      let newEnd = center + newRange / 2;
      
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > 100) {
        newStart -= (newEnd - 100);
        newEnd = 100;
      }
      
      return { start: Math.max(0, newStart), end: Math.min(100, newEnd) };
    });
  };

  const handleMouseDown = (e) => {
    setIsPanning(true);
    setPanStartX(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (!isPanning || panStartX === null) return;
    
    const deltaX = e.clientX - panStartX;
    const sensitivity = 0.5;
    const movement = (deltaX / containerRef.current.offsetWidth) * 100 * sensitivity;
    
    setZoomRange(prev => {
      const range = prev.end - prev.start;
      let newStart = prev.start - movement;
      let newEnd = prev.end - movement;
      
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > 100) {
        newStart -= (newEnd - 100);
        newEnd = 100;
      }
      
      return { start: newStart, end: newEnd };
    });
    
    setPanStartX(e.clientX);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStartX(null);
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center p-10 rounded-lg" style={{ 
        color: 'var(--text-tertiary)', 
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)'
      }}>
        No data available for graph
      </div>
    );
  }

  const futureDataIndex = data.findIndex(item => item.is_future);
  const lastHistoricalData = futureDataIndex > 0 ? data[futureDataIndex - 1] : null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const dateObj = new Date(label);
      
      // Filter payload to avoid duplicate entries (historical vs prediction) for the same model
      const uniquePayload = [];
      const seenNames = new Set();
      
      payload.forEach(entry => {
        // Normalize name (e.g., "LR Prediction (H)" -> "LR Prediction")
        const name = entry.name.replace(" (H)", "").replace(" (P)", "");
        if (!seenNames.has(name) && entry.value !== null && entry.value !== undefined) {
          seenNames.add(name);
          uniquePayload.push({ ...entry, name });
        }
      });

      return (
        <div className="p-2.5 rounded shadow-xl pointer-events-none min-w-[160px]" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)'
        }}>
          <div className="flex flex-col gap-0.5 border-b pb-2 mb-2" style={{ borderColor: 'var(--border-primary)' }}>
            <p className="font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          
          <div className="flex flex-col gap-1.5">
            {uniquePayload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                </div>
                <span className="font-bold text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  ${entry.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          {dataPoint.is_future && (
            <div className="mt-2 pt-2 border-t flex items-center justify-center gap-1.5" style={{ borderColor: 'var(--border-primary)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: '#F59E0B' }}>AI Forecast</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 rounded-xl shadow-sm w-full font-sans transition-all" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)'
    }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h3 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Price Predictions
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Professional Chart Analysis</p>
        </div>

        <div
          className="flex gap-2 flex-wrap items-center px-2 py-1 rounded-full"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <button
            onClick={handleResetZoom}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            Reset View
          </button>
          
          <div className="h-6 w-px mx-1" style={{ background: 'var(--border-primary)' }} />

          <button
            onClick={() => toggleModel("actual")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              visibleModels.actual
                ? "text-white border-blue-600 shadow-md"
                : ""
            }`}
            style={visibleModels.actual ? {
              background: '#2563EB',
              borderColor: '#2563EB',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            } : {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            Actual
          </button>

          <button
            onClick={() => toggleModel("lr")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              visibleModels.lr
                ? "text-white border-orange-500 shadow-md"
                : ""
            }`}
            style={visibleModels.lr ? {
              background: '#F59E0B',
              borderColor: '#F59E0B',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            } : {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            Linear Regression
          </button>

          <button
            onClick={() => toggleModel("cnn")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              visibleModels.cnn
                ? "text-white border-green-500 shadow-md"
                : ""
            }`}
            style={visibleModels.cnn ? {
              background: '#10B981',
              borderColor: '#10B981',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            } : {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            CNN
          </button>

          <button
            onClick={() => toggleModel("rnn")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              visibleModels.rnn
                ? "text-white border-purple-500 shadow-md"
                : ""
            }`}
            style={visibleModels.rnn ? {
              background: '#8B5CF6',
              borderColor: '#8B5CF6',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            } : {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            RNN
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        ref={containerRef}
        className="w-full relative cursor-crosshair select-none" 
        style={{ height: "450px", minWidth: 0 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={visibleData}
              margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid 
                strokeDasharray="0" 
                stroke="var(--border-primary)" 
                vertical={false} 
                opacity={0.3}
              />

              <XAxis
                dataKey="date"
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={false}
                dy={10}
                tickFormatter={(tick) => {
                  const d = new Date(tick);
                  const now = new Date();
                  const diff = now.getTime() - d.getTime();
                  if (Math.abs(diff) < 2 * 24 * 60 * 60 * 1000) {
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  }
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
                minTickGap={30}
              />

              <YAxis
                stroke="var(--text-tertiary)"
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={false}
                dx={-10}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />

              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 }}
                isAnimationActive={false}
              />

              <Legend 
                verticalAlign="bottom" 
                align="center"
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }}
              />

              {lastHistoricalData && visibleData.some(d => d.date === lastHistoricalData.date) && (
                <ReferenceLine
                  x={lastHistoricalData.date}
                  stroke="var(--border-primary)"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                >
                  <Label
                    value="FORECAST"
                    position="top"
                    fill="var(--text-tertiary)"
                    fontSize={10}
                    fontWeight="bold"
                    offset={15}
                  />
                </ReferenceLine>
              )}

              {/* Historical Actual Price */}
              {visibleModels.actual && (
                <Line
                  type="monotone"
                  dataKey="actual_h"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#2563EB' }}
                  name="Historical Price"
                  isAnimationActive={false}
                  connectNulls
                />
              )}

              {/* LR Model */}
              {visibleModels.lr && (
                <>
                  <Line
                    type="monotone"
                    dataKey="lr_h"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    name="LR Prediction (H)"
                    isAnimationActive={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="lr_p"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="LR Prediction (P)"
                    isAnimationActive={false}
                    connectNulls
                  />
                </>
              )}

              {/* CNN Model */}
              {visibleModels.cnn && (
                <>
                  <Line
                    type="monotone"
                    dataKey="cnn_h"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    name="CNN Prediction (H)"
                    isAnimationActive={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="cnn_p"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="CNN Prediction (P)"
                    isAnimationActive={false}
                    connectNulls
                  />
                </>
              )}

              {/* RNN Model */}
              {visibleModels.rnn && (
                <>
                  <Line
                    type="monotone"
                    dataKey="rnn_h"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={false}
                    name="RNN Prediction (H)"
                    isAnimationActive={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="rnn_p"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="RNN Prediction (P)"
                    isAnimationActive={false}
                    connectNulls
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-6 flex justify-center gap-6 border-t pt-6" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-600" />
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-tertiary)' }}>Historical Data</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-orange-500 border-b border-dashed" style={{ borderBottomWidth: '2px', borderColor: 'var(--bg-card)' }} />
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-tertiary)' }}>AI Forecast</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-tertiary)' }}>Scroll to Zoom \ Drag to Pan</span>
        </div>
      </div>
    </div>
  );
};

export default PredictionGraph;