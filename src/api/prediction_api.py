from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from ..data.data_loader import DataLoader
from ..models.logistic_model import LogisticModel
from ..models.cnn_model import CNNModel
from ..models.rnn_model import RNNModel
import numpy as np

@csrf_exempt
def predict_ticker(request, ticker):
    if request.method != 'GET':
        return JsonResponse({'error': 'GET request required'}, status=405)

    ticker = ticker.upper()
    cache_key = f"prediction_{ticker}"
    cached_response = cache.get(cache_key)
    
    if cached_response:
        return JsonResponse(cached_response)

    # Initialize data loader
    loader = DataLoader(ticker)
    
    # Fetch data
    df = loader.fetch_data()
    if df is None:
        return JsonResponse({'error': f'Failed to fetch data for {ticker}'}, status=404)

    # 1. Logistic Regression (Direction)
    (X_train_c, y_train_c), (X_test_c, y_test_c) = loader.prepare_data(for_classification=True)
    log_model = LogisticModel()
    log_model.train(X_train_c, y_train_c, X_test_c, y_test_c)
    
    # 2. CNN (Price)
    (X_train_r, y_train_r), (X_test_r, y_test_r) = loader.prepare_data(for_classification=False)
    cnn_model = CNNModel()
    cnn_model.train(X_train_r, y_train_r, X_test_r, y_test_r)
    
    # 3. RNN (Price)
    rnn_model = RNNModel()
    rnn_model.train(X_train_r, y_train_r, X_test_r, y_test_r)

    # Get latest window for predictions
    latest_window = loader.get_latest_window()
    if latest_window is None:
        return JsonResponse({'error': 'Not enough data for predictions'}, status=400)

    # Make predictions
    logistic_signal = log_model.predict(latest_window)
    cnn_pred_scaled = cnn_model.predict(latest_window)
    rnn_pred_scaled = rnn_model.predict(latest_window)
    
    # Inverse transform prices
    cnn_next_2_days = [float(round(p, 2)) for p in loader.inverse_transform(cnn_pred_scaled)]
    rnn_next_2_days = [float(round(p, 2)) for p in loader.inverse_transform(rnn_pred_scaled)]

    response_data = {
        "ticker": ticker,
        "logistic_signal": logistic_signal,
        "cnn_next_2_days": cnn_next_2_days,
        "rnn_next_2_days": rnn_next_2_days,
        "metrics": {
            "logistic_accuracy": float(round(log_model.accuracy, 4)),
            "cnn_rmse": float(round(cnn_model.rmse, 4)),
            "rnn_rmse": float(round(rnn_model.rmse, 4))
        }
    }

    # Cache for 1 hour (3600 seconds)
    cache.set(cache_key, response_data, 3600)

    return JsonResponse(response_data)
