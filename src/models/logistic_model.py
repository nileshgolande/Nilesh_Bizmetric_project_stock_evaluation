from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import numpy as np

class LogisticModel:
    def __init__(self):
        self.model = LogisticRegression(random_state=42)
        self.accuracy = 0.0

    def train(self, X_train, y_train, X_test, y_test):
        # Flatten X for logistic regression
        X_train_flat = X_train.reshape(X_train.shape[0], -1)
        X_test_flat = X_test.reshape(X_test.shape[0], -1)
        
        self.model.fit(X_train_flat, y_train)
        y_pred = self.model.predict(X_test_flat)
        self.accuracy = accuracy_score(y_test, y_pred)
        
        return self.accuracy

    def predict(self, latest_window):
        # Flatten latest window
        latest_window_flat = latest_window.reshape(1, -1)
        prediction = self.model.predict(latest_window_flat)[0]
        
        return "UP" if prediction == 1 else "DOWN"
