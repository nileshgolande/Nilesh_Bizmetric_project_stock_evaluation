"""Portfolio recommendation and analytics helpers."""
from django.core.cache import cache

try:
    from predictions.stock_predictions import get_stock_predictions
except ImportError:
    get_stock_predictions = None

try:
    from portfolio.services import fetch_live_snapshot
except ImportError:
    from .services import fetch_live_snapshot

CACHE_TTL = 600  # 10 minutes


def _empty_metrics():
    return {
        'annualized_return': None,
        'volatility': None,
        'cluster_label': None,
        'predicted_price_7d': None,
        'forecast_line_7d': [],
        'rsi_14': None,
        'buy_signal': False,
        'lr_forecast_2d': [None, None],
        'logistic_signal': None,
        'cnn_next_2_days': [None, None],
        'rnn_next_2_days': [None, None],
        'logistic_accuracy': None,
        'cnn_rmse': None,
        'rnn_rmse': None,
        'current_price': None,
    }


def get_base_signal_for_symbol(symbol):
    """Get base analytics/metrics for a symbol (used when not in recommendation map)."""
    if not symbol:
        return _empty_metrics()
    symbol = str(symbol).strip().upper()
    cache_key = f"base_signal:{symbol}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    metrics = _empty_metrics()
    snapshot = fetch_live_snapshot(symbol, include_metadata=False)
    metrics['current_price'] = snapshot.get('current_price')

    if get_stock_predictions:
        try:
            preds, _ = get_stock_predictions(symbol, days=7)
            if preds and isinstance(preds, list):
                # Future items: last 7 with is_future=True
                future = [p for p in preds if p.get('is_future')]
                if future:
                    prices = []
                    for p in future:
                        pr = p.get('rnn_prediction') or p.get('lr_prediction') or p.get('cnn_prediction')
                        if pr is not None:
                            prices.append(pr)
                    if not prices:
                        prices = [p.get('lr_prediction') for p in future if p.get('lr_prediction') is not None]
                    metrics['forecast_line_7d'] = prices
                    metrics['predicted_price_7d'] = prices[-1] if prices else None
        except Exception:
            pass

    cache.set(cache_key, metrics, CACHE_TTL)
    return metrics


def build_portfolio_recommendation_map(symbols):
    """
    Build a map of symbol -> recommendation metrics for portfolio items.
    Returns dict: {symbol: {annualized_return, volatility, cluster_label, ...}}
    """
    if not symbols:
        return {}
    symbols = [s.strip().upper() for s in symbols if s]
    cache_key = f"portfolio_rec_map:{','.join(sorted(symbols))}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result = {}
    for symbol in symbols:
        result[symbol] = get_base_signal_for_symbol(symbol)

    cache.set(cache_key, result, CACHE_TTL)
    return result
