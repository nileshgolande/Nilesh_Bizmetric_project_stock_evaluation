import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from sklearn.metrics import mean_squared_error

class LSTM(nn.Module):
    def __init__(self, input_size=1, hidden_size=50, num_layers=2, output_size=2, dropout=0.2):
        super(LSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # LSTM Layer
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        
        # Dropout
        self.dropout = nn.Dropout(dropout)
        
        # Fully Connected Layer
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        # Initial hidden state and cell state
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        # Forward pass
        out, _ = self.lstm(x, (h0, c0))
        
        # Take the output from the last time step
        out = out[:, -1, :]
        
        # Dropout
        out = self.dropout(out)
        
        # Final output
        out = self.fc(out)
        return out

class RNNModel:
    def __init__(self, lookback=60, horizon=2):
        self.lookback = lookback
        self.horizon = horizon
        self.model = LSTM(output_size=horizon)
        self.mse = 0.0
        self.rmse = 0.0

    def train(self, X_train, y_train, X_test, y_test, epochs=10, batch_size=32):
        criterion = nn.MSELoss()
        optimizer = optim.Adam(self.model.parameters(), lr=0.001)
        
        # Convert to tensors
        # X shape: (batch, lookback, 1)
        X_train_tensor = torch.tensor(X_train, dtype=torch.float32).unsqueeze(-1)
        y_train_tensor = torch.tensor(y_train, dtype=torch.float32)
        
        X_test_tensor = torch.tensor(X_test, dtype=torch.float32).unsqueeze(-1)
        y_test_tensor = torch.tensor(y_test, dtype=torch.float32)
        
        # Simple training loop
        self.model.train()
        for epoch in range(epochs):
            for i in range(0, len(X_train_tensor), batch_size):
                batch_X = X_train_tensor[i:i+batch_size]
                batch_y = y_train_tensor[i:i+batch_size]
                
                optimizer.zero_grad()
                outputs = self.model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
        
        # Evaluation
        self.model.eval()
        with torch.no_grad():
            y_pred = self.model(X_test_tensor).numpy()
            self.mse = mean_squared_error(y_test, y_pred)
            self.rmse = np.sqrt(self.mse)
            
        return self.mse, self.rmse

    def predict(self, latest_window):
        # latest_window shape: (1, lookback, 1)
        latest_window_tensor = torch.tensor(latest_window, dtype=torch.float32)
        self.model.eval()
        with torch.no_grad():
            prediction = self.model(latest_window_tensor).numpy()[0]
            
        return prediction
