import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
import torch
import torch.nn as nn
import torch.optim as optim

ASSETS = {
    'Gold': 'GC=F',
    'Silver': 'SI=F',
    'BTC': 'BTC-USD'
}

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

def predict_model(model, X):
    model.eval()
    with torch.no_grad():
        X_tensor = torch.tensor(X, dtype=torch.float32)
        outputs = model(X_tensor)
    return outputs.numpy()

def get_predictions(asset_type):
    print(f"Starting prediction for {asset_type}")
    ticker = ASSETS.get(asset_type)
    if not ticker:
        return None, "Invalid asset type"

    try:
        import yfinance as yf
        yf.set_tz_cache_location('c:/Users/pradi/Downloads/NILESH/stocknew/stock_evaluation/yf_cache')
        ticker_obj = yf.Ticker(ticker)
        df = ticker_obj.history(period="1mo", interval="1h")
    except Exception as e:
        return None, f"Error fetching data: {str(e)}"

    if df.empty:
        df = ticker_obj.history(period="1y")
        if df.empty: return None, "No data found"
    
    df = df.reset_index()
    if 'Close' in df.columns: prices = df['Close']
    else:
        if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
        prices = df['Close'] if 'Close' in df.columns else None
    
    if prices is None: return None, "Close price data missing"

    dates = df['Datetime'] if 'Datetime' in df.columns else (df['Date'] if 'Date' in df.columns else df.index)
    dates_str = pd.to_datetime(dates).dt.strftime('%Y-%m-%dT%H:%M:%S').values
    prices = prices.values.flatten().astype(float)

    # LR
    X_lr = np.arange(len(prices)).reshape(-1, 1)
    lr_model = LinearRegression().fit(X_lr, prices)
    lr_preds = lr_model.predict(X_lr)
    
    future_steps = list(range(1, 49))
    last_idx = len(prices) - 1
    future_lr_preds = lr_model.predict(np.array([last_idx + s for s in future_steps]).reshape(-1, 1))

    # DL Prep
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_prices = scaler.fit_transform(prices.reshape(-1, 1))
    seq_length = 60
    if len(scaled_prices) <= seq_length:
        seq_length = min(10, len(scaled_prices) - 1)
        if seq_length < 2: return None, "Not enough data"

    X_dl, y_dl = [], []
    for i in range(len(scaled_prices) - seq_length):
        X_dl.append(scaled_prices[i:i+seq_length])
        y_dl.append(scaled_prices[i+seq_length])
    X_dl, y_dl = np.array(X_dl), np.array(y_dl)

    # Train
    lstm_model = train_model(LSTMModel(), X_dl, y_dl, epochs=30)
    cnn_model = train_model(CNNModel(seq_length=seq_length), X_dl, y_dl, epochs=30)
    
    lstm_preds = scaler.inverse_transform(predict_model(lstm_model, X_dl)).flatten()
    cnn_preds = scaler.inverse_transform(predict_model(cnn_model, X_dl)).flatten()

    def predict_future(model, last_sequence, steps, scaler, seq_length):
        model.eval()
        predictions = []
        curr_seq = last_sequence.copy()
        with torch.no_grad():
            for _ in range(max(steps)):
                X_tensor = torch.tensor(curr_seq.reshape(1, seq_length, 1), dtype=torch.float32)
                pred = model(X_tensor).numpy()[0]
                # Analytical noise to simulate realistic variance
                noise = np.random.normal(0, 0.002) 
                pred = pred + noise
                predictions.append(pred)
                curr_seq = np.append(curr_seq[1:], pred).reshape(seq_length, 1)
        preds_scaled = np.array([predictions[s-1] for s in steps]).reshape(-1, 1)
        return scaler.inverse_transform(preds_scaled).flatten()

    last_seq = scaled_prices[-seq_length:]
    future_rnn_preds = predict_future(lstm_model, last_seq, future_steps, scaler, seq_length)
    future_cnn_preds = predict_future(cnn_model, last_seq, future_steps, scaler, seq_length)

    results = []
    for i in range(len(dates_str)):
        res = {'date': dates_str[i], 'actual_price': float(prices[i]), 'lr_prediction': float(lr_preds[i]), 'rnn_prediction': None, 'cnn_prediction': None, 'is_future': False}
        dl_idx = i - seq_length
        if dl_idx >= 0 and dl_idx < len(lstm_preds):
            res['rnn_prediction'] = float(lstm_preds[dl_idx])
            res['cnn_prediction'] = float(cnn_preds[dl_idx])
        results.append(res)

    last_date = pd.to_datetime(dates.iloc[-1] if hasattr(dates, 'iloc') else dates[-1])
    for i, step in enumerate(future_steps):
        label = None
        if step == 1: label = "Next 1 Hour"
        elif step == 7: label = "Next 7 Hours"
        elif step == 24: label = "Next 1 Day"
        elif step == 48: label = "Next 2 Days"
        results.append({
            'date': (last_date + pd.Timedelta(hours=step)).strftime('%Y-%m-%dT%H:%M:%S'),
            'label': label, 'actual_price': None,
            'lr_prediction': float(future_lr_preds[i]),
            'rnn_prediction': float(future_rnn_preds[i]),
            'cnn_prediction': float(future_cnn_preds[i]),
            'is_future': True
        })
    return results, None
