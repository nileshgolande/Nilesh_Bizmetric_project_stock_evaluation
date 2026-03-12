import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = '/api';

// Fetch all stocks with pagination
export const useStocks = (page = 1, includeLive = false) => {
  return useQuery({
    queryKey: ['stocks', page, includeLive],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
      });
      if (includeLive) {
        params.append('include_live', 'true');
      }
      const res = await axios.get(`${API_BASE}/stocks/?${params}`);
      return res.data;
    },
    staleTime: includeLive ? 30000 : 300000, // 30s for live data, 5min for cached
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: includeLive, // Only refetch on focus if live data
  });
};

// Search stocks
export const useStockSearch = (query, enabled = true) => {
  return useQuery({
    queryKey: ['stockSearch', query],
    queryFn: async () => {
      if (!query?.trim()) return [];
      const res = await axios.get(`${API_BASE}/stocks/search/`, {
        params: { q: query },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: enabled && !!query?.trim(),
    staleTime: 120000, // 2 minutes
    gcTime: 300000, // 5 minutes
  });
};

// Fetch stock analytics
export const useStockAnalytics = (symbol, enabled = true) => {
  return useQuery({
    queryKey: ['stockAnalytics', symbol],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const config = token ? { headers: { Authorization: `Token ${token}` } } : undefined;
      const res = await axios.get(`${API_BASE}/eda/analyze/${symbol}/`, config);
      return res.data;
    },
    enabled: enabled && !!symbol,
    staleTime: 600000, // 10 minutes (cached on backend)
    gcTime: 1800000, // 30 minutes
  });
};

// Fetch market ticker
export const useMarketTicker = () => {
  return useQuery({
    queryKey: ['marketTicker'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/market/ticker/`);
      return res.data;
    },
    staleTime: 45000, // 45 seconds
    refetchInterval: 45000, // Auto-refetch every 45 seconds
    refetchOnWindowFocus: true,
  });
};
