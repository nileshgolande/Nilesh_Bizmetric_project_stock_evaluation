import math
import os
from datetime import timedelta

import numpy as np
import pandas as pd
import yfinance as yf
from django.core.cache import cache

from src.data.data_loader import DataLoader
from src.models.logistic_model import LogisticModel
from src.models.cnn_model import CNNModel
from src.models.rnn_model import RNNModel

BASE_SIGNAL_CACHE_TTL_SECONDS = 60 * 60
RECOMMENDATION_SIGNAL_VERSION = 'v1'
POSITIVE_CLUSTERS = {'Safe Haven', 'Aggressive Growth'}


def _safe_float(value):
    try:
        if value is None:
            return None
        numeric = float(value)
        if math.isnan(numeric) or math.isinf(numeric):
            return None
        return numeric
    except (TypeError, ValueError):
        return None

def _get_advanced_predictions(symbol, df=None):
    """
    Calculates advanced predictions using Logistic, CNN, and RNN models.
    Tries to reuse the cache from the prediction API first.
    If df is provided, it skips redundant data fetching.
    """
    normalized_symbol = symbol.upper()
    api_cache_key = f"prediction_{normalized_symbol}"
    cached_api_res = cache.get(api_cache_key)
    
    if cached_api_res:
        return {
            'logistic_signal': cached_api_res.get('logistic_signal'),
            'cnn_next_2_days': cached_api_res.get('cnn_next_2_days'),
            'rnn_next_2_days': cached_api_res.get('rnn_next_2_days'),
            'logistic_accuracy': cached_api_res.get('metrics', {}).get('logistic_accuracy'),
            'cnn_rmse': cached_api_res.get('metrics', {}).get('cnn_rmse'),
            'rnn_rmse': cached_api_res.get('metrics', {}).get('rnn_rmse')
        }

    # Fallback to calculation if not in API cache, but with LOWER EPOCHS for portfolio speed
    try:
        loader = DataLoader(symbol, period="1y")
        if df is not None:
            loader.data = df[['Close']].ffill().bfill()
        else:
            df = loader.fetch_data()
            
        if df is None:
            return {}

        # 1. Logistic Regression
        (X_train_c, y_train_c), (X_test_c, y_test_c) = loader.prepare_data(for_classification=True)
        log_model = LogisticModel()
        log_model.train(X_train_c, y_train_c, X_test_c, y_test_c) # Default is 10 epochs
        
        # 2. CNN and RNN (Regression) - Use minimal epochs for portfolio view
        (X_train_r, y_train_r), (X_test_r, y_test_r) = loader.prepare_data(for_classification=False)
        
        cnn_model = CNNModel()
        cnn_model.train(X_train_r, y_train_r, X_test_r, y_test_r, epochs=2) # Reduced from default
        
        rnn_model = RNNModel()
        rnn_model.train(X_train_r, y_train_r, X_test_r, y_test_r, epochs=2) # Reduced from default

        latest_window = loader.get_latest_window()
        if latest_window is None:
            return {}

        logistic_signal = log_model.predict(latest_window)
        cnn_pred_scaled = cnn_model.predict(latest_window)
        rnn_pred_scaled = rnn_model.predict(latest_window)
        
        cnn_next_2_days = [float(round(p, 2)) for p in loader.inverse_transform(cnn_pred_scaled)]
        rnn_next_2_days = [float(round(p, 2)) for p in loader.inverse_transform(rnn_pred_scaled)]

        res = {
            'logistic_signal': logistic_signal,
            'cnn_next_2_days': cnn_next_2_days,
            'rnn_next_2_days': rnn_next_2_days,
            'logistic_accuracy': float(round(log_model.accuracy, 4)),
            'cnn_rmse': float(round(cnn_model.rmse, 4)),
            'rnn_rmse': float(round(rnn_model.rmse, 4))
        }
        
        # Also update the API cache for this symbol to help other parts of the app
        cache.set(api_cache_key, {
            "ticker": normalized_symbol,
            "logistic_signal": logistic_signal,
            "cnn_next_2_days": cnn_next_2_days,
            "rnn_next_2_days": rnn_next_2_days,
            "metrics": {
                "logistic_accuracy": res['logistic_accuracy'],
                "cnn_rmse": res['cnn_rmse'],
                "rnn_rmse": res['rnn_rmse']
            }
        }, 3600)
        
        return res
    except Exception as e:
        print(f"Error in _get_advanced_predictions for {symbol}: {e}")
        return {}


def _fetch_price_history(symbol, period='1y'):
    ticker_symbol = (symbol or '').strip().upper()
    if not ticker_symbol:
        return pd.DataFrame()

    try:
        # Use a faster source if possible, but yfinance is already used
        history = yf.Ticker(ticker_symbol).history(period=period, interval='1d')
    except Exception:
        return pd.DataFrame()

    if history is None or history.empty:
        return pd.DataFrame()

    required_cols = [col for col in ('Close', 'Volume') if col in history.columns]
    if not required_cols:
        return pd.DataFrame()

    frame = history[required_cols].copy()
    frame = frame.dropna(subset=['Close'])
    return frame


def _compute_return_and_volatility(close_series):
    if close_series is None or len(close_series) < 2:
        return None, None

    daily_returns = close_series.pct_change().dropna()
    if daily_returns.empty:
        return None, None

    annualized_return = ((1 + daily_returns.mean()) ** 252 - 1) * 100
    volatility = daily_returns.std() * np.sqrt(252) * 100

    return _safe_float(round(annualized_return, 2)), _safe_float(round(volatility, 2))


def _compute_rsi(close_series, period=14):
    if close_series is None or len(close_series) <= period:
        return None

    delta = close_series.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.rolling(window=period, min_periods=period).mean()
    avg_loss = losses.rolling(window=period, min_periods=period).mean()

    if avg_gain.empty or avg_loss.empty:
        return None

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    latest = rsi.iloc[-1]
    if pd.isna(latest):
        return None
    return round(float(latest), 2)


def _future_trading_dates(last_date, horizon=7):
    if horizon <= 0:
        return []

    if hasattr(last_date, 'to_pydatetime'):
        current = last_date.to_pydatetime()
    else:
        current = pd.Timestamp(last_date).to_pydatetime()

    dates = []
    while len(dates) < horizon:
        current = current + timedelta(days=1)
        if current.weekday() < 5:
            dates.append(current.strftime('%Y-%m-%d'))
    return dates


def _linear_regression_forecast(close_values, horizon=2):
    """
    Uses Scikit-Learn Linear Regression to predict the next `horizon` days
    based on the full history provided (typically 3 years).
    """
    if close_values is None or len(close_values) < 2:
        return [None] * horizon

    try:
        from sklearn.linear_model import LinearRegression
        
        # X is just the time index (0, 1, 2, ... N-1)
        X = np.arange(len(close_values)).reshape(-1, 1)
        y = np.array(close_values, dtype=float)
        
        model = LinearRegression()
        model.fit(X, y)
        
        # Predict for the next `horizon` steps: N, N+1, ...
        last_idx = len(close_values)
        next_indices = np.arange(last_idx, last_idx + horizon).reshape(-1, 1)
        predictions = model.predict(next_indices)
        
        return [float(p) for p in predictions]
    except Exception:
        return [None] * horizon

def _fallback_forecast(close_values, horizon=7):
    if close_values is None or len(close_values) == 0:
        return []

    close_values = np.array(close_values, dtype=float)
    if close_values.size < 2:
        return [float(close_values[-1])] * horizon

    recent_returns = np.diff(close_values) / close_values[:-1]
    if recent_returns.size == 0:
        drift = 0.0
    else:
        drift = float(np.mean(recent_returns[-20:]))
    drift = float(np.clip(drift, -0.05, 0.05))

    forecast = []
    next_price = float(close_values[-1])
    for _ in range(horizon):
        next_price = next_price * (1 + drift)
        forecast.append(max(next_price, 0.0))
    return forecast


def _lstm_forecast(close_values, lookback=60, horizon=7):
    """
    Attempts TensorFlow/Keras LSTM forecasting.
    Falls back to drift-based forecast if dependencies are unavailable.
    """
    if close_values is None or len(close_values) < (lookback + 20):
        return _fallback_forecast(close_values, horizon), False

    try:
        os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
        from sklearn.preprocessing import MinMaxScaler
        import tensorflow as tf
        from tensorflow.keras import Sequential
        from tensorflow.keras.layers import Dense, Dropout, LSTM
    except Exception:
        return _fallback_forecast(close_values, horizon), False

    try:
        tf.get_logger().setLevel('ERROR')
        np.random.seed(42)
        tf.random.set_seed(42)

        close_array = np.array(close_values, dtype=float).reshape(-1, 1)
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled = scaler.fit_transform(close_array)

        x_data = []
        y_data = []
        for idx in range(lookback, len(scaled)):
            x_data.append(scaled[idx - lookback:idx, 0])
            y_data.append(scaled[idx, 0])

        if len(x_data) < 20:
            return _fallback_forecast(close_values, horizon), False

        x_train = np.array(x_data, dtype=float).reshape(-1, lookback, 1)
        y_train = np.array(y_data, dtype=float)

        model = Sequential([
            LSTM(32, return_sequences=True, input_shape=(lookback, 1)), # Reduced units
            Dropout(0.1),
            LSTM(16), # Reduced units
            Dense(1),
        ])
        model.compile(optimizer='adam', loss='mean_squared_error')
        model.fit(x_train, y_train, epochs=2, batch_size=32, verbose=0) # Reduced from 8 epochs and increased batch size

        rolling_window = scaled[-lookback:, 0].copy()
        predicted_scaled = []
        for _ in range(horizon):
            batch = rolling_window.reshape(1, lookback, 1)
            next_scaled = float(model.predict(batch, verbose=0)[0][0])
            predicted_scaled.append(next_scaled)
            rolling_window = np.append(rolling_window[1:], next_scaled)

        forecast = scaler.inverse_transform(np.array(predicted_scaled).reshape(-1, 1)).flatten()
        return [max(float(value), 0.0) for value in forecast], True
    except Exception:
        return _fallback_forecast(close_values, horizon), False


def _heuristic_cluster_label(annualized_return, volatility):
    if annualized_return is None or volatility is None:
        return 'Underperformers'
    if annualized_return < 0:
        return 'Underperformers'
    if volatility <= 22:
        return 'Safe Haven'
    return 'Aggressive Growth'


def _assign_cluster_labels(symbol_metrics):
    valid_items = [
        (symbol, metrics.get('annualized_return'), metrics.get('volatility'))
        for symbol, metrics in symbol_metrics.items()
        if metrics.get('annualized_return') is not None and metrics.get('volatility') is not None
    ]

    if len(valid_items) < 3:
        return {
            symbol: _heuristic_cluster_label(annualized_return, volatility)
            for symbol, annualized_return, volatility in valid_items
        }

    try:
        from sklearn.cluster import KMeans
    except Exception:
        return {
            symbol: _heuristic_cluster_label(annualized_return, volatility)
            for symbol, annualized_return, volatility in valid_items
        }

    symbols = [item[0] for item in valid_items]
    vectors = np.array([[item[1], item[2]] for item in valid_items], dtype=float)

    try:
        model = KMeans(n_clusters=3, random_state=42, n_init=10)
        cluster_indices = model.fit_predict(vectors)
        centroids = model.cluster_centers_
    except Exception:
        return {
            symbol: _heuristic_cluster_label(annualized_return, volatility)
            for symbol, annualized_return, volatility in valid_items
        }

    underperformer_cluster = int(np.argmin(centroids[:, 0]))
    remaining = [idx for idx in range(3) if idx != underperformer_cluster]
    safe_haven_cluster = remaining[int(np.argmin(centroids[remaining, 1]))]
    aggressive_cluster = [idx for idx in remaining if idx != safe_haven_cluster][0]

    index_to_label = {
        underperformer_cluster: 'Underperformers',
        safe_haven_cluster: 'Safe Haven',
        aggressive_cluster: 'Aggressive Growth',
    }

    return {
        symbol: index_to_label.get(int(cluster_indices[idx]), 'Underperformers')
        for idx, symbol in enumerate(symbols)
    }


def _derive_recommendation(metrics):
    current_price = metrics.get('current_price')
    predicted_price = metrics.get('predicted_price_7d')
    rsi_14 = metrics.get('rsi_14')
    cluster_label = metrics.get('cluster_label') or 'Underperformers'

    predicted_positive = (
        current_price is not None
        and current_price > 0
        and predicted_price is not None
        and predicted_price > (current_price * 1.05)
    )
    oversold = rsi_14 is not None and rsi_14 < 40
    cluster_positive = cluster_label in POSITIVE_CLUSTERS

    if predicted_positive and oversold and cluster_positive:
        return 'Buy', True

    bearish_prediction = (
        current_price is not None
        and current_price > 0
        and predicted_price is not None
        and predicted_price < (current_price * 0.97)
    )
    overbought = rsi_14 is not None and rsi_14 > 70

    if cluster_label == 'Underperformers' or bearish_prediction or overbought:
        return 'Sell', False

    return 'Hold', False


def _build_base_signal_for_symbol(symbol):
    history = _fetch_price_history(symbol)
    if history.empty:
        return {
            'annualized_return': None,
            'volatility': None,
            'predicted_price_7d': None,
            'forecast_line_7d': [],
            'lr_forecast_2d': [None, None],
            'rsi_14': None,
            'prediction_model': 'fallback',
        }

    close_series = history['Close'].astype(float)
    close_values = close_series.to_numpy(dtype=float)
    annualized_return, volatility = _compute_return_and_volatility(close_series)
    rsi_14 = _compute_rsi(close_series)

    forecast_values, used_lstm = _lstm_forecast(close_values, lookback=60, horizon=7)
    forecast_values = [round(float(value), 2) for value in forecast_values]
    forecast_dates = _future_trading_dates(history.index[-1], horizon=len(forecast_values))
    forecast_line = [
        {'date': date, 'close': value}
        for date, value in zip(forecast_dates, forecast_values)
    ]
    
    # Calculate Linear Regression for next 2 days
    lr_forecast = _linear_regression_forecast(close_values, horizon=2)

    # Calculate Advanced Predictions (Logistic, CNN, RNN)
    advanced_preds = _get_advanced_predictions(symbol, df=history)

    current_price = _safe_float(close_values[-1])
    if current_price is not None:
        current_price = round(current_price, 2)

    predicted_price = forecast_values[-1] if forecast_values else None

    return {
        'annualized_return': annualized_return,
        'volatility': volatility,
        'current_price': current_price,
        'predicted_price_7d': predicted_price,
        'forecast_line_7d': forecast_line,
        'lr_forecast_2d': lr_forecast,
        'rsi_14': rsi_14,
        'prediction_model': 'lstm' if used_lstm else 'fallback',
        'logistic_signal': advanced_preds.get('logistic_signal'),
        'cnn_next_2_days': advanced_preds.get('cnn_next_2_days'),
        'rnn_next_2_days': advanced_preds.get('rnn_next_2_days'),
        'logistic_accuracy': advanced_preds.get('logistic_accuracy'),
        'cnn_rmse': advanced_preds.get('cnn_rmse'),
        'rnn_rmse': advanced_preds.get('rnn_rmse'),
    }


def _base_signal_cache_key(symbol):
    normalized = (symbol or '').strip().upper()
    return f'portfolio_signal:{RECOMMENDATION_SIGNAL_VERSION}:{normalized}'


def get_base_signal_for_symbol(symbol):
    normalized = (symbol or '').strip().upper()
    if not normalized:
        return {
            'annualized_return': None,
            'volatility': None,
            'predicted_price_7d': None,
            'forecast_line_7d': [],
            'lr_forecast_2d': [None, None],
            'rsi_14': None,
            'prediction_model': 'fallback',
        }

    cache_key = _base_signal_cache_key(normalized)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    signal = _build_base_signal_for_symbol(normalized)
    cache.set(cache_key, signal, BASE_SIGNAL_CACHE_TTL_SECONDS)
    return signal


def build_portfolio_recommendation_map(symbols):
    normalized_symbols = []
    seen = set()
    for symbol in symbols or []:
        normalized = (symbol or '').strip().upper()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        normalized_symbols.append(normalized)

    if not normalized_symbols:
        return {}

    symbol_metrics = {
        symbol: get_base_signal_for_symbol(symbol)
        for symbol in normalized_symbols
    }
    cluster_map = _assign_cluster_labels(symbol_metrics)

    recommendation_map = {}
    for symbol in normalized_symbols:
        metrics = dict(symbol_metrics.get(symbol) or {})
        metrics['cluster_label'] = cluster_map.get(
            symbol,
            _heuristic_cluster_label(metrics.get('annualized_return'), metrics.get('volatility'))
        )
        _, buy_signal = _derive_recommendation(metrics)
        metrics['buy_signal'] = buy_signal
        recommendation_map[symbol] = metrics

    return recommendation_map
