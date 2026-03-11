"""
Stock prediction service for generating 7-day forecasts for individual stocks.
"""
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
import torch
import torch.nn as nn
import torch.optim as optim
from django.core.cache import cache

# Reuse models from services.py
class LSTMModel(nn.Module):
    def __init__(self):
        super(LSTMModel, self).__init__()
        self.lstm = nn.LSTM(input_size=1, hidden_size=64, num_layers=2, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(64, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])
        return out

class CNNModel(nn.Module):
    def __init__(self, seq_length=60):
        super(CNNModel, self).__init__()
        self.conv1 = nn.Conv1d(in_channels=1, out_channels=64, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(in_channels=64, out_channels=32, kernel_size=3, padding=1)
        self.relu = nn.ReLU()
        self.pool = nn.MaxPool1d(kernel_size=2)
        self.flatten = nn.Flatten()
        self.fc1 = nn.Linear(32 * (seq_length // 2), 50)
        self.fc2 = nn.Linear(50, 1)

    def forward(self, x):
        x = x.permute(0, 2, 1)
        x = self.relu(self.conv1(x))
        x = self.pool(self.relu(self.conv2(x)))
        x = self.flatten(x)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x

def train_model(model, X_train, y_train, epochs=25, batch_size=32):
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    X_tensor = torch.tensor(X_train, dtype=torch.float32)
    y_tensor = torch.tensor(y_train, dtype=torch.float32).view(-1, 1)
    
    dataset = torch.utils.data.TensorDataset(X_tensor, y_tensor)
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    model.train()
    for epoch in range(epochs):
        for batch_X, batch_y in dataloader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
    
    return model

def predict_future(model, last_sequence, steps, scaler, seq_length):
    model.eval()
    predictions = []
    curr_seq = last_sequence.copy()
    with torch.no_grad():
        for _ in range(max(steps)):
            X_tensor = torch.tensor(curr_seq.reshape(1, seq_length, 1), dtype=torch.float32)
            pred = model(X_tensor).numpy()[0]
            noise = np.random.normal(0, 0.002)
            pred = pred + noise
            predictions.append(pred)
            curr_seq = np.append(curr_seq[1:], pred).reshape(seq_length, 1)
    preds_scaled = np.array([predictions[s-1] for s in steps]).reshape(-1, 1)
    return scaler.inverse_transform(preds_scaled).flatten()

def get_stock_predictions(symbol, days=7):
    """
    Generate predictions for a stock symbol for the next N days.
    Returns predictions with historical data and future forecasts.
    """
    cache_key = f"stock_predictions:{symbol.upper()}:{days}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, None
    
    try:
        ticker_obj = yf.Ticker(symbol)
        # Fetch 1 year of daily data
        df = ticker_obj.history(period="1y", interval="1d")
        
        if df.empty:
            return None, "No data available for this symbol"
        
        # Use Close prices
        prices = df['Close'].values
        dates = df.index
        
        if len(prices) < 60:
            return None, "Insufficient historical data (need at least 60 days)"
        
        # Prepare data
        seq_length = 60
        scaler = MinMaxScaler()
        scaled_prices = scaler.fit_transform(prices.reshape(-1, 1)).flatten()
        
        # Create sequences
        X, y = [], []
        for i in range(seq_length, len(scaled_prices)):
            X.append(scaled_prices[i-seq_length:i])
            y.append(scaled_prices[i])
        
        X = np.array(X).reshape(-1, seq_length, 1)
        y = np.array(y)
        
        # Split data (80% train, 20% test)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Linear Regression baseline
        lr_model = LinearRegression()
        X_lr = X_train.reshape(X_train.shape[0], -1)
        lr_model.fit(X_lr, y_train)
        lr_preds_train = lr_model.predict(X_lr)
        lr_preds_test = lr_model.predict(X_test.reshape(X_test.shape[0], -1))
        lr_preds = np.concatenate([lr_preds_train, lr_preds_test])
        
        # Train LSTM
        lstm_model = LSTMModel()
        lstm_model = train_model(lstm_model, X_train, y_train, epochs=20, batch_size=32)
        lstm_preds = predict_model(lstm_model, X)
        
        # Train CNN
        cnn_model = CNNModel(seq_length=seq_length)
        cnn_model = train_model(cnn_model, X_train, y_train, epochs=20, batch_size=32)
        cnn_preds = predict_model(cnn_model, X)
        
        # Scale predictions back
        lr_preds_scaled = scaler.inverse_transform(lr_preds.reshape(-1, 1)).flatten()
        lstm_preds_scaled = scaler.inverse_transform(lstm_preds.reshape(-1, 1)).flatten()
        cnn_preds_scaled = scaler.inverse_transform(cnn_preds.reshape(-1, 1)).flatten()
        
        # Future predictions (next 7 days)
        future_steps = list(range(1, days + 1))
        last_seq = scaled_prices[-seq_length:]
        
        future_lr_preds = []
        for step in future_steps:
            # Simple linear extrapolation for LR
            X_future = np.arange(len(prices), len(prices) + step).reshape(-1, 1)
            future_lr = lr_model.predict(X_future.reshape(1, -1))[0]
            future_lr_preds.append(future_lr)
        future_lr_preds = scaler.inverse_transform(np.array(future_lr_preds).reshape(-1, 1)).flatten()
        
        future_lstm_preds = predict_future(lstm_model, last_seq, future_steps, scaler, seq_length)
        future_cnn_preds = predict_future(cnn_model, last_seq, future_steps, scaler, seq_length)
        
        # Build results
        results = []
        dates_str = [d.strftime('%Y-%m-%d') for d in dates]
        
        # Historical data
        for i in range(seq_length, len(prices)):
            idx = i - seq_length
            results.append({
                'date': dates_str[i],
                'actual_price': float(prices[i]),
                'lr_prediction': float(lr_preds_scaled[idx]),
                'rnn_prediction': float(lstm_preds_scaled[idx]) if idx < len(lstm_preds_scaled) else None,
                'cnn_prediction': float(cnn_preds_scaled[idx]) if idx < len(cnn_preds_scaled) else None,
                'is_future': False
            })
        
        # Future predictions
        last_date = dates[-1]
        for i, step in enumerate(future_steps):
            future_date = last_date + pd.Timedelta(days=step)
            results.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'label': f"Day +{step}",
                'actual_price': None,
                'lr_prediction': float(future_lr_preds[i]),
                'rnn_prediction': float(future_lstm_preds[i]),
                'cnn_prediction': float(future_cnn_preds[i]),
                'is_future': True
            })
        
        # Cache for 1 hour
        cache.set(cache_key, results, 3600)
        return results, None
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, str(e)

def predict_model(model, X):
    model.eval()
    with torch.no_grad():
        X_tensor = torch.tensor(X, dtype=torch.float32)
        outputs = model(X_tensor)
    return outputs.numpy()
