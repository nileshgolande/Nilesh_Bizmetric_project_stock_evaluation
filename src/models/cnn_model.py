import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from sklearn.metrics import mean_squared_error

class CNN(nn.Module):
    def __init__(self, lookback=60, horizon=2):
        super(CNN, self).__init__()
        # Conv1d expects (batch, channels, seq_len)
        self.conv1 = nn.Conv1d(in_channels=1, out_channels=64, kernel_size=2)
        self.relu = nn.ReLU()
        self.pool = nn.MaxPool1d(kernel_size=2)
        self.flatten = nn.Flatten()
        
        # Calculate flattened size
        # Input seq_len = 60
        # After conv1 (kernel=2): 60 - 2 + 1 = 59
        # After pool (kernel=2): floor(59/2) = 29
        # Output channels = 64
        # Flattened = 64 * 29 = 1856
        self.fc1 = nn.Linear(64 * 29, 50)
        self.fc2 = nn.Linear(50, horizon)

    def forward(self, x):
        # x shape: (batch, seq_len, features) -> need (batch, channels, seq_len)
        x = x.permute(0, 2, 1) 
        x = self.conv1(x)
        x = self.relu(x)
        x = self.pool(x)
        x = self.flatten(x)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x

class CNNModel:
    def __init__(self, lookback=60, horizon=2):
        self.lookback = lookback
        self.horizon = horizon
        self.model = CNN(lookback, horizon)
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
