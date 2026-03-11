import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import os

class DataLoader:
    def __init__(self, ticker, period="3y", lookback=60):
        self.ticker = ticker
        self.period = period
        self.lookback = lookback
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.data = None

    def fetch_data(self):
        try:
            # Explicitly disable caching to avoid SQLite locking issues if needed
            yf_cache_path = os.path.join(os.getcwd(), 'stock_evaluation', 'yf_cache')
            if os.path.exists(yf_cache_path):
                yf.set_tz_cache_location(yf_cache_path)
            
            ticker_obj = yf.Ticker(self.ticker)
            df = ticker_obj.history(period=self.period, interval="1d")
            
            if df.empty:
                return None
            
            # Use 'Close' price
            self.data = df[['Close']].copy()
            
            # Handle missing values
            self.data = self.data.ffill().bfill()
            
            return self.data
        except Exception as e:
            print(f"Error fetching data for {self.ticker}: {e}")
            return None

    def prepare_data(self, for_classification=False):
        if self.data is None:
            if self.fetch_data() is None:
                return None, None

        prices = self.data['Close'].values.reshape(-1, 1)
        scaled_prices = self.scaler.fit_transform(prices)

        X, y = [], []
        
        if for_classification:
            # Label: next day close > current close -> 1, else 0
            for i in range(self.lookback, len(scaled_prices) - 1):
                X.append(scaled_prices[i-self.lookback:i, 0])
                y.append(1 if prices[i+1] > prices[i] else 0)
        else:
            # Predict next 2 days
            for i in range(self.lookback, len(scaled_prices) - 2):
                X.append(scaled_prices[i-self.lookback:i, 0])
                y.append(scaled_prices[i:i+2, 0])

        X, y = np.array(X), np.array(y)
        
        # Split 80% train, 20% test
        split = int(0.8 * len(X))
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]
        
        return (X_train, y_train), (X_test, y_test)

    def get_latest_window(self):
        if self.data is None:
            if self.fetch_data() is None:
                return None
        
        prices = self.data['Close'].values.reshape(-1, 1)
        scaled_prices = self.scaler.transform(prices)
        
        if len(scaled_prices) < self.lookback:
            return None
            
        return scaled_prices[-self.lookback:].reshape(1, self.lookback, 1)

    def inverse_transform(self, scaled_prices):
        # Handle 2-day predictions
        if len(scaled_prices.shape) == 1:
            scaled_prices = scaled_prices.reshape(-1, 1)
        return self.scaler.inverse_transform(scaled_prices).flatten()
